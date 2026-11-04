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

export type DataSourceType = 'INTERNAL_ORDERS' | 'PAYMENT_GATEWAY' | 'BANK' | 'OTHER';
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
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

export type ReconciliationRunStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ReconciliationRunConfig {
  dateWindowDays?: number;
  potentialThreshold?: number;
  exactThreshold?: number;
}

export interface ReconciliationRun {
  id: string;
  organizationId: string;
  sourceA: string;
  sourceB: string;
  dateFrom: string;
  dateTo: string;
  status: ReconciliationRunStatus;
  config?: ReconciliationRunConfig;
  totalTransactionsA: number;
  totalTransactionsB: number;
  exactMatchesCount: number;
  potentialMatchesCount: number;
  unmatchedCount: number;
  createdAt: string;
  updatedAt?: string;
  sourceAName?: string;
  sourceBName?: string;
}

export type MatchClassification = 'EXACT' | 'POTENTIAL';
export type MatchStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface MatchRecord {
  id: string;
  runId: string;
  classification: MatchClassification;
  status: MatchStatus;
  score: number;
  reasons: string[] | Record<string, unknown>;
  rejectionReason?: string;
  transactionA: Transaction;
  transactionB: Transaction;
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
