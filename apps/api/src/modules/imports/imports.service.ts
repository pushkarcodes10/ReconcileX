import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportStatus } from '@reconcilex/db';
import { createHash, randomUUID } from 'crypto';
import {
  DATA_SOURCES_REPOSITORY,
  IDataSourcesRepository,
} from '../data-sources/repositories/data-sources.repository.interface';
import {
  PaginatedDuplicateCandidatesResponse,
  PaginatedImportErrorsResponse,
  PaginatedImportsResponse,
  QueryDuplicateCandidatesDto,
  QueryImportErrorsDto,
  QueryImportsDto,
  UploadImportResponseDto,
} from './dto/import.dto';
import { JOB_SERVICE, JobService } from './job/job.service.interface';
import {
  IMPORTS_REPOSITORY,
  IImportsRepository,
} from './repositories/imports.repository.interface';
import { STORAGE_SERVICE, StorageService } from '../storage';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

@Injectable()
export class ImportsService {
  constructor(
    @Inject(IMPORTS_REPOSITORY)
    private readonly importsRepo: IImportsRepository,
    @Inject(DATA_SOURCES_REPOSITORY)
    private readonly dataSourcesRepo: IDataSourcesRepository,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
    @Inject(JOB_SERVICE)
    private readonly jobService: JobService,
  ) {}

  async uploadAndIngest(
    organizationId: string,
    dataSourceId: string,
    file: Express.Multer.File | undefined,
  ): Promise<UploadImportResponseDto> {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    // 1. Validate file extension and MIME type
    const originalFilename = file.originalname || 'import.csv';
    const isCsvExtension = originalFilename.toLowerCase().endsWith('.csv');
    const allowedMimeTypes = [
      'text/csv',
      'application/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'text/x-csv',
      'application/octet-stream',
    ];
    const isCsvMime = allowedMimeTypes.includes(file.mimetype.toLowerCase());

    if (!isCsvExtension && !isCsvMime) {
      throw new BadRequestException('Invalid file type. Only CSV files (.csv) are accepted.');
    }

    // 2. Validate file size limit (50MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new HttpException(
        'File size exceeds the maximum limit of 50MB',
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    // 3. Verify data source exists in this organization (prevents IDOR)
    const dataSource = await this.dataSourcesRepo.findById(organizationId, dataSourceId);
    if (!dataSource) {
      throw new NotFoundException(
        `Data source with ID "${dataSourceId}" not found in this organization`,
      );
    }

    // 4. Compute file SHA-256 for idempotent deduplication
    const contentSha256 = createHash('sha256').update(file.buffer).digest('hex');

    // 5. Check if an identical file was already imported for this data source
    const existing = await this.importsRepo.findImportBySha256(
      organizationId,
      dataSourceId,
      contentSha256,
    );

    if (existing) {
      return {
        jobId: existing.id,
        importId: existing.id,
        status: existing.status as ImportStatus,
        duplicateFile: true,
      };
    }

    // 6. Upload file buffer to object storage using generated key
    const storageKey = `${organizationId}/${dataSourceId}/${randomUUID()}.csv`;
    await this.storageService.uploadObject(storageKey, file.buffer, 'text/csv');

    // 7. Create import record
    const newImport = await this.importsRepo.createImport({
      organizationId,
      dataSourceId,
      storageKey,
      originalFilename,
      contentSha256,
      status: 'QUEUED',
      rowCount: 0,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
    });

    // 8. Submit to JobService (executes synchronously in Milestone A)
    const jobResult = await this.jobService.submitImport(newImport);

    const updated = await this.importsRepo.findImportById(organizationId, newImport.id);

    return {
      jobId: jobResult.jobId,
      importId: newImport.id,
      status: (updated?.status ?? 'PROCESSING') as ImportStatus,
      duplicateFile: false,
    };
  }

  async getImports(
    organizationId: string,
    query: QueryImportsDto,
  ): Promise<PaginatedImportsResponse> {
    return this.importsRepo.findImports(organizationId, query);
  }

  async getImportById(organizationId: string, id: string) {
    const record = await this.importsRepo.findImportById(organizationId, id);
    if (!record) {
      throw new NotFoundException(`Import with ID "${id}" not found`);
    }
    return record;
  }

  async getImportErrors(
    organizationId: string,
    id: string,
    query: QueryImportErrorsDto,
  ): Promise<PaginatedImportErrorsResponse> {
    // Check existence first
    await this.getImportById(organizationId, id);
    return this.importsRepo.findRowErrors(organizationId, id, query);
  }

  async getImportStatus(organizationId: string, id: string) {
    const record = await this.getImportById(organizationId, id);
    return {
      id: record.id,
      status: record.status,
      rowCount: record.rowCount,
      validCount: record.validCount,
      invalidCount: record.invalidCount,
      duplicateCount: record.duplicateCount,
      completedAt: record.completedAt,
    };
  }

  async getDuplicateCandidates(
    organizationId: string,
    query: QueryDuplicateCandidatesDto,
  ): Promise<PaginatedDuplicateCandidatesResponse> {
    return this.importsRepo.findDuplicateCandidates(organizationId, query);
  }
}
