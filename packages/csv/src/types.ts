export const REQUIRED_CANONICAL_FIELDS = ['external_id', 'amount', 'date', 'currency'] as const;

export const OPTIONAL_CANONICAL_FIELDS = [
  'reference',
  'external_txn_id',
  'merchant_or_order_id',
  'txn_type',
] as const;

export const ALL_CANONICAL_FIELDS = [
  ...REQUIRED_CANONICAL_FIELDS,
  ...OPTIONAL_CANONICAL_FIELDS,
] as const;

export type CanonicalField = (typeof ALL_CANONICAL_FIELDS)[number];
export type RequiredCanonicalField = (typeof REQUIRED_CANONICAL_FIELDS)[number];

export type ColumnMapping = Record<string, string>;

export interface RowError {
  rowNumber: number;
  field?: string;
  code: string;
  rawValue?: string;
  message: string;
}

export interface NormalizedRow {
  rowNumber: number;
  externalId: string;
  amountMinor: number;
  currency: string;
  transactionDate: string; // ISO 'YYYY-MM-DD'
  reference?: string | null;
  externalTxnId?: string | null;
  merchantOrOrderId?: string | null;
  txnType?: string | null;
  fingerprint: string;
  normalizedPayload: Record<string, unknown>;
}

export interface StreamParseRowResult {
  rowNumber: number;
  normalizedRow?: NormalizedRow;
  errors?: RowError[];
}
