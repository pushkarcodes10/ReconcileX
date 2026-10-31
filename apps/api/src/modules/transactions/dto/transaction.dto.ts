import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus } from '@reconcilex/db';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryTransactionsDto {
  @ApiPropertyOptional({
    description: 'Filter by data source ID',
    example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a',
  })
  @Transform(({ obj, value }) => value || obj?.dataSourceId)
  @IsUUID()
  @IsOptional()
  sourceId?: string;

  @IsUUID()
  @IsOptional()
  dataSourceId?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction status',
    enum: TransactionStatus,
  })
  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @ApiPropertyOptional({
    description: 'Filter start date (inclusive, ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @Transform(({ obj, value }) => value || obj?.startDate)
  @IsString()
  @IsOptional()
  dateFrom?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter end date (inclusive, ISO 8601)',
    example: '2026-01-31T23:59:59.999Z',
  })
  @Transform(({ obj, value }) => value || obj?.endDate)
  @IsString()
  @IsOptional()
  dateTo?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by exact amount in minor integer units (e.g. cents/paise)',
    example: 10000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Minimum amount in minor integer units',
    example: 1000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum amount in minor integer units',
    example: 500000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Filter by ISO 4217 currency code (e.g. USD, INR, EUR)',
    example: 'USD',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Search external_id or reference (exact or prefix match)',
    example: 'ORD-1001',
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    description: 'Opaque pagination cursor for cursor-based navigation',
  })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Page number for offset pagination (starts at 1)',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of records per page (max 100)',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['transactionDate', 'createdAt', 'amountMinor'],
    default: 'transactionDate',
  })
  @IsIn(['transactionDate', 'createdAt', 'amountMinor'])
  @IsOptional()
  sortBy?: 'transactionDate' | 'createdAt' | 'amountMinor' = 'transactionDate';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class TransactionListItemDto {
  @ApiProperty({ description: 'Transaction UUID' })
  id!: string;

  @ApiProperty({ description: 'Organization UUID' })
  organizationId!: string;

  @ApiProperty({ description: 'Data Source UUID' })
  dataSourceId!: string;

  @ApiProperty({ description: 'External source identifier' })
  externalId!: string;

  @ApiProperty({ description: 'Transaction amount in minor units (cents/paise)' })
  amountMinor!: number;

  @ApiProperty({ description: 'Currency code (ISO 4217)' })
  currency!: string;

  @ApiProperty({ description: 'Date and time of transaction' })
  transactionDate!: Date;

  @ApiPropertyOptional({ description: 'Reconciliation reference number' })
  reference?: string | null;

  @ApiPropertyOptional({ description: 'Secondary external transaction reference' })
  externalTxnId?: string | null;

  @ApiPropertyOptional({ description: 'Merchant or customer order identifier' })
  merchantOrOrderId?: string | null;

  @ApiPropertyOptional({ description: 'Transaction type' })
  txnType?: string | null;

  @ApiProperty({ description: 'Reconciliation status of the transaction' })
  status!: string;

  @ApiProperty({ description: 'Record creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Record last updated timestamp' })
  updatedAt!: Date;
}

export class TransactionDetailDto extends TransactionListItemDto {
  @ApiPropertyOptional({
    description: 'Normalized source payload containing parsed row metadata',
  })
  normalizedPayload?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: 'Cryptographic fingerprint hash for deduplication',
  })
  fingerprint?: string | null;
}

export interface PaginatedTransactionsResponse {
  data: TransactionListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  nextCursor?: string | null;
  hasMore: boolean;
}
