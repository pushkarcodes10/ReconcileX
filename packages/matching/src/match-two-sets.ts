import {
  DEFAULT_MATCHING_CONFIG,
  MatchingConfig,
  PartialMatchingConfig,
  resolveAndValidateConfig,
} from './config';
import { normalizeCurrency } from './normalize';
import { scorePair } from './scoring';
import {
  AcceptedMatch,
  MatchClassification,
  MatchStatistics,
  MatchTransaction,
  MatchTwoSetsResult,
  ScorePairResult,
} from './types';

interface CandidatePair {
  transactionA: MatchTransaction;
  transactionB: MatchTransaction;
  scoreResult: ScorePairResult;
}

const CLASSIFICATION_WEIGHT: Record<MatchClassification, number> = {
  EXACT: 3,
  POTENTIAL_STRONG: 2,
  POTENTIAL: 1,
  NO_MATCH: 0,
};

/**
 * Reconciles two transaction arrays using deterministic rules and greedy 1:1 assignment.
 *
 * Requirements enforced:
 * - Does not mutate caller-supplied input arrays or transaction objects.
 * - Deduplicates transactions by ID within each set (keeping first occurrence) to preserve 1:1 ID integrity.
 * - Pre-filters cross-currency pairs (currencies must match).
 * - Excludes NO_MATCH candidate pairs.
 * - Sorts candidates deterministically by score DESC, classification DESC, dateDelta ASC, amountDelta ASC, and stable IDs.
 * - Enforces 1:1 matching cardinality (each transaction matches at most once).
 * - Computes complete statistics and unmatched lists.
 */
export function matchTwoSets(
  setA: readonly MatchTransaction[],
  setB: readonly MatchTransaction[],
  config?: PartialMatchingConfig | MatchingConfig,
): MatchTwoSetsResult {
  const resolvedConfig = config ? resolveAndValidateConfig(config) : DEFAULT_MATCHING_CONFIG;

  // Handle empty input edge cases
  if (!setA || setA.length === 0 || !setB || setB.length === 0) {
    const listA = setA ? [...setA] : [];
    const listB = setB ? [...setB] : [];
    return {
      acceptedMatches: [],
      unmatchedIdsA: listA.map((t) => t.id),
      unmatchedIdsB: listB.map((t) => t.id),
      unmatchedA: listA,
      unmatchedB: listB,
      statistics: {
        totalA: listA.length,
        totalB: listB.length,
        exactMatches: 0,
        potentialStrongMatches: 0,
        potentialMatches: 0,
        totalAcceptedMatches: 0,
        unmatchedACount: listA.length,
        unmatchedBCount: listB.length,
      },
    };
  }

  // Deduplicate input sets by ID (policy: first occurrence kept)
  const uniqueA: MatchTransaction[] = [];
  const seenIdsA = new Set<string>();
  for (const txn of setA) {
    if (!seenIdsA.has(txn.id)) {
      seenIdsA.add(txn.id);
      uniqueA.push(txn);
    }
  }

  const uniqueB: MatchTransaction[] = [];
  const seenIdsB = new Set<string>();
  for (const txn of setB) {
    if (!seenIdsB.has(txn.id)) {
      seenIdsB.add(txn.id);
      uniqueB.push(txn);
    }
  }

  // Generate candidate pairs
  const candidates: CandidatePair[] = [];

  for (const txnA of uniqueA) {
    const normCurA = normalizeCurrency(txnA.currency);
    for (const txnB of uniqueB) {
      const normCurB = normalizeCurrency(txnB.currency);
      // Fast path: currencies must match
      if (normCurA !== normCurB || normCurA.length === 0) {
        continue;
      }

      const scoreResult = scorePair(txnA, txnB, resolvedConfig);
      if (scoreResult.classification === 'NO_MATCH' || !scoreResult.isEligible) {
        continue;
      }

      candidates.push({
        transactionA: txnA,
        transactionB: txnB,
        scoreResult,
      });
    }
  }

  // Sort candidate pairs deterministically
  candidates.sort((a, b) => {
    // 1. Primary: Score descending
    if (b.scoreResult.score !== a.scoreResult.score) {
      return b.scoreResult.score - a.scoreResult.score;
    }

    // 2. Classification tier priority
    const priorityA = CLASSIFICATION_WEIGHT[a.scoreResult.classification];
    const priorityB = CLASSIFICATION_WEIGHT[b.scoreResult.classification];
    if (priorityB !== priorityA) {
      return priorityB - priorityA;
    }

    // 3. Proximity in date: smaller difference wins
    const dateDiffA = a.scoreResult.dateDifferenceDays ?? 999999;
    const dateDiffB = b.scoreResult.dateDifferenceDays ?? 999999;
    if (dateDiffA !== dateDiffB) {
      return dateDiffA - dateDiffB;
    }

    // 4. Proximity in amount: smaller delta wins
    const amtDeltaA = a.scoreResult.metadata.amountDeltaMinor;
    const amtDeltaB = b.scoreResult.metadata.amountDeltaMinor;
    if (amtDeltaA !== amtDeltaB) {
      return amtDeltaA - amtDeltaB;
    }

    // 5. Deterministic tie-breaker on transaction IDs
    const cmpA = a.transactionA.id.localeCompare(b.transactionA.id);
    if (cmpA !== 0) return cmpA;
    return a.transactionB.id.localeCompare(b.transactionB.id);
  });

  // Greedy 1:1 selection
  const matchedIdsA = new Set<string>();
  const matchedIdsB = new Set<string>();
  const acceptedMatches: AcceptedMatch[] = [];

  let exactMatches = 0;
  let potentialStrongMatches = 0;
  let potentialMatches = 0;

  for (const candidate of candidates) {
    const idA = candidate.transactionA.id;
    const idB = candidate.transactionB.id;

    if (matchedIdsA.has(idA) || matchedIdsB.has(idB)) {
      continue;
    }

    matchedIdsA.add(idA);
    matchedIdsB.add(idB);

    if (candidate.scoreResult.classification === 'EXACT') {
      exactMatches++;
    } else if (candidate.scoreResult.classification === 'POTENTIAL_STRONG') {
      potentialStrongMatches++;
    } else if (candidate.scoreResult.classification === 'POTENTIAL') {
      potentialMatches++;
    }

    acceptedMatches.push({
      transactionAId: idA,
      transactionBId: idB,
      transactionA: candidate.transactionA,
      transactionB: candidate.transactionB,
      classification: candidate.scoreResult.classification,
      score: candidate.scoreResult.score,
      reasons: candidate.scoreResult.reasons,
      contributions: candidate.scoreResult.contributions,
      dateDifferenceDays: candidate.scoreResult.dateDifferenceDays,
      metadata: candidate.scoreResult.metadata,
    });
  }

  const unmatchedA = uniqueA.filter((t) => !matchedIdsA.has(t.id));
  const unmatchedB = uniqueB.filter((t) => !matchedIdsB.has(t.id));

  const statistics: MatchStatistics = {
    totalA: setA.length,
    totalB: setB.length,
    exactMatches,
    potentialStrongMatches,
    potentialMatches,
    totalAcceptedMatches: acceptedMatches.length,
    unmatchedACount: unmatchedA.length,
    unmatchedBCount: unmatchedB.length,
  };

  return {
    acceptedMatches,
    unmatchedIdsA: unmatchedA.map((t) => t.id),
    unmatchedIdsB: unmatchedB.map((t) => t.id),
    unmatchedA,
    unmatchedB,
    statistics,
  };
}
