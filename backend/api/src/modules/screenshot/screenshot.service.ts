import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  and,
  AuditAction,
  AuditEntityType,
  DatabaseClient,
  DataSource,
  DataSourceStatus,
  DataSourceType,
  dataSources,
  desc,
  eq,
  NewScreenshotDataset,
  NewScreenshotExtractedRecord,
  NewScreenshotFile,
  NewTransaction,
  screenshotDatasets,
  screenshotExtractedRecords,
  screenshotFiles,
  transactions,
} from '@reconcilex/db';
import { generateFingerprint, getCurrencyMinorUnitScale } from '@reconcilex/csv';
import { DATABASE_CLIENT } from '../../database/database.constants';
import { AuditService } from '../audit/audit.service';
import {
  DATA_SOURCES_REPOSITORY,
  IDataSourcesRepository,
} from '../data-sources/repositories/data-sources.repository.interface';
import { STORAGE_SERVICE } from '../storage/storage.constants';
import { StorageService } from '../storage/storage.interface';
import {
  ITransactionsRepository,
  TRANSACTIONS_REPOSITORY,
} from '../transactions/repositories/transactions.repository.interface';
import {
  ConfirmDatasetDto,
  CreateScreenshotDatasetDto,
  ExtractScreenshotResponseDto,
  IngestScreenshotResponseDto,
  IngestScreenshotTransactionDto,
  ScreenshotDatasetDetailDto,
  ScreenshotExtractedRecordDto,
  ScreenshotFileDto,
  UpdateExtractedRecordDto,
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
  private readonly logger = new Logger(ScreenshotService.name);

  constructor(
    private readonly extractorService: ScreenshotExtractorService,
    @Inject(DATA_SOURCES_REPOSITORY)
    private readonly dataSourcesRepo: IDataSourcesRepository,
    @Inject(TRANSACTIONS_REPOSITORY)
    private readonly transactionsRepo: ITransactionsRepository,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
    @Inject(DATABASE_CLIENT)
    private readonly db: DatabaseClient,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. Single Screenshot Direct Extract (Backward Compatibility)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 2. Direct Ingest Single Screenshot Transaction (Backward Compatibility)
  // ---------------------------------------------------------------------------
  async ingestScreenshotTransaction(
    organizationId: string,
    userId: string,
    dto: IngestScreenshotTransactionDto,
  ): Promise<IngestScreenshotResponseDto> {
    const dataSource = await this.dataSourcesRepo.findById(organizationId, dto.dataSourceId);
    if (!dataSource) {
      throw new NotFoundException(
        `Data source with ID "${dto.dataSourceId}" was not found in this organization`,
      );
    }

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

    const currency = dto.currency.toUpperCase().trim();
    const scale = getCurrencyMinorUnitScale(currency);
    const amountMinor = Math.round(dto.amount * Math.pow(10, scale));

    const parsedDate = new Date(dto.transactionDate);
    if (isNaN(parsedDate.getTime())) {
      throw new BadRequestException(`Invalid transaction date "${dto.transactionDate}"`);
    }

    const isoDateStr = parsedDate.toISOString().split('T')[0];

    const fingerprint = generateFingerprint({
      externalId: dto.externalId,
      amountMinor,
      currency,
      transactionDate: isoDateStr,
      reference: dto.reference || null,
    });

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

  // ---------------------------------------------------------------------------
  // 3. Multi-Screenshot Batch Ingestion & Dataset Creation
  // ---------------------------------------------------------------------------
  async createDataset(
    organizationId: string,
    userId: string,
    dto: CreateScreenshotDatasetDto,
    files: Express.Multer.File[],
  ): Promise<ScreenshotDatasetDetailDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one screenshot image file is required');
    }

    for (const f of files) {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(f.mimetype.toLowerCase())) {
        throw new BadRequestException(
          `Invalid file format "${f.mimetype}" in "${f.originalname}". Allowed: PNG, JPEG, WebP.`,
        );
      }
      if (f.size > MAX_IMAGE_SIZE_BYTES) {
        throw new BadRequestException(
          `File "${f.originalname}" exceeds maximum size limit of 10MB.`,
        );
      }
    }

    // 1. Create dataset record with PROCESSING status
    const newDataset: NewScreenshotDataset = {
      organizationId,
      name: dto.name.trim(),
      status: 'PROCESSING',
      totalFiles: files.length,
      totalRecords: 0,
      confirmedRecords: 0,
      dataSourceId: dto.dataSourceId || null,
      metadata: {
        submittedBy: userId,
        fileNames: files.map((f) => f.originalname),
      },
    };

    const [dataset] = await this.db
      .insert(screenshotDatasets)
      .values(newDataset)
      .returning();

    const createdFiles: ScreenshotFileDto[] = [];
    const createdRecords: ScreenshotExtractedRecordDto[] = [];
    const seenExternalIdsInBatch = new Set<string>();

    try {
      // 2. Process each file: Hash, S3 Upload, OCR Extract, Staged Record
      for (const f of files) {
        const fileId = crypto.randomUUID();
        const contentSha256 = crypto.createHash('sha256').update(f.buffer).digest('hex');
        const cleanFilename = f.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storageKey = `screenshots/${organizationId}/${dataset.id}/${fileId}-${cleanFilename}`;

        // Upload to S3-compatible storage
        await this.storageService.uploadObject(storageKey, f.buffer, f.mimetype);

        // Insert screenshot file record
        const newFile: NewScreenshotFile = {
          id: fileId,
          organizationId,
          datasetId: dataset.id,
          storageKey,
          originalFilename: f.originalname,
          mimeType: f.mimetype,
          fileSize: f.size,
          contentSha256,
          status: 'PROCESSING',
          extractedCount: 0,
        };

        const [fileRecord] = await this.db
          .insert(screenshotFiles)
          .values(newFile)
          .returning();

        // Presigned preview URL
        const previewUrl = await this.storageService.getPresignedUrl(storageKey, 900);

        // Perform OCR extraction
        let extractionResult: ExtractScreenshotResponseDto;
        try {
          extractionResult = await this.extractorService.extractFromImageBuffer(
            f.buffer,
            f.mimetype,
          );
        } catch (extractErr: any) {
          this.logger.error(`Extraction failed for ${f.originalname}: ${extractErr.message}`);
          await this.db
            .update(screenshotFiles)
            .set({
              status: 'FAILED',
              errorMessage: extractErr.message,
              updatedAt: new Date(),
            })
            .where(eq(screenshotFiles.id, fileRecord.id));
          continue;
        }

        // Validate extracted fields and compute confidences
        const validationErrors: string[] = [];
        const externalId = (extractionResult.externalId || '').trim();
        const amount = Number(extractionResult.amount) || 0;
        const currency = (extractionResult.currency || 'INR').toUpperCase().trim();
        const rawDate = extractionResult.transactionDate;

        let parsedDate = new Date(rawDate);
        if (isNaN(parsedDate.getTime())) {
          validationErrors.push('Missing or unparseable transaction date');
          parsedDate = new Date();
        }

        if (amount <= 0) {
          validationErrors.push('Monetary amount must be greater than zero');
        }

        if (!currency || currency.length !== 3) {
          validationErrors.push('Currency must be a 3-letter ISO code');
        }

        if (!externalId) {
          validationErrors.push('Transaction identifier could not be verified');
        }

        // Check duplicate within batch or ledger
        let isDuplicate = false;
        if (externalId && seenExternalIdsInBatch.has(externalId)) {
          isDuplicate = true;
          validationErrors.push(`Duplicate external ID "${externalId}" found in uploaded batch`);
        } else if (externalId) {
          seenExternalIdsInBatch.add(externalId);
        }

        const scale = getCurrencyMinorUnitScale(currency);
        const amountMinor = Math.round(amount * Math.pow(10, scale));
        const confidenceScore = extractionResult.confidenceScore ?? 85;
        const isLowConfidence = confidenceScore < 80 || validationErrors.length > 0;

        const fieldConfidences: Record<string, number> = {
          amount: amount > 0 ? confidenceScore : 20,
          currency: currency.length === 3 ? 95 : 30,
          transactionDate: !isNaN(parsedDate.getTime()) ? 90 : 25,
          externalId: externalId.length > 3 ? confidenceScore : 30,
          reference: extractionResult.reference ? 85 : 0,
        };

        const newRecord: NewScreenshotExtractedRecord = {
          organizationId,
          datasetId: dataset.id,
          screenshotFileId: fileRecord.id,
          externalId: externalId || `TXN-PENDING-${fileId.slice(0, 8)}`,
          amount,
          amountMinor,
          currency,
          transactionDate: parsedDate,
          reference: extractionResult.reference || null,
          externalTxnId: extractionResult.externalTxnId || null,
          merchantOrOrderId: extractionResult.merchantOrOrderId || null,
          txnType: extractionResult.txnType || 'PAYMENT',
          description: extractionResult.description || null,
          confidenceScore,
          fieldConfidences,
          isDuplicate,
          isLowConfidence,
          validationErrors: validationErrors.length > 0 ? validationErrors : null,
          userCorrected: false,
          userCorrectionHistory: [],
        };

        const [createdRecord] = await this.db
          .insert(screenshotExtractedRecords)
          .values(newRecord)
          .returning();

        // Update file status to EXTRACTED
        await this.db
          .update(screenshotFiles)
          .set({
            status: 'EXTRACTED',
            rawOcrText: extractionResult.rawOcrText,
            extractedCount: 1,
            extractionMetadata: {
              method: extractionResult.extractionMethod,
              confidenceScore,
            },
            updatedAt: new Date(),
          })
          .where(eq(screenshotFiles.id, fileRecord.id));

        createdFiles.push({
          id: fileRecord.id,
          organizationId: fileRecord.organizationId,
          datasetId: fileRecord.datasetId,
          storageKey: fileRecord.storageKey,
          originalFilename: fileRecord.originalFilename,
          mimeType: fileRecord.mimeType,
          fileSize: fileRecord.fileSize,
          contentSha256: fileRecord.contentSha256,
          status: 'EXTRACTED',
          rawOcrText: extractionResult.rawOcrText,
          extractedCount: 1,
          previewUrl,
          createdAt: fileRecord.createdAt,
        });

        createdRecords.push({
          id: createdRecord.id,
          organizationId: createdRecord.organizationId,
          datasetId: createdRecord.datasetId,
          screenshotFileId: createdRecord.screenshotFileId,
          externalId: createdRecord.externalId,
          amount: createdRecord.amount,
          amountMinor: createdRecord.amountMinor,
          currency: createdRecord.currency,
          transactionDate: createdRecord.transactionDate,
          reference: createdRecord.reference,
          externalTxnId: createdRecord.externalTxnId,
          merchantOrOrderId: createdRecord.merchantOrOrderId,
          txnType: createdRecord.txnType,
          paymentMethod: createdRecord.paymentMethod,
          senderReceiver: createdRecord.senderReceiver,
          description: createdRecord.description,
          confidenceScore: createdRecord.confidenceScore,
          fieldConfidences: createdRecord.fieldConfidences,
          isDuplicate: createdRecord.isDuplicate,
          isLowConfidence: createdRecord.isLowConfidence,
          validationErrors: createdRecord.validationErrors,
          userCorrected: createdRecord.userCorrected,
          userCorrectionHistory: createdRecord.userCorrectionHistory,
          transactionId: createdRecord.transactionId,
          screenshotPreviewUrl: previewUrl,
          createdAt: createdRecord.createdAt,
          updatedAt: createdRecord.updatedAt,
        });
      }

      // 3. Mark dataset as REVIEW_REQUIRED
      const [updatedDataset] = await this.db
        .update(screenshotDatasets)
        .set({
          status: 'REVIEW_REQUIRED',
          totalRecords: createdRecords.length,
          updatedAt: new Date(),
        })
        .where(eq(screenshotDatasets.id, dataset.id))
        .returning();

      if (this.auditService) {
        await this.auditService.logUserAction(
          organizationId,
          userId,
          AuditAction.IMPORT_UPLOADED,
          AuditEntityType.DATA_SOURCE,
          dataset.id,
          {
            datasetName: dataset.name,
            totalFiles: files.length,
            extractedRecords: createdRecords.length,
          },
        );
      }

      return {
        id: updatedDataset.id,
        organizationId: updatedDataset.organizationId,
        dataSourceId: updatedDataset.dataSourceId,
        name: updatedDataset.name,
        status: updatedDataset.status,
        totalFiles: updatedDataset.totalFiles,
        totalRecords: updatedDataset.totalRecords,
        confirmedRecords: updatedDataset.confirmedRecords,
        metadata: updatedDataset.metadata,
        confirmedById: updatedDataset.confirmedById,
        confirmedAt: updatedDataset.confirmedAt,
        createdAt: updatedDataset.createdAt,
        updatedAt: updatedDataset.updatedAt,
        files: createdFiles,
        records: createdRecords,
      };
    } catch (err: any) {
      this.logger.error(`Batch dataset processing failed: ${err.message}`, err.stack);
      await this.db
        .update(screenshotDatasets)
        .set({ status: 'FAILED', updatedAt: new Date() })
        .where(eq(screenshotDatasets.id, dataset.id));
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // 4. List Screenshot Datasets in Organization
  // ---------------------------------------------------------------------------
  async getDatasets(organizationId: string): Promise<ScreenshotDatasetDetailDto[]> {
    const list = await this.db
      .select()
      .from(screenshotDatasets)
      .where(eq(screenshotDatasets.organizationId, organizationId))
      .orderBy(desc(screenshotDatasets.createdAt));

    return list.map((d) => ({
      id: d.id,
      organizationId: d.organizationId,
      dataSourceId: d.dataSourceId,
      name: d.name,
      status: d.status,
      totalFiles: d.totalFiles,
      totalRecords: d.totalRecords,
      confirmedRecords: d.confirmedRecords,
      metadata: d.metadata,
      confirmedById: d.confirmedById,
      confirmedAt: d.confirmedAt,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // 5. Get Dataset Details by ID with Files & Staged Extracted Records
  // ---------------------------------------------------------------------------
  async getDatasetById(
    organizationId: string,
    datasetId: string,
  ): Promise<ScreenshotDatasetDetailDto> {
    const [dataset] = await this.db
      .select()
      .from(screenshotDatasets)
      .where(
        and(
          eq(screenshotDatasets.id, datasetId),
          eq(screenshotDatasets.organizationId, organizationId),
        ),
      );

    if (!dataset) {
      throw new NotFoundException(`Screenshot dataset "${datasetId}" was not found.`);
    }

    const files = await this.db
      .select()
      .from(screenshotFiles)
      .where(
        and(
          eq(screenshotFiles.datasetId, datasetId),
          eq(screenshotFiles.organizationId, organizationId),
        ),
      )
      .orderBy(desc(screenshotFiles.createdAt));

    const records = await this.db
      .select()
      .from(screenshotExtractedRecords)
      .where(
        and(
          eq(screenshotExtractedRecords.datasetId, datasetId),
          eq(screenshotExtractedRecords.organizationId, organizationId),
        ),
      )
      .orderBy(desc(screenshotExtractedRecords.createdAt));

    // Generate presigned preview URLs for files
    const fileDtos: ScreenshotFileDto[] = [];
    const previewUrlMap = new Map<string, string>();

    for (const f of files) {
      let previewUrl: string | null = null;
      try {
        previewUrl = await this.storageService.getPresignedUrl(f.storageKey, 900);
        previewUrlMap.set(f.id, previewUrl);
      } catch (e: any) {
        this.logger.warn(`Could not generate presigned preview for file ${f.id}: ${e.message}`);
      }

      fileDtos.push({
        id: f.id,
        organizationId: f.organizationId,
        datasetId: f.datasetId,
        storageKey: f.storageKey,
        originalFilename: f.originalFilename,
        mimeType: f.mimeType,
        fileSize: f.fileSize,
        contentSha256: f.contentSha256,
        status: f.status,
        rawOcrText: f.rawOcrText,
        extractedCount: f.extractedCount,
        previewUrl,
        createdAt: f.createdAt,
      });
    }

    const recordDtos: ScreenshotExtractedRecordDto[] = records.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      datasetId: r.datasetId,
      screenshotFileId: r.screenshotFileId,
      externalId: r.externalId,
      amount: r.amount,
      amountMinor: r.amountMinor,
      currency: r.currency,
      transactionDate: r.transactionDate,
      reference: r.reference,
      externalTxnId: r.externalTxnId,
      merchantOrOrderId: r.merchantOrOrderId,
      txnType: r.txnType,
      paymentMethod: r.paymentMethod,
      senderReceiver: r.senderReceiver,
      description: r.description,
      confidenceScore: r.confidenceScore,
      fieldConfidences: r.fieldConfidences,
      isDuplicate: r.isDuplicate,
      isLowConfidence: r.isLowConfidence,
      validationErrors: r.validationErrors,
      userCorrected: r.userCorrected,
      userCorrectionHistory: r.userCorrectionHistory,
      transactionId: r.transactionId,
      screenshotPreviewUrl: previewUrlMap.get(r.screenshotFileId) || null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return {
      id: dataset.id,
      organizationId: dataset.organizationId,
      dataSourceId: dataset.dataSourceId,
      name: dataset.name,
      status: dataset.status,
      totalFiles: dataset.totalFiles,
      totalRecords: dataset.totalRecords,
      confirmedRecords: dataset.confirmedRecords,
      metadata: dataset.metadata,
      confirmedById: dataset.confirmedById,
      confirmedAt: dataset.confirmedAt,
      createdAt: dataset.createdAt,
      updatedAt: dataset.updatedAt,
      files: fileDtos,
      records: recordDtos,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Get Presigned Preview URL for a Screenshot File
  // ---------------------------------------------------------------------------
  async getFilePreviewUrl(
    organizationId: string,
    fileId: string,
  ): Promise<{ previewUrl: string; expiresInSeconds: number }> {
    const [file] = await this.db
      .select()
      .from(screenshotFiles)
      .where(
        and(
          eq(screenshotFiles.id, fileId),
          eq(screenshotFiles.organizationId, organizationId),
        ),
      );

    if (!file) {
      throw new NotFoundException(`Screenshot file "${fileId}" was not found.`);
    }

    const previewUrl = await this.storageService.getPresignedUrl(file.storageKey, 900);
    return {
      previewUrl,
      expiresInSeconds: 900,
    };
  }

  // ---------------------------------------------------------------------------
  // 7. Update / Correct Extracted Record Values
  // ---------------------------------------------------------------------------
  async updateExtractedRecord(
    organizationId: string,
    userId: string,
    recordId: string,
    dto: UpdateExtractedRecordDto,
  ): Promise<ScreenshotExtractedRecordDto> {
    const [record] = await this.db
      .select()
      .from(screenshotExtractedRecords)
      .where(
        and(
          eq(screenshotExtractedRecords.id, recordId),
          eq(screenshotExtractedRecords.organizationId, organizationId),
        ),
      );

    if (!record) {
      throw new NotFoundException(`Extracted record "${recordId}" was not found.`);
    }

    // Verify parent dataset is still editable (REVIEW_REQUIRED or PROCESSING)
    const [dataset] = await this.db
      .select()
      .from(screenshotDatasets)
      .where(eq(screenshotDatasets.id, record.datasetId));

    if (dataset && dataset.status === 'READY') {
      throw new BadRequestException('Cannot edit records in an already confirmed READY dataset.');
    }

    // Compute diff and record user correction history
    const beforeState: Record<string, unknown> = {};
    const afterState: Record<string, unknown> = {};

    let newAmount = record.amount;
    let newCurrency = record.currency;
    let newDate = record.transactionDate;
    let newExternalId = record.externalId;

    if (dto.amount !== undefined && dto.amount !== record.amount) {
      beforeState.amount = record.amount;
      afterState.amount = dto.amount;
      newAmount = dto.amount;
    }

    if (dto.currency !== undefined && dto.currency.toUpperCase() !== record.currency) {
      beforeState.currency = record.currency;
      afterState.currency = dto.currency.toUpperCase();
      newCurrency = dto.currency.toUpperCase();
    }

    if (dto.transactionDate !== undefined) {
      const parsed = new Date(dto.transactionDate);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException(`Invalid transaction date "${dto.transactionDate}"`);
      }
      beforeState.transactionDate = record.transactionDate;
      afterState.transactionDate = parsed;
      newDate = parsed;
    }

    if (dto.externalId !== undefined && dto.externalId !== record.externalId) {
      beforeState.externalId = record.externalId;
      afterState.externalId = dto.externalId.trim();
      newExternalId = dto.externalId.trim();
    }

    const scale = getCurrencyMinorUnitScale(newCurrency);
    const amountMinor = Math.round(newAmount * Math.pow(10, scale));

    const history = Array.isArray(record.userCorrectionHistory)
      ? [...record.userCorrectionHistory]
      : [];

    if (Object.keys(beforeState).length > 0 || dto.reference !== undefined) {
      history.push({
        timestamp: new Date().toISOString(),
        userId,
        before: beforeState,
        after: afterState,
      });
    }

    // Re-check validation
    const validationErrors: string[] = [];
    if (newAmount <= 0) validationErrors.push('Monetary amount must be greater than zero');
    if (!newCurrency || newCurrency.length !== 3) validationErrors.push('Currency must be 3-letter ISO code');
    if (isNaN(newDate.getTime())) validationErrors.push('Invalid transaction date');
    if (!newExternalId) validationErrors.push('Missing transaction external ID');

    const [updated] = await this.db
      .update(screenshotExtractedRecords)
      .set({
        amount: newAmount,
        amountMinor,
        currency: newCurrency,
        transactionDate: newDate,
        externalId: newExternalId,
        reference: dto.reference !== undefined ? dto.reference : record.reference,
        externalTxnId: dto.externalTxnId !== undefined ? dto.externalTxnId : record.externalTxnId,
        merchantOrOrderId:
          dto.merchantOrOrderId !== undefined ? dto.merchantOrOrderId : record.merchantOrOrderId,
        txnType: dto.txnType !== undefined ? dto.txnType : record.txnType,
        paymentMethod: dto.paymentMethod !== undefined ? dto.paymentMethod : record.paymentMethod,
        senderReceiver:
          dto.senderReceiver !== undefined ? dto.senderReceiver : record.senderReceiver,
        description: dto.description !== undefined ? dto.description : record.description,
        userCorrected: true,
        userCorrectionHistory: history,
        isLowConfidence: validationErrors.length > 0,
        validationErrors: validationErrors.length > 0 ? validationErrors : null,
        updatedAt: new Date(),
      })
      .where(eq(screenshotExtractedRecords.id, recordId))
      .returning();

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      datasetId: updated.datasetId,
      screenshotFileId: updated.screenshotFileId,
      externalId: updated.externalId,
      amount: updated.amount,
      amountMinor: updated.amountMinor,
      currency: updated.currency,
      transactionDate: updated.transactionDate,
      reference: updated.reference,
      externalTxnId: updated.externalTxnId,
      merchantOrOrderId: updated.merchantOrOrderId,
      txnType: updated.txnType,
      paymentMethod: updated.paymentMethod,
      senderReceiver: updated.senderReceiver,
      description: updated.description,
      confidenceScore: updated.confidenceScore,
      fieldConfidences: updated.fieldConfidences,
      isDuplicate: updated.isDuplicate,
      isLowConfidence: updated.isLowConfidence,
      validationErrors: updated.validationErrors,
      userCorrected: updated.userCorrected,
      userCorrectionHistory: updated.userCorrectionHistory,
      transactionId: updated.transactionId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // 8. Confirm Dataset & Populate Ledger Transactions Table
  // ---------------------------------------------------------------------------
  async confirmDataset(
    organizationId: string,
    userId: string,
    datasetId: string,
    dto: ConfirmDatasetDto,
  ): Promise<ScreenshotDatasetDetailDto> {
    const [dataset] = await this.db
      .select()
      .from(screenshotDatasets)
      .where(
        and(
          eq(screenshotDatasets.id, datasetId),
          eq(screenshotDatasets.organizationId, organizationId),
        ),
      );

    if (!dataset) {
      throw new NotFoundException(`Screenshot dataset "${datasetId}" was not found.`);
    }

    if (dataset.status === 'READY') {
      throw new ConflictException('This screenshot dataset has already been confirmed and is READY.');
    }

    // Fetch all extracted records
    const records = await this.db
      .select()
      .from(screenshotExtractedRecords)
      .where(
        and(
          eq(screenshotExtractedRecords.datasetId, datasetId),
          eq(screenshotExtractedRecords.organizationId, organizationId),
        ),
      );

    if (records.length === 0) {
      throw new BadRequestException('Cannot confirm a dataset with zero extracted records.');
    }

    // Verify no blocking validation errors
    const blocking = records.filter(
      (r) => r.validationErrors && r.validationErrors.length > 0,
    );
    if (blocking.length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERRORS_REMAINING',
        message: `Cannot confirm dataset: ${blocking.length} record(s) still have unresolved validation errors. Please review and correct them.`,
      });
    }

    // Determine target Data Source (create new or link existing)
    let targetDataSourceId = dto.dataSourceId || dataset.dataSourceId;

    if (!targetDataSourceId) {
      const dsName = (dto.dataSourceName || dataset.name || 'Screenshot Data Source').trim();
      const [newDs] = await this.db
        .insert(dataSources)
        .values({
          organizationId,
          name: dsName,
          type: DataSourceType.SCREENSHOT,
          status: DataSourceStatus.ACTIVE,
          columnMapping: {
            external_id: 'externalId',
            amount: 'amount',
            currency: 'currency',
            date: 'transactionDate',
            reference: 'reference',
          },
        })
        .returning();

      targetDataSourceId = newDs.id;
    } else {
      // Verify chosen data source exists in this organization
      const existingDs = await this.dataSourcesRepo.findById(organizationId, targetDataSourceId);
      if (!existingDs) {
        throw new NotFoundException(`Data source "${targetDataSourceId}" not found in organization.`);
      }
    }

    // Insert records into `transactions` table
    const now = new Date();
    const newTxns: NewTransaction[] = records.map((r) => {
      const isoDateStr = r.transactionDate.toISOString().split('T')[0];
      const fingerprint = generateFingerprint({
        externalId: r.externalId,
        amountMinor: r.amountMinor,
        currency: r.currency,
        transactionDate: isoDateStr,
        reference: r.reference || null,
      });

      return {
        organizationId,
        dataSourceId: targetDataSourceId!,
        externalId: r.externalId,
        amountMinor: r.amountMinor,
        currency: r.currency,
        transactionDate: r.transactionDate,
        reference: r.reference || null,
        externalTxnId: r.externalTxnId || null,
        merchantOrOrderId: r.merchantOrOrderId || null,
        txnType: r.txnType || 'PAYMENT',
        screenshotFileId: r.screenshotFileId, // Links directly back to screenshot file
        status: 'UNMATCHED',
        normalizedPayload: {
          amount: r.amount,
          currency: r.currency,
          source: 'SCREENSHOT_DATASET',
          datasetId: dataset.id,
          screenshotFileId: r.screenshotFileId,
          userCorrected: r.userCorrected,
          confidenceScore: r.confidenceScore,
        },
        fingerprint,
      };
    });

    // Batch insert transactions into ledger
    const createdTxns = await this.transactionsRepo.createBatch(organizationId, newTxns);

    // Link created transaction IDs back into screenshotExtractedRecords
    for (let i = 0; i < records.length && i < createdTxns.length; i++) {
      await this.db
        .update(screenshotExtractedRecords)
        .set({
          transactionId: createdTxns[i].id,
          updatedAt: now,
        })
        .where(eq(screenshotExtractedRecords.id, records[i].id));
    }

    // Update dataset status to READY
    const [confirmedDataset] = await this.db
      .update(screenshotDatasets)
      .set({
        status: 'READY',
        dataSourceId: targetDataSourceId,
        confirmedRecords: createdTxns.length,
        confirmedById: userId,
        confirmedAt: now,
        updatedAt: now,
      })
      .where(eq(screenshotDatasets.id, datasetId))
      .returning();

    if (this.auditService) {
      await this.auditService.logUserAction(
        organizationId,
        userId,
        AuditAction.TRANSACTION_CREATED,
        AuditEntityType.DATA_SOURCE,
        targetDataSourceId,
        {
          datasetId: dataset.id,
          datasetName: dataset.name,
          recordsIngested: createdTxns.length,
          status: 'READY',
        },
      );
    }

    return {
      id: confirmedDataset.id,
      organizationId: confirmedDataset.organizationId,
      dataSourceId: confirmedDataset.dataSourceId,
      name: confirmedDataset.name,
      status: confirmedDataset.status,
      totalFiles: confirmedDataset.totalFiles,
      totalRecords: confirmedDataset.totalRecords,
      confirmedRecords: confirmedDataset.confirmedRecords,
      metadata: confirmedDataset.metadata,
      confirmedById: confirmedDataset.confirmedById,
      confirmedAt: confirmedDataset.confirmedAt,
      createdAt: confirmedDataset.createdAt,
      updatedAt: confirmedDataset.updatedAt,
    };
  }
}
