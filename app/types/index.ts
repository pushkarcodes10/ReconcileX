export type TransactionStatus =
  | "IMPORTED"
  | "VALIDATED"
  | "MATCHED"
  | "POTENTIAL_MATCH"
  | "UNMATCHED"
  | "EXCEPTION"
  | "RESOLVED";

export type ExceptionStatus = "OPEN" | "ASSIGNED" | "UNDER_REVIEW" | "ESCALATED" | "RESOLVED" | "REOPENED";

export type ExceptionPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ReconciliationStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "RETRY";

export type UserRole = "ORG_ADMIN" | "FINANCE_MANAGER" | "FINANCE_ANALYST" | "AUDITOR";

export type DataSourceType = "BANK" | "PAYMENT_GATEWAY" | "INTERNAL_ORDERS" | "ACCOUNTING";

export interface Transaction {
  id: string;
  externalId: string;
  source: DataSourceType;
  amount: number;
  currency: string;
  date: string;
  status: TransactionStatus;
  matchConfidence?: number;
  matchReason?: string;
  reconciliationRunId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RelatedRecord {
  source: DataSourceType;
  transactionId: string;
  amount: number;
  currency: string;
  date: string;
  status: string;
  reference?: string;
  fields: Record<string, { value: string; matched: boolean }>;
}

export interface Exception {
  id: string;
  transactionId: string;
  type: "AMOUNT_MISMATCH" | "DATE_MISMATCH" | "MISSING_RECORD" | "DUPLICATE" | "REFERENCE_MISMATCH" | "CURRENCY_MISMATCH";
  priority: ExceptionPriority;
  status: ExceptionStatus;
  internalRecord: RelatedRecord;
  externalRecord: RelatedRecord | null;
  amountDifference?: number;
  dateDifference?: number;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolutionReason?: string;
  resolutionNotes?: string;
}

export interface ReconciliationRun {
  id: string;
  sourceA: DataSourceType;
  sourceB: DataSourceType;
  dateRange: { start: string; end: string };
  totalTransactions: number;
  matched: number;
  potentialMatches: number;
  unmatched: number;
  duplicates: number;
  errors: number;
  exceptions: number;
  matchRate: number;
  status: ReconciliationStatus;
  progress: number;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

export interface ImportJob {
  id: string;
  dataSource: DataSourceType;
  fileName: string;
  fileSize: number;
  rowCount: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  status: "UPLOADING" | "VALIDATING" | "NORMALIZING" | "DUPLICATE_DETECTION" | "READY" | "FAILED";
  progress: number;
  errors: ImportError[];
  createdAt: string;
  completedAt?: string;
}

export interface ImportError {
  row: number;
  field: string;
  error: string;
  value: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  organizationId: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: OrganizationSettings;
  createdAt: string;
}

export interface OrganizationSettings {
  matchingRules: MatchingRule[];
  dateToleranceDays: number;
  currency: string;
  timezone: string;
  notifications: NotificationSettings;
}

export interface MatchingRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: RuleCondition[];
}

export interface RuleCondition {
  field: string;
  operator: "equals" | "contains" | "fuzzy" | "date_range" | "amount_range";
  value: string | number;
  weight: number;
}

export interface NotificationSettings {
  email: boolean;
  inApp: boolean;
  slack: boolean;
  teams: boolean;
  reconciliationComplete: boolean;
  exceptionAssigned: boolean;
  importFailed: boolean;
}

export interface Report {
  id: string;
  name: string;
  type: "DAILY_RECONCILIATION" | "MONTHLY_RECONCILIATION" | "EXCEPTION_SUMMARY" | "MISMATCH_REPORT" | "AUDIT_TRAIL";
  dateRange: { start: string; end: string };
  status: "GENERATING" | "READY" | "FAILED";
  fileUrl?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "RECONCILIATION_COMPLETE" | "EXCEPTION_ASSIGNED" | "IMPORT_VALIDATION_FAILED" | "EXCEPTIONS_REQUIRE_ATTENTION" | "JOB_FAILED";
  title: string;
  message: string;
  read: boolean;
  entityId?: string;
  entityType?: string;
  createdAt: string;
}

export interface KPIMetric {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
}