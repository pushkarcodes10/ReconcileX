import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus } from '@reconcilex/db';
import { Type } from 'class-transformer';
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
  @ApiPropertyOptional({ description: 'Filter by data source ID' })
  @IsUUID()
  @IsOptional()
  dataSourceId?: string;

  @ApiPropertyOptional({ description: 'Filter by transaction status', enum: TransactionStatus })
  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @ApiPropertyOptional({ description: 'Filter by ISO 4217 currency code (e.g. USD, INR)', example: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Filter start date (inclusive, ISO 8601)', example: '2026-01-01T00:00:00Z' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter end date (inclusive, ISO 8601)', example: '2026-01-31T23:59:59Z' })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Minimum amount in minor integer units (e.g. cents/paise)', example: 1000 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum amount in minor integer units (e.g. cents/paise)', example: 500000 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxAmount?: number;

  @ApiPropertyOptional({ description: 'Search external_id or reference (exact or prefix)', example: 'ORD-1001' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'Page number (starts at 1)', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size limit (max 100)', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Field to sort by', default: 'transactionDate' })
  @IsIn(['transactionDate', 'createdAt', 'amountMinor'])
  @IsOptional()
  sortBy?: 'transactionDate' | 'createdAt' | 'amountMinor' = 'transactionDate';

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export interface PaginatedTransactionsResponse {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
