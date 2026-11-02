import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DuplicateStatus, ImportStatus } from '@reconcilex/db';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class UploadImportResponseDto {
  @ApiProperty({ description: 'Job UUID' })
  jobId!: string;

  @ApiProperty({ description: 'Import UUID' })
  importId!: string;

  @ApiProperty({ description: 'Current status of the import job', enum: ImportStatus })
  status!: ImportStatus;

  @ApiPropertyOptional({ description: 'Indicates if the file was identical to a previous import' })
  duplicateFile?: boolean;
}

export class ImportDto {
  @ApiProperty({ description: 'Import UUID' })
  id!: string;

  @ApiProperty({ description: 'Organization UUID' })
  organizationId!: string;

  @ApiProperty({ description: 'Data Source UUID' })
  dataSourceId!: string;

  @ApiProperty({ description: 'Original uploaded filename' })
  originalFilename!: string;

  @ApiProperty({ description: 'Content SHA-256 hash' })
  contentSha256!: string;

  @ApiProperty({ description: 'Processing status', enum: ImportStatus })
  status!: string;

  @ApiProperty({ description: 'Total row count processed' })
  rowCount!: number;

  @ApiProperty({ description: 'Number of successfully imported rows' })
  validCount!: number;

  @ApiProperty({ description: 'Number of rows with validation errors' })
  invalidCount!: number;

  @ApiProperty({ description: 'Number of rows flagged as duplicates' })
  duplicateCount!: number;

  @ApiPropertyOptional({ description: 'Summary of error categories and counts' })
  errorSummary?: Record<string, unknown> | null;

  @ApiProperty({ description: 'Import submission timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Import last updated timestamp' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Import completion timestamp' })
  completedAt?: Date | null;
}

export class QueryImportsDto {
  @ApiPropertyOptional({ description: 'Filter by data source ID' })
  @IsUUID()
  @IsOptional()
  dataSourceId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ImportStatus })
  @IsEnum(ImportStatus)
  @IsOptional()
  status?: ImportStatus;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page limit', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export interface PaginatedImportsResponse {
  data: ImportDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ImportRowErrorDto {
  @ApiProperty({ description: 'Error UUID' })
  id!: string;

  @ApiProperty({ description: 'Import UUID' })
  importId!: string;

  @ApiProperty({ description: 'Row line number in the CSV file' })
  rowNumber!: number;

  @ApiPropertyOptional({ description: 'Column or canonical field name' })
  field?: string | null;

  @ApiProperty({ description: 'Error classification code' })
  code!: string;

  @ApiPropertyOptional({ description: 'Original unparsed raw value' })
  rawValue?: string | null;

  @ApiProperty({ description: 'Human-readable error explanation' })
  message!: string;

  @ApiProperty({ description: 'Timestamp when error was recorded' })
  createdAt!: Date;
}

export class QueryImportErrorsDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page limit', default: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 50;
}

export interface PaginatedImportErrorsResponse {
  data: ImportRowErrorDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class DuplicateCandidateDto {
  @ApiProperty({ description: 'Candidate UUID' })
  id!: string;

  @ApiProperty({ description: 'Organization UUID' })
  organizationId!: string;

  @ApiProperty({ description: 'Import UUID' })
  importId!: string;

  @ApiProperty({ description: 'Data Source UUID' })
  dataSourceId!: string;

  @ApiPropertyOptional({ description: 'Existing matching transaction UUID if found in DB' })
  existingTransactionId?: string | null;

  @ApiPropertyOptional({ description: 'Cryptographic fingerprint hash' })
  candidateFingerprint?: string | null;

  @ApiProperty({ description: 'External ID from CSV row' })
  externalId!: string;

  @ApiPropertyOptional({ description: 'CSV line row number' })
  rowNumber?: number | null;

  @ApiProperty({ description: 'Reason for duplication flag' })
  reason!: string;

  @ApiProperty({ description: 'Quarantine status', enum: DuplicateStatus })
  status!: string;

  @ApiProperty({ description: 'Timestamp when duplicate was detected' })
  createdAt!: Date;

  @ApiProperty({ description: 'Timestamp when duplicate was updated' })
  updatedAt!: Date;
}

export class QueryDuplicateCandidatesDto {
  @ApiPropertyOptional({ description: 'Filter by import ID' })
  @IsUUID()
  @IsOptional()
  importId?: string;

  @ApiPropertyOptional({ description: 'Filter by data source ID' })
  @IsUUID()
  @IsOptional()
  dataSourceId?: string;

  @ApiPropertyOptional({ description: 'Filter by quarantine status', enum: DuplicateStatus })
  @IsEnum(DuplicateStatus)
  @IsOptional()
  status?: DuplicateStatus;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page limit', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export interface PaginatedDuplicateCandidatesResponse {
  data: DuplicateCandidateDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
