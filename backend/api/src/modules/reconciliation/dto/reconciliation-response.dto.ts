import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchClassification, MatchStatus, ReconciliationRunStatus } from '@reconcilex/db';

export class DataSourceSummaryDto {
  @ApiProperty({ description: 'Data source UUID' })
  id!: string;

  @ApiProperty({ description: 'Data source name' })
  name!: string;

  @ApiProperty({ description: 'Data source type' })
  type!: string;

  @ApiProperty({ description: 'Data source status' })
  status!: string;
}

export class ReconciliationRunItemDto {
  @ApiProperty({ description: 'Run UUID' })
  id!: string;

  @ApiProperty({ description: 'Human-readable Run ID (e.g. RUN-20261103-001)' })
  displayId!: string;

  @ApiProperty({ description: 'Reconciliation run type (TWO_SOURCE or THREE_SOURCE)' })
  reconciliationType?: string;

  @ApiProperty({ description: 'Organization UUID' })
  organizationId!: string;

  @ApiProperty({ description: 'Source A UUID' })
  sourceAId!: string;

  @ApiProperty({ description: 'Source B UUID' })
  sourceBId!: string;

  @ApiPropertyOptional({ description: 'Source C UUID' })
  sourceCId?: string | null;

  @ApiProperty({ description: 'Run processing status', enum: ReconciliationRunStatus })
  status!: string;

  @ApiProperty({ description: 'Run start timestamp' })
  startedAt!: Date;

  @ApiPropertyOptional({ description: 'Run completion timestamp' })
  completedAt?: Date | null;

  @ApiProperty({ description: 'Matching configuration snapshot' })
  config!: Record<string, unknown>;

  @ApiProperty({ description: 'Total eligible transactions loaded from Source A' })
  totalSourceA!: number;

  @ApiProperty({ description: 'Total eligible transactions loaded from Source B' })
  totalSourceB!: number;

  @ApiPropertyOptional({ description: 'Total eligible transactions loaded from Source C' })
  totalSourceC?: number;

  @ApiProperty({ description: 'Number of exact matches found' })
  exactMatchCount!: number;

  @ApiProperty({ description: 'Number of potential matches found' })
  potentialMatchCount!: number;

  @ApiPropertyOptional({ description: 'Number of fully matched groups across 3 sources' })
  fullyMatchedCount?: number;

  @ApiPropertyOptional({ description: 'Number of partially matched groups across 3 sources' })
  partiallyMatchedCount?: number;

  @ApiPropertyOptional({ description: 'Number of discrepancy groups across 3 sources' })
  discrepancyCount?: number;

  @ApiProperty({ description: 'Number of unmatched transactions' })
  unmatchedCount!: number;

  @ApiPropertyOptional({ description: 'UUID of user who initiated the run' })
  createdBy?: string | null;

  @ApiProperty({ description: 'Run creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Run last updated timestamp' })
  updatedAt!: Date;
}

export class ReconciliationRunDetailDto extends ReconciliationRunItemDto {
  @ApiProperty({ description: 'Summary details of Data Source A' })
  sourceA!: DataSourceSummaryDto;

  @ApiProperty({ description: 'Summary details of Data Source B' })
  sourceB!: DataSourceSummaryDto;

  @ApiPropertyOptional({ description: 'Summary details of Data Source C' })
  sourceC?: DataSourceSummaryDto | null;
}

export class MatchedTransactionDetailDto {
  @ApiProperty({ description: 'Transaction UUID' })
  id!: string;

  @ApiProperty({ description: 'Data source UUID' })
  dataSourceId!: string;

  @ApiProperty({ description: 'External source transaction ID' })
  externalId!: string;

  @ApiProperty({ description: 'Transaction amount in minor currency units' })
  amountMinor!: number;

  @ApiProperty({ description: 'Currency code (ISO 4217)' })
  currency!: string;

  @ApiProperty({ description: 'Transaction date' })
  transactionDate!: Date;

  @ApiPropertyOptional({ description: 'Reconciliation reference code' })
  reference?: string | null;

  @ApiPropertyOptional({ description: 'Secondary external transaction reference' })
  externalTxnId?: string | null;

  @ApiPropertyOptional({ description: 'Merchant or order ID' })
  merchantOrOrderId?: string | null;

  @ApiPropertyOptional({ description: 'Transaction classification type' })
  txnType?: string | null;

  @ApiProperty({ description: 'Current transaction status' })
  status!: string;
}

export class MatchDetailDto {
  @ApiProperty({ description: 'Match UUID' })
  id!: string;

  @ApiProperty({ description: 'Organization UUID' })
  organizationId!: string;

  @ApiProperty({ description: 'Reconciliation Run UUID' })
  runId!: string;

  @ApiPropertyOptional({ description: 'Reconciliation type (TWO_SOURCE or THREE_SOURCE)' })
  reconciliationType?: string;

  @ApiPropertyOptional({ description: 'Transaction A UUID' })
  transactionAId?: string | null;

  @ApiPropertyOptional({ description: 'Transaction B UUID' })
  transactionBId?: string | null;

  @ApiPropertyOptional({ description: 'Transaction C UUID' })
  transactionCId?: string | null;

  @ApiProperty({ description: 'Match confidence classification', enum: MatchClassification })
  classification!: MatchClassification;

  @ApiProperty({ description: 'Match score (0-100)' })
  score!: number;

  @ApiProperty({ description: 'Explainable reason codes and scoring breakdown' })
  reasons!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Structured discrepancy breakdown across sources' })
  discrepancyDetails?: Record<string, unknown> | Array<unknown> | null;

  @ApiProperty({ description: 'Match review status', enum: MatchStatus })
  status!: MatchStatus;

  @ApiPropertyOptional({ description: 'UUID of analyst who confirmed the match' })
  confirmedBy?: string | null;

  @ApiPropertyOptional({ description: 'Timestamp when match was confirmed' })
  confirmedAt?: Date | null;

  @ApiPropertyOptional({ description: 'UUID of analyst who rejected the match' })
  rejectedBy?: string | null;

  @ApiPropertyOptional({ description: 'Timestamp when match was rejected' })
  rejectedAt?: Date | null;

  @ApiProperty({ description: 'Match record creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Match record update timestamp' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Details of Transaction A' })
  transactionA?: MatchedTransactionDetailDto | null;

  @ApiPropertyOptional({ description: 'Details of Transaction B' })
  transactionB?: MatchedTransactionDetailDto | null;

  @ApiPropertyOptional({ description: 'Details of Transaction C' })
  transactionC?: MatchedTransactionDetailDto | null;
}

export class UnmatchedTransactionItemDto {
  @ApiProperty({ description: 'Transaction UUID' })
  id!: string;

  @ApiProperty({ description: 'Data Source UUID' })
  sourceId!: string;

  @ApiProperty({ description: 'External source transaction ID' })
  externalId!: string;

  @ApiProperty({ description: 'Amount in minor units' })
  amountMinor!: number;

  @ApiProperty({ description: 'Currency code (ISO 4217)' })
  currency!: string;

  @ApiProperty({ description: 'Transaction date' })
  transactionDate!: Date;

  @ApiPropertyOptional({ description: 'Reference code' })
  reference?: string | null;

  @ApiProperty({ description: 'Current reconciliation status' })
  status!: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export class CreateReconciliationRunResponseDto {
  @ApiProperty({ description: 'Job UUID' })
  jobId!: string;

  @ApiProperty({ description: 'Reconciliation Run UUID' })
  runId!: string;

  @ApiProperty({ description: 'Run status', enum: ReconciliationRunStatus })
  status!: string;

  @ApiProperty({ description: 'Reconciliation Run data' })
  run!: ReconciliationRunItemDto;
}
