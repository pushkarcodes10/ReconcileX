/**
 * Transaction input model compatible with ReconcileX transaction catalog (A3/A4).
 * All monetary amounts are represented in integer minor units (e.g. cents/paise).
 */
export interface MatchTransaction {
  id: string;
  amountMinor: number;
  currency: string;
  transactionDate: Date | string;
  reference?: string | null;
  externalId?: string | null;
  externalTxnId?: string | null;
  merchantOrOrderId?: string | null;
  txnType?: string | null;
}

/**
 * Match confidence classification tiers.
 */
export type MatchClassification = 'EXACT' | 'POTENTIAL_STRONG' | 'POTENTIAL' | 'NO_MATCH';

/**
 * Standardized, explainable reason codes for match decisions.
 */
export type MatchReason =
  | 'REFERENCE'
  | 'REFERENCE_SIMILAR'
  | 'AMOUNT'
  | 'DATE'
  | 'EXTERNAL_IDENTIFIER'
  | 'CURRENCY_MISMATCH';

/**
 * Breakdown of individual scoring contributions.
 */
export interface ScoringContributions {
  amount: number;
  date: number;
  reference: number;
  externalIdentifier: number;
}

/**
 * Diagnostic and explainable metadata generated during pairwise scoring.
 */
export interface ScoreExplanationMetadata {
  currencyMatch: boolean;
  amountDeltaMinor: number;
  dateDifferenceDays: number | null;
  referenceRelation: 'EXACT' | 'SIMILAR' | 'NONE';
  externalIdentifierMatch: boolean;
  matchedIdentifierValue?: string;
}

/**
 * Result structure returned by `scorePair`.
 */
export interface ScorePairResult {
  score: number; // Clamped to [0, 100]
  isEligible: boolean; // false on currency mismatch or unparseable date
  classification: MatchClassification;
  contributions: ScoringContributions;
  reasons: MatchReason[];
  dateDifferenceDays: number | null;
  metadata: ScoreExplanationMetadata;
}

/**
 * A greedy matched pair produced by `matchTwoSets`.
 */
export interface AcceptedMatch {
  transactionAId: string;
  transactionBId: string;
  transactionA: MatchTransaction;
  transactionB: MatchTransaction;
  classification: MatchClassification;
  score: number;
  reasons: MatchReason[];
  contributions: ScoringContributions;
  dateDifferenceDays: number | null;
  metadata: ScoreExplanationMetadata;
}

/**
 * Aggregate reconciliation run metrics.
 */
export interface MatchStatistics {
  totalA: number;
  totalB: number;
  exactMatches: number;
  potentialStrongMatches: number;
  potentialMatches: number;
  totalAcceptedMatches: number;
  unmatchedACount: number;
  unmatchedBCount: number;
}

/**
 * Result structure returned by `matchTwoSets`.
 */
export interface MatchTwoSetsResult {
  acceptedMatches: AcceptedMatch[];
  unmatchedIdsA: string[];
  unmatchedIdsB: string[];
  unmatchedA: MatchTransaction[];
  unmatchedB: MatchTransaction[];
  statistics: MatchStatistics;
}

/**
 * Three-source reconciliation classification statuses.
 */
export type ThreeSourceClassification =
  | 'FULLY_MATCHED'
  | 'PARTIALLY_MATCHED'
  | 'AMOUNT_MISMATCH'
  | 'DATE_MISMATCH'
  | 'REFERENCE_MISMATCH'
  | 'POTENTIAL_MATCH'
  | 'UNMATCHED'
  | 'DUPLICATE_QUARANTINED';

export type SourceStatusType = 'MATCHED' | 'MISSING' | 'MISMATCH' | 'QUARANTINED';

export interface DiscrepancyDetail {
  type: 'AMOUNT' | 'DATE' | 'REFERENCE' | 'CURRENCY' | 'MISSING_SOURCE';
  field: string;
  expected?: any;
  actual?: any;
  difference?: any;
  message: string;
}

export interface ThreeSourceMatchGroup {
  id: string;
  reconciliationType: 'THREE_SOURCE';
  classification: ThreeSourceClassification;
  score: number;
  confidence: number;
  reasons: string[];
  explanation: string;
  discrepancies: DiscrepancyDetail[];
  transactionAId?: string | null;
  transactionBId?: string | null;
  transactionCId?: string | null;
  transactionA?: MatchTransaction | null;
  transactionB?: MatchTransaction | null;
  transactionC?: MatchTransaction | null;
  sourceStatus: {
    sourceA: SourceStatusType;
    sourceB: SourceStatusType;
    sourceC: SourceStatusType;
  };
}

export interface QuarantinedDuplicate {
  source: 'A' | 'B' | 'C';
  transaction: MatchTransaction;
  reason: string;
}

export interface ThreeSourceStatistics {
  totalA: number;
  totalB: number;
  totalC: number;
  fullyMatchedCount: number;
  partiallyMatchedCount: number;
  amountMismatchCount: number;
  dateMismatchCount: number;
  referenceMismatchCount: number;
  potentialMatchCount: number;
  unmatchedCount: number;
  quarantinedCount: number;
  matchRate: number;
}

export interface MatchThreeSetsResult {
  matchGroups: ThreeSourceMatchGroup[];
  unmatchedA: MatchTransaction[];
  unmatchedB: MatchTransaction[];
  unmatchedC: MatchTransaction[];
  quarantinedDuplicates: QuarantinedDuplicate[];
  statistics: ThreeSourceStatistics;
}
