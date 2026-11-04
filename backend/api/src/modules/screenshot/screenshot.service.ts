import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AuditAction, AuditEntityType, NewTransaction } from '@reconcilex/db';
import { generateFingerprint, getCurrencyMinorUnitScale } from '@reconcilex/csv';
import { AuditService } from '../audit/audit.service';
import {
  DATA_SOURCES_REPOSITORY,
  IDataSourcesRepository,
} from '../data-sources/repositories/data-sources.repository.interface';
import {
  ITransactionsRepository,
  TRANSACTIONS_REPOSITORY,
} from '../transactions/repositories/transactions.repository.interface';
import {
  ExtractScreenshotResponseDto,
  IngestScreenshotResponseDto,
  IngestScreenshotTransactionDto,
} from './dto/screenshot.dto';
import { ScreenshotExtractorService } from './screenshot-extractor.service';

const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

@Injectable()
export class ScreenshotService {
  constructor(
    private readonly extractorService: ScreenshotExtractorService,
    @Inject(DATA_SOURCES_REPOSITORY)
    private readonly dataSourcesRepo: IDataSourcesRepository,
    @Inject(TRANSACTIONS_REPOSITORY)
    private readonly transactionsRepo: ITransactionsRepository,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  async extractFromScreenshot(
    organizationId: string,
    file?: Express.Multer.File,
  ): Promise<ExtractScreenshotResponseDto> {
    if (!file) {
      throw new BadRequestException('A screenshot image file is required');
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      throw new BadRequestException(
        `Invalid file format "${file.mimetype}". Please upload a PNG, JPEG, or WebP screenshot.`,
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException('Screenshot file size exceeds maximum limit of 10MB');
    }

    return this.extractorService.extractFromImageBuffer(file.buffer, file.mimetype);
  }

  async ingestScreenshotTransaction(
    organizationId: string,
    userId: string,
    dto: IngestScreenshotTransactionDto,
  ): Promise<IngestScreenshotResponseDto> {
    // 1. Verify data source exists in this organization
    const dataSource = await this.dataSourcesRepo.findById(organizationId, dto.dataSourceId);
    if (!dataSource) {
      throw new NotFoundException(
        `Data source with ID "${dto.dataSourceId}" was not found in this organization`,
      );
    }

    // 2. Prevent duplicate externalId in the same data source
    const existing = await this.transactionsRepo.findByExternalIds(
      organizationId,
      dto.dataSourceId,
      [dto.externalId],
    );

    if (existing.length > 0) {
      throw new ConflictException(
        `A transaction with External ID "${dto.externalId}" already exists in data source "${dataSource.name}".`,
      );
    }

    // 3. Compute minor units
    const currency = dto.currency.toUpperCase().trim();
    const scale = getCurrencyMinorUnitScale(currency);
    const amountMinor = Math.round(dto.amount * Math.pow(10, scale));

    // 4. Parse transaction date
    const parsedDate = new Date(dto.transactionDate);
    if (isNaN(parsedDate.getTime())) {
      throw new BadRequestException(`Invalid transaction date "${dto.transactionDate}"`);
    }

    const isoDateStr = parsedDate.toISOString().split('T')[0];

    // 5. Compute SHA-256 fingerprint for deduplication
    const fingerprint = generateFingerprint({
      externalId: dto.externalId,
      amountMinor,
      currency,
      transactionDate: isoDateStr,
      reference: dto.reference || null,
    });

    // 6. Build new transaction record
    const newTxn: NewTransaction = {
      organizationId,
      dataSourceId: dto.dataSourceId,
      externalId: dto.externalId.trim(),
      amountMinor,
      currency,
      transactionDate: parsedDate,
      reference: dto.reference?.trim() || null,
      externalTxnId: dto.externalTxnId?.trim() || null,
      merchantOrOrderId: dto.merchantOrOrderId?.trim() || null,
      txnType: dto.txnType?.trim() || 'PAYMENT',
      status: 'UNMATCHED',
      normalizedPayload: {
        amount: dto.amount,
        currency,
        source: 'SCREENSHOT_OCR',
        ...(dto.metadata || {}),
      },
      fingerprint,
    };

    const [created] = await this.transactionsRepo.createBatch(organizationId, [newTxn]);

    if (this.auditService) {
      await this.auditService.logUserAction(
        organizationId,
        userId,
        AuditAction.TRANSACTION_CREATED,
        AuditEntityType.TRANSACTION,
        created.id,
        {
          source: 'SCREENSHOT_EXTRACTION',
          externalId: created.externalId,
          amountMinor,
          currency,
          dataSourceId: dto.dataSourceId,
        },
      );
    }

    return {
      id: created.id,
      organizationId: created.organizationId,
      dataSourceId: created.dataSourceId,
      externalId: created.externalId,
      amountMinor: created.amountMinor,
      currency: created.currency,
      transactionDate: created.transactionDate,
      status: created.status,
      reference: created.reference,
      createdAt: created.createdAt,
      message: 'Transaction successfully extracted and ingested into ledger for reconciliation.',
    };
  }
}
