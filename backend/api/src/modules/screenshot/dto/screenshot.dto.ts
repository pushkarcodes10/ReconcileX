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

export class CreateScreenshotDatasetDto {
  @ApiProperty({ description: 'Dataset display name', example: 'Vendor Invoices Batch 1' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Optional target Data Source UUID if appending to existing source' })
  @IsUUID('4')
  @IsOptional()
  dataSourceId?: string;
}

export class UpdateExtractedRecordDto {
  @ApiPropertyOptional({ description: 'Corrected external transaction ID', example: 'ORD-9999' })
  @IsString()
  @IsOptional()
  externalId?: string;

  @ApiPropertyOptional({ description: 'Corrected monetary decimal amount', example: 1499.0 })
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: '3-letter currency code', example: 'INR' })
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'Currency must be 3-letter uppercase ISO code' })
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Transaction date (YYYY-MM-DD)', example: '2026-09-15' })
  @IsString()
  @IsOptional()
  transactionDate?: string;

  @ApiPropertyOptional({ description: 'Counterparty reference or order key' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({ description: 'External gateway transaction ID' })
  @IsString()
  @IsOptional()
  externalTxnId?: string;

  @ApiPropertyOptional({ description: 'Merchant or order ID' })
  @IsString()
  @IsOptional()
  merchantOrOrderId?: string;

  @ApiPropertyOptional({ description: 'Transaction type', example: 'PAYMENT' })
  @IsString()
  @IsOptional()
  txnType?: string;

  @ApiPropertyOptional({ description: 'Payment method (e.g. UPI, CARD, NETBANKING)' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Sender or receiver info' })
  @IsString()
  @IsOptional()
  senderReceiver?: string;

  @ApiPropertyOptional({ description: 'Transaction narration or notes' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class ConfirmDatasetDto {
  @ApiPropertyOptional({ description: 'Optional custom name for created data source' })
  @IsString()
  @IsOptional()
  dataSourceName?: string;

  @ApiPropertyOptional({ description: 'Optional existing Data Source UUID to attach to' })
  @IsUUID('4')
  @IsOptional()
  dataSourceId?: string;
}

export class ScreenshotFileDto {
  @ApiProperty({ description: 'File UUID' })
  id!: string;

  @ApiProperty({ description: 'Organization UUID' })
  organizationId!: string;

  @ApiProperty({ description: 'Dataset UUID' })
  datasetId!: string;

  @ApiProperty({ description: 'S3 storage object key' })
  storageKey!: string;

  @ApiProperty({ description: 'Original uploaded filename' })
  originalFilename!: string;

  @ApiProperty({ description: 'MIME type' })
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes' })
  fileSize!: number;

  @ApiProperty({ description: 'SHA-256 content checksum' })
  contentSha256!: string;

  @ApiProperty({ description: 'Processing status' })
  status!: string;

  @ApiPropertyOptional({ description: 'Raw extracted OCR text' })
  rawOcrText?: string | null;

  @ApiProperty({ description: 'Count of transactions extracted from file' })
  extractedCount!: number;

  @ApiPropertyOptional({ description: 'Presigned preview URL (time-limited)' })
  previewUrl?: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;
}

export class ScreenshotExtractedRecordDto {
  @ApiProperty({ description: 'Record UUID' })
  id!: string;

  @ApiProperty({ description: 'Organization UUID' })
  organizationId!: string;

  @ApiProperty({ description: 'Dataset UUID' })
  datasetId!: string;

  @ApiProperty({ description: 'Source Screenshot File UUID' })
  screenshotFileId!: string;

  @ApiProperty({ description: 'External transaction identifier' })
  externalId!: string;

  @ApiProperty({ description: 'Monetary amount' })
  amount!: number;

  @ApiProperty({ description: 'Amount in minor units' })
  amountMinor!: number;

  @ApiProperty({ description: 'Currency code' })
  currency!: string;

  @ApiProperty({ description: 'Transaction date' })
  transactionDate!: Date;

  @ApiPropertyOptional({ description: 'Reference key' })
  reference?: string | null;

  @ApiPropertyOptional({ description: 'External transaction ID' })
  externalTxnId?: string | null;

  @ApiPropertyOptional({ description: 'Merchant or Order ID' })
  merchantOrOrderId?: string | null;

  @ApiPropertyOptional({ description: 'Transaction type' })
  txnType?: string | null;

  @ApiPropertyOptional({ description: 'Payment method' })
  paymentMethod?: string | null;

  @ApiPropertyOptional({ description: 'Sender or Receiver details' })
  senderReceiver?: string | null;

  @ApiPropertyOptional({ description: 'Description or narration' })
  description?: string | null;

  @ApiProperty({ description: 'Confidence score (0-100)' })
  confidenceScore!: number;

  @ApiPropertyOptional({ description: 'Per-field confidence scores' })
  fieldConfidences?: Record<string, number> | null;

  @ApiProperty({ description: 'Whether this record is suspected to be duplicate' })
  isDuplicate!: boolean;

  @ApiProperty({ description: 'Whether record has low confidence or missing critical fields' })
  isLowConfidence!: boolean;

  @ApiPropertyOptional({ description: 'List of validation errors or warnings' })
  validationErrors?: string[] | null;

  @ApiProperty({ description: 'Whether an operator edited this record' })
  userCorrected!: boolean;

  @ApiPropertyOptional({ description: 'Audit history of user corrections' })
  userCorrectionHistory?: Array<Record<string, unknown>> | null;

  @ApiPropertyOptional({ description: 'Linked transaction ID once confirmed' })
  transactionId?: string | null;

  @ApiPropertyOptional({ description: 'Presigned preview URL of source screenshot' })
  screenshotPreviewUrl?: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}

export class ScreenshotDatasetDetailDto {
  @ApiProperty({ description: 'Dataset UUID' })
  id!: string;

  @ApiProperty({ description: 'Organization UUID' })
  organizationId!: string;

  @ApiPropertyOptional({ description: 'Associated Data Source UUID once confirmed' })
  dataSourceId?: string | null;

  @ApiProperty({ description: 'Dataset name' })
  name!: string;

  @ApiProperty({ description: 'Status: PROCESSING, REVIEW_REQUIRED, READY, or FAILED' })
  status!: string;

  @ApiProperty({ description: 'Total files uploaded' })
  totalFiles!: number;

  @ApiProperty({ description: 'Total extracted transaction records' })
  totalRecords!: number;

  @ApiProperty({ description: 'Total confirmed and ingested transactions' })
  confirmedRecords!: number;

  @ApiPropertyOptional({ description: 'Dataset metadata' })
  metadata?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'User who confirmed the dataset' })
  confirmedById?: string | null;

  @ApiPropertyOptional({ description: 'Confirmation timestamp' })
  confirmedAt?: Date | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Associated screenshot files', type: [ScreenshotFileDto] })
  files?: ScreenshotFileDto[];

  @ApiPropertyOptional({ description: 'Associated extracted records', type: [ScreenshotExtractedRecordDto] })
  records?: ScreenshotExtractedRecordDto[];
}
