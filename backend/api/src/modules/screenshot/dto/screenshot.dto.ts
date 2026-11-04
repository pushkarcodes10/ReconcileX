import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class ExtractScreenshotResponseDto {
  @ApiProperty({ description: 'Detected monetary amount', example: 1499.0 })
  amount!: number;

  @ApiProperty({ description: 'Amount in minor units (e.g. paise / cents)', example: 149900 })
  amountMinor!: number;

  @ApiProperty({ description: '3-letter ISO currency code', example: 'INR' })
  currency!: string;

  @ApiProperty({ description: 'Normalized transaction date in YYYY-MM-DD format', example: '2026-09-02' })
  transactionDate!: string;

  @ApiProperty({ description: 'Extracted external ID or transaction reference', example: 'ORD-1002' })
  externalId!: string;

  @ApiPropertyOptional({ description: 'Extracted reference token', example: 'REF-1002' })
  reference?: string;

  @ApiPropertyOptional({ description: 'Gateway or payment reference ID', example: 'PG-TXN-7002' })
  externalTxnId?: string;

  @ApiPropertyOptional({ description: 'Merchant or order reference', example: 'ORD-1002' })
  merchantOrOrderId?: string;

  @ApiPropertyOptional({ description: 'Transaction type classification', example: 'PAYMENT' })
  txnType?: string;

  @ApiPropertyOptional({ description: 'Extracted merchant or recipient name / description' })
  description?: string;

  @ApiProperty({ description: 'Extraction confidence score (0-100)', example: 92 })
  confidenceScore!: number;

  @ApiProperty({ description: 'Raw OCR or vision text detected from image' })
  rawOcrText!: string;

  @ApiProperty({ description: 'Extraction mechanism used', enum: ['GEMINI_VISION', 'TESSERACT_OCR'] })
  extractionMethod!: 'GEMINI_VISION' | 'TESSERACT_OCR';
}

export class IngestScreenshotTransactionDto {
  @ApiProperty({ description: 'Target Data Source UUID to ingest the transaction into' })
  @IsUUID('4')
  @IsNotEmpty()
  dataSourceId!: string;

  @ApiProperty({ description: 'External transaction identifier', example: 'ORD-1002' })
  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @ApiProperty({ description: 'Monetary decimal amount', example: 1499.0 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: '3-letter currency code (e.g. INR, USD, EUR)', example: 'INR' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, { message: 'Currency must be a valid 3-letter ISO uppercase code' })
  currency!: string;

  @ApiProperty({ description: 'Transaction date (YYYY-MM-DD or ISO 8601)', example: '2026-09-02' })
  @IsString()
  @IsNotEmpty()
  transactionDate!: string;

  @ApiPropertyOptional({ description: 'Reference key for counterparty matching', example: 'ORD-1002' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({ description: 'External gateway transaction ID', example: 'PG-TXN-7002' })
  @IsString()
  @IsOptional()
  externalTxnId?: string;

  @ApiPropertyOptional({ description: 'Merchant or Order ID', example: 'ORD-1002' })
  @IsString()
  @IsOptional()
  merchantOrOrderId?: string;

  @ApiPropertyOptional({ description: 'Transaction type', example: 'PAYMENT' })
  @IsString()
  @IsOptional()
  txnType?: string;

  @ApiPropertyOptional({ description: 'Additional metadata or description', type: Object })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class IngestScreenshotResponseDto {
  @ApiProperty({ description: 'Transaction UUID created in the ledger' })
  id!: string;

  @ApiProperty({ description: 'Organization UUID' })
  organizationId!: string;

  @ApiProperty({ description: 'Data Source UUID' })
  dataSourceId!: string;

  @ApiProperty({ description: 'External Transaction ID' })
  externalId!: string;

  @ApiProperty({ description: 'Amount in minor units' })
  amountMinor!: number;

  @ApiProperty({ description: 'Currency' })
  currency!: string;

  @ApiProperty({ description: 'Transaction Date' })
  transactionDate!: Date;

  @ApiProperty({ description: 'Transaction Status in ledger', example: 'UNMATCHED' })
  status!: string;

  @ApiPropertyOptional({ description: 'Reference key' })
  reference?: string | null;

  @ApiProperty({ description: 'Timestamp when transaction was created' })
  createdAt!: Date;

  @ApiProperty({ description: 'Success message' })
  message!: string;
}
