import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataSourceStatus, DataSourceType } from '@reconcilex/db';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ColumnMappingDto {
  @ApiProperty({
    description: 'CSV header name representing unique transaction ID',
    example: 'Order ID',
  })
  @Transform(({ obj, value }) => value || obj?.externalId || obj?.external_id)
  @IsString()
  @IsNotEmpty()
  external_id!: string;

  @ApiProperty({
    description: 'CSV header name representing transaction amount',
    example: 'Gross Amount',
  })
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @ApiProperty({
    description: 'CSV header name representing transaction date',
    example: 'Payment Date',
  })
  @Transform(({ obj, value }) => value || obj?.transactionDate || obj?.transaction_date)
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({
    description: 'CSV header name representing currency code',
    example: 'Currency',
  })
  @IsString()
  @IsNotEmpty()
  currency!: string;

  @ApiPropertyOptional({
    description: 'CSV header name representing reconciliation reference key',
    example: 'Reference Number',
  })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({
    description: 'CSV header name representing secondary external transaction ID',
    example: 'Gateway Txn ID',
  })
  @Transform(({ obj, value }) => value || obj?.externalTxnId)
  @IsString()
  @IsOptional()
  external_txn_id?: string;

  @ApiPropertyOptional({
    description: 'CSV header name representing merchant or order identifier',
    example: 'Merchant Order ID',
  })
  @Transform(({ obj, value }) => value || obj?.merchantOrOrderId)
  @IsString()
  @IsOptional()
  merchant_or_order_id?: string;

  @ApiPropertyOptional({
    description: 'CSV header name representing transaction type (CHARGE, etc.)',
    example: 'Transaction Type',
  })
  @Transform(({ obj, value }) => value || obj?.txnType)
  @IsString()
  @IsOptional()
  txn_type?: string;

  // Optional camelCase aliases to accept both naming conventions smoothly
  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  transactionDate?: string;

  @IsOptional()
  @IsString()
  externalTxnId?: string;

  @IsOptional()
  @IsString()
  merchantOrOrderId?: string;

  @IsOptional()
  @IsString()
  txnType?: string;
}

export class CreateDataSourceDto {
  @ApiProperty({
    description: 'Unique name of data source within organization',
    example: 'Shopify Store Orders',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Data source classification type',
    enum: DataSourceType,
    example: DataSourceType.INTERNAL_ORDERS,
  })
  @IsEnum(DataSourceType)
  type!: DataSourceType;

  @ApiProperty({
    description: 'Canonical column mappings for CSV headers',
    type: ColumnMappingDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ColumnMappingDto)
  columnMapping!: ColumnMappingDto;

  @ApiPropertyOptional({
    description: 'Data direction flow (defaults to INCOMING)',
    example: 'INCOMING',
  })
  @IsString()
  @IsOptional()
  direction?: string;
}

export class UpdateDataSourceDto {
  @ApiPropertyOptional({
    description: 'Updated name of data source',
    example: 'Shopify Global Store Orders',
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated data source classification type',
    enum: DataSourceType,
    example: DataSourceType.INTERNAL_ORDERS,
  })
  @IsEnum(DataSourceType)
  @IsOptional()
  type?: DataSourceType;

  @ApiPropertyOptional({
    description: 'Updated canonical column mappings',
    type: ColumnMappingDto,
  })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ColumnMappingDto)
  columnMapping?: ColumnMappingDto;

  @ApiPropertyOptional({
    description: 'Updated data source status',
    enum: DataSourceStatus,
    example: DataSourceStatus.ACTIVE,
  })
  @IsEnum(DataSourceStatus)
  @IsOptional()
  status?: DataSourceStatus;
}

export class QueryDataSourcesDto {
  @ApiPropertyOptional({
    enum: DataSourceType,
    description: 'Filter by source type',
  })
  @IsEnum(DataSourceType)
  @IsOptional()
  type?: DataSourceType;

  @ApiPropertyOptional({
    enum: DataSourceStatus,
    description: 'Filter by source status',
  })
  @IsEnum(DataSourceStatus)
  @IsOptional()
  status?: DataSourceStatus;

  @ApiPropertyOptional({
    description: 'Page number (starts at 1)',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size limit (max 100)',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

export interface PaginatedDataSourcesResponse {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
