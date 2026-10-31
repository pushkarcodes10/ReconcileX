import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataSourceStatus, DataSourceType } from '@reconcilex/db';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ColumnMappingDto {
  @ApiProperty({ description: 'CSV header name representing unique transaction ID', example: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  externalId: string;

  @ApiProperty({ description: 'CSV header name representing transaction amount', example: 'Gross Amount' })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({ description: 'CSV header name representing transaction date', example: 'Date' })
  @IsString()
  @IsNotEmpty()
  transactionDate: string;

  @ApiPropertyOptional({ description: 'CSV header name representing currency (or ISO default)', example: 'Currency' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'CSV header name representing reconciliation reference key', example: 'Customer Ref' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({ description: 'CSV header name representing secondary external transaction ID', example: 'Gateway Txn ID' })
  @IsString()
  @IsOptional()
  externalTxnId?: string;

  @ApiPropertyOptional({ description: 'CSV header name representing merchant or order identifier', example: 'Merchant Order ID' })
  @IsString()
  @IsOptional()
  merchantOrOrderId?: string;

  @ApiPropertyOptional({ description: 'CSV header name representing transaction type (CHARGE, REFUND, etc.)', example: 'Transaction Type' })
  @IsString()
  @IsOptional()
  txnType?: string;
}

export class CreateDataSourceDto {
  @ApiProperty({ description: 'Unique name of data source within organization', example: 'Shopify Store Orders' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Data source classification type',
    enum: DataSourceType,
    example: DataSourceType.INTERNAL_ORDERS,
  })
  @IsEnum(DataSourceType)
  type: DataSourceType;

  @ApiProperty({ description: 'Canonical column mappings for CSV headers', type: ColumnMappingDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ColumnMappingDto)
  columnMapping: ColumnMappingDto;

  @ApiPropertyOptional({ description: 'Data direction flow (defaults to INCOMING)', example: 'INCOMING' })
  @IsString()
  @IsOptional()
  direction?: string;
}

export class UpdateDataSourceDto {
  @ApiPropertyOptional({ description: 'Updated name of data source', example: 'Shopify Global Store Orders' })
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

  @ApiPropertyOptional({ description: 'Updated canonical column mappings', type: ColumnMappingDto })
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
