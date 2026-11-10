// ReconcileX API Data Contracts & Types

export type UserRole = 'ADMIN' | 'FINANCE_MANAGER' | 'ANALYST' | 'AUDITOR';

export interface User {
  id: string;
  email: string;
  name: string;
  status: string;
}

export interface Membership {
  membershipId: string;
  organizationId: string;
  orgName: string;
  orgSlug: string;
  role: UserRole;
}

export interface AuthMeResponse {
  user: User;
  memberships: Membership[];
}

export interface RegisterResponse {
  user: User;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface LoginResponse {
  user: User;
  memberships: Membership[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrganizationMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  joinedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: string;
  inviteToken: string;
}

export type DataSourceType = 'INTERNAL_ORDERS' | 'PAYMENT_GATEWAY' | 'BANK' | 'SCREENSHOT' | 'OTHER';
export type DataSourceStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface ColumnMapping {
  external_id: string;
  amount: string;
  date: string;
  currency: string;
  reference?: string;
  external_txn_id?: string;
  merchant_or_order_id?: string;
  txn_type?: string;
}

export interface DataSource {
  id: string;
  organizationId: string;
  name: string;
  type: DataSourceType;
  status: DataSourceStatus;
  columnMapping: ColumnMapping;
  direction?: 'INBOUND' | 'OUTBOUND' | 'NEUTRAL';
  createdAt: string;
  updatedAt?: string;
}

export type ImportStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ImportRecord {
  id: string;
  organizationId: string;
  dataSourceId: string;
  status: ImportStatus;
  totalRecords?: number;
  validRecords?: number;
  invalidRecords?: number;
  duplicateRecords?: number;
  rowCount?: number;
  validCount?: number;
  invalidCount?: number;
  duplicateCount?: number;
  duplicateFile?: boolean | string;
  errorSummary?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface ImportError {
  id?: string;
  rowNumber: number;
  field: string;
  code: string;
  rawValue: string;
  message: string;
}

export type DuplicateStatus = 'FLAGGED' | 'DISMISSED' | 'CONFIRMED_DUPLICATE';

export interface DuplicateCandidate {
  id: string;
  organizationId: string;
  importId: string;
  transactionId: string;
  duplicateOfId: string;
  status: DuplicateStatus;
  confidenceScore: number;
  reasons: string[];
  createdAt: string;
  transaction?: Transaction;
  duplicateOfTransaction?: Transaction;
}

export type TransactionStatus =
  | 'IMPORTED'
  | 'VALIDATED'
  | 'UNMATCHED'
  | 'MATCHED'
  | 'POTENTIAL_MATCH'
  | 'EXCEPTION'
  | 'RESOLVED';

export interface Transaction {
  id: string;
  organizationId: string;
  dataSourceId: string;
  importId?: string;
  externalId: string;
  amountMinor: number;
  currency: string;
  transactionDate: string;
  status: TransactionStatus;
  reference?: string;
  externalTxnId?: string;
  merchantOrOrderId?: string;
  txnType?: string;
  screenshotFileId?: string | null;
  screenshotPreviewUrl?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

export type ReconciliationRunStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type ReconciliationType = 'TWO_SOURCE' | 'THREE_SOURCE' | 'FOUR_SOURCE';

export interface ReconciliationRunConfig {
  dateWindowDays?: number;
  dateToleranceDays?: number;
  potentialThreshold?: number;
  exactThreshold?: number;
  reconciliationType?: ReconciliationType;
  sourceAId?: string;
  sourceBId?: string;
  sourceCId?: string;
  sourceDId?: string;
  sourceAName?: string;
  sourceBName?: string;
  sourceCName?: string;
  sourceDName?: string;
  [key: string]: any;
}

export interface ReconciliationRun {
  id: string;
  organizationId: string;
  reconciliationType?: ReconciliationType;
  sourceA: string;
  sourceB: string;
  sourceC?: string | null;
  sourceCId?: string | null;
  sourceD?: string | null;
  sourceDId?: string | null;
  dateFrom: string;
  dateTo: string;
  status: ReconciliationRunStatus;
  config?: ReconciliationRunConfig;
  totalTransactionsA: number;
  totalTransactionsB: number;
  totalTransactionsC?: number;
  totalTransactionsD?: number;
  totalSourceA?: number;
  totalSourceB?: number;
  totalSourceC?: number;
  totalSourceD?: number;
  exactMatchesCount: number;
  potentialMatchesCount: number;
  unmatchedCount: number;
  fullyMatchedCount?: number;
  partiallyMatchedCount?: number;
  discrepancyCount?: number;
  exactMatchCount?: number;
  potentialMatchCount?: number;
  createdAt: string;
  updatedAt?: string;
  sourceAName?: string;
  sourceBName?: string;
  sourceCName?: string | null;
  sourceDName?: string | null;
}

export type MatchClassification =
  | 'EXACT'
  | 'POTENTIAL'
  | 'FULLY_MATCHED'
  | 'PARTIALLY_MATCHED'
  | 'AMOUNT_MISMATCH'
  | 'DATE_MISMATCH'
  | 'REFERENCE_MISMATCH'
  | 'POTENTIAL_MATCH'
  | 'UNMATCHED'
  | 'DUPLICATE_QUARANTINED';

export type MatchStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface DiscrepancyDetail {
  type:
    | 'AMOUNT'
    | 'DATE'
    | 'REFERENCE'
    | 'MISSING_SOURCE'
    | 'AMOUNT_MISMATCH'
    | 'DATE_MISMATCH'
    | 'REFERENCE_MISMATCH';
  field: string;
  expected?: any;
  actual?: any;
  difference?: any;
  message?: string;
  description?: string;
  missingSource?: 'SOURCE_A' | 'SOURCE_B' | 'SOURCE_C';
}

export interface MatchRecord {
  id: string;
  runId: string;
  reconciliationType?: ReconciliationType;
  classification: MatchClassification;
  status: MatchStatus;
  score: number;
  reasons: string[] | Record<string, unknown>;
  rejectionReason?: string;
  discrepancyDetails?: DiscrepancyDetail[] | null;
  transactionA?: Transaction | null;
  transactionB?: Transaction | null;
  transactionC?: Transaction | null;
  transactionD?: Transaction | null;
  createdAt: string;
  updatedAt?: string;
}

export type ExceptionStatus = 'OPEN' | 'ASSIGNED' | 'UNDER_REVIEW' | 'ESCALATED' | 'RESOLVED';

export type ExceptionAction = 'START_REVIEW' | 'ESCALATE' | 'RESOLVE' | 'REOPEN';

export type ResolutionAction =
  | 'MANUALLY_RECONCILED'
  | 'CONFIRMED_DUPLICATE'
  | 'TRANSACTION_NOT_FOUND'
  | 'DATA_CORRECTION'
  | 'OTHER';

export interface ExceptionComment {
  id: string;
  exceptionId: string;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
}

export interface ExceptionRecord {
  id: string;
  organizationId: string;
  runId: string;
  transactionId: string;
  matchId?: string | null;
  exceptionType?: string | null;
  discrepancyDetails?: DiscrepancyDetail[] | null;
  status: ExceptionStatus;
  assigneeId?: string;
  assigneeName?: string;
  resolutionReason?: string;
  resolutionAction?: ResolutionAction;
  resolvedAt?: string;
  comments?: ExceptionComment[];
  transaction?: Transaction;
  createdAt: string;
  updatedAt?: string;
}

export type ScreenshotDatasetStatus = 'PROCESSING' | 'REVIEW_REQUIRED' | 'READY' | 'FAILED';
export type ScreenshotFileStatus = 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'FAILED';

export interface ScreenshotFile {
  id: string;
  organizationId: string;
  datasetId: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  contentSha256: string;
  status: ScreenshotFileStatus;
  rawOcrText?: string | null;
  extractedCount: number;
  previewUrl?: string | null;
  createdAt: string;
}

export interface ScreenshotExtractedRecord {
  id: string;
  organizationId: string;
  datasetId: string;
  screenshotFileId: string;
  externalId: string;
  amount: number;
  amountMinor: number;
  currency: string;
  transactionDate: string;
  reference?: string | null;
  externalTxnId?: string | null;
  merchantOrOrderId?: string | null;
  txnType?: string | null;
  paymentMethod?: string | null;
  senderReceiver?: string | null;
  description?: string | null;
  confidenceScore: number;
  fieldConfidences?: Record<string, number> | null;
  isDuplicate: boolean;
  isLowConfidence: boolean;
  validationErrors?: string[] | null;
  userCorrected: boolean;
  userCorrectionHistory?: Array<Record<string, unknown>> | null;
  transactionId?: string | null;
  screenshotPreviewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenshotDatasetDetail {
  id: string;
  organizationId: string;
  dataSourceId?: string | null;
  name: string;
  status: ScreenshotDatasetStatus;
  totalFiles: number;
  totalRecords: number;
  confirmedRecords: number;
  metadata?: Record<string, unknown> | null;
  confirmedById?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  files?: ScreenshotFile[];
  records?: ScreenshotExtractedRecord[];
}

export interface UpdateExtractedRecordPayload {
  externalId?: string;
  amount?: number;
  currency?: string;
  transactionDate?: string;
  reference?: string;
  externalTxnId?: string;
  merchantOrOrderId?: string;
  txnType?: string;
  paymentMethod?: string;
  senderReceiver?: string;
  description?: string;
}

export interface ConfirmDatasetPayload {
  dataSourceName?: string;
  dataSourceId?: string;
}

export interface DashboardSummary {
  totalTransactions: number;
  totalReconciliationRuns: number;
  completedRuns: number;
  failedRuns: number;
  runningRuns: number;
  totalMatchedTransactions: number;
  totalUnmatchedTransactions: number;
  totalPotentialMatches: number;
  totalOpenExceptions: number;
  totalAssignedExceptions: number;
  totalExceptionsUnderReview: number;
  totalEscalatedExceptions: number;
  totalResolvedExceptions: number;
}

export interface DashboardReconciliation {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  runningRuns: number;
  matchCounts: {
    exact: number;
    potential: number;
    confirmed: number;
    rejected: number;
  };
  recentRuns: ReconciliationRun[];
}

export interface DashboardExceptions {
  byStatus: Record<string, number>;
  unassignedCount: number;
  byAssignee: Array<{
    assigneeId: string;
    assigneeName: string;
    count: number;
  }>;
  recentCreated: ExceptionRecord[];
  recentResolved: ExceptionRecord[];
}

export interface AuditLog {
  id: string;
  organizationId: string;
  actorId?: string | null;
  actorType?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export type JobType = 'RECONCILIATION_RUN' | 'CSV_IMPORT';
export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface JobRecord {
  id: string;
  organizationId: string;
  jobType: JobType;
  status: JobStatus;
  progress: number;
  message?: string;
  result?: any;
  error?: any;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore?: boolean;
}
