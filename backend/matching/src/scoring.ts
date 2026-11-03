import {
  DEFAULT_MATCHING_CONFIG,
  MatchingConfig,
  PartialMatchingConfig,
  resolveAndValidateConfig,
} from './config';
import { classify } from './classify';
import { normalizeCurrency, normalizeIdentifier, normalizeReference } from './normalize';
import {
  MatchReason,
  MatchTransaction,
  ScoreExplanationMetadata,
  ScorePairResult,
  ScoringContributions,
} from './types';
import { calculateDateDifferenceDays } from './utils/date-difference';

/**
 * Calculates date scoring contribution based on deterministic linear taper formula:
 * - Difference 0 (same calendar day): returns full date weight.
 * - Difference d within tolerance [1, toleranceDays]:
 *   tapers linearly: Math.round(maxDateWeight * (1 - d / (toleranceDays + 1)))
 * - Difference > toleranceDays or invalid: returns 0.
 *
 * For default tolerance = 2 days and maxDateWeight = 20:
 * - 0 days diff: 20 pts
 * - 1 day diff:  13 pts (Math.round(20 * (1 - 1/3)) = 13)
 * - 2 days diff: 7 pts  (Math.round(20 * (1 - 2/3)) = 7)
 * - > 2 days:    0 pts
 */
export function calculateDateScore(
  dateDifferenceDays: number,
  toleranceDays: number,
  maxDateWeight: number,
): number {
  if (isNaN(dateDifferenceDays) || dateDifferenceDays < 0 || dateDifferenceDays > toleranceDays) {
    return 0;
  }
  if (toleranceDays === 0) {
    return dateDifferenceDays === 0 ? maxDateWeight : 0;
  }
  if (dateDifferenceDays === 0) {
    return maxDateWeight;
  }

  const score = Math.round(maxDateWeight * (1 - dateDifferenceDays / (toleranceDays + 1)));
  return Math.max(0, Math.min(maxDateWeight, score));
}

/**
 * Deterministically scores a candidate pair of transactions based on explainable business rules.
 *
 * Rules:
 * 1. Currency Mismatch: Ineligible, score = 0, reason = CURRENCY_MISMATCH.
 * 2. Exact Reference and Amount: Score = 100, classification = EXACT, reasons = [REFERENCE, AMOUNT].
 * 3. Exact Amount: +30 points (configured amount weight).
 * 4. Date Tolerance: Up to +20 points with linear taper for 0..toleranceDays.
 * 5. Reference: +50 for exact normalized match, +30 for substring containment similarity.
 * 6. External Identifiers: Up to +20 for matching external ID or merchant/order ID.
 */
export function scorePair(
  transactionA: MatchTransaction,
  transactionB: MatchTransaction,
  config?: PartialMatchingConfig | MatchingConfig,
): ScorePairResult {
  const resolvedConfig = config ? resolveAndValidateConfig(config) : DEFAULT_MATCHING_CONFIG;

  const { weights, dateToleranceDays } = resolvedConfig;

  // Currency normalization and comparison
  const currencyA = normalizeCurrency(transactionA.currency);
  const currencyB = normalizeCurrency(transactionB.currency);
  const currencyMatch = currencyA.length > 0 && currencyB.length > 0 && currencyA === currencyB;

  const amountDeltaMinor = Math.abs(transactionA.amountMinor - transactionB.amountMinor);
  const dateDifferenceDays = calculateDateDifferenceDays(
    transactionA.transactionDate,
    transactionB.transactionDate,
  );
  const isDateValid = !isNaN(dateDifferenceDays);

  // Rule 1: Currency Mismatch Barrier
  if (!currencyMatch) {
    const emptyContributions: ScoringContributions = {
      amount: 0,
      date: 0,
      reference: 0,
      externalIdentifier: 0,
    };
    const metadata: ScoreExplanationMetadata = {
      currencyMatch: false,
      amountDeltaMinor,
      dateDifferenceDays: isDateValid ? dateDifferenceDays : null,
      referenceRelation: 'NONE',
      externalIdentifierMatch: false,
    };
    return {
      score: 0,
      isEligible: false,
      classification: 'NO_MATCH',
      contributions: emptyContributions,
      reasons: ['CURRENCY_MISMATCH'],
      dateDifferenceDays: isDateValid ? dateDifferenceDays : null,
      metadata,
    };
  }

  // Normalization
  const normRefA = normalizeReference(transactionA.reference);
  const normRefB = normalizeReference(transactionB.reference);

  let referenceRelation: 'EXACT' | 'SIMILAR' | 'NONE' = 'NONE';
  let refPoints = 0;

  if (normRefA !== undefined && normRefB !== undefined) {
    if (normRefA === normRefB) {
      referenceRelation = 'EXACT';
      refPoints = weights.reference;
    } else if (
      (normRefA.includes(normRefB) || normRefB.includes(normRefA)) &&
      Math.min(normRefA.length, normRefB.length) >= 3
    ) {
      referenceRelation = 'SIMILAR';
      refPoints = weights.referenceSimilar ?? 30;
    }
  }

  const isExactAmount = amountDeltaMinor === 0;
  const amountPoints = isExactAmount ? weights.amount : 0;

  const datePoints = isDateValid
    ? calculateDateScore(dateDifferenceDays, dateToleranceDays, weights.date)
    : 0;

  // External identifiers & merchant/order IDs comparison
  const idsA = [
    normalizeIdentifier(transactionA.externalId),
    normalizeIdentifier(transactionA.externalTxnId),
    normalizeIdentifier(transactionA.merchantOrOrderId),
  ].filter((id): id is string => typeof id === 'string' && id.length >= 2);

  const idsB = [
    normalizeIdentifier(transactionB.externalId),
    normalizeIdentifier(transactionB.externalTxnId),
    normalizeIdentifier(transactionB.merchantOrOrderId),
  ].filter((id): id is string => typeof id === 'string' && id.length >= 2);

  let externalIdentifierMatch = false;
  let matchedIdentifierValue: string | undefined;

  // Compare direct external identifiers between A and B
  for (const idA of idsA) {
    if (idsB.includes(idA)) {
      externalIdentifierMatch = true;
      matchedIdentifierValue = idA;
      break;
    }
  }

  // Cross-reference checks (e.g. gateway reference matches order ID)
  if (!externalIdentifierMatch) {
    if (normRefA && idsB.includes(normRefA)) {
      externalIdentifierMatch = true;
      matchedIdentifierValue = normRefA;
    } else if (normRefB && idsA.includes(normRefB)) {
      externalIdentifierMatch = true;
      matchedIdentifierValue = normRefB;
    }
  }

  const extPoints = externalIdentifierMatch ? weights.externalIdentifier : 0;

  // Rule 2: Exact Reference + Exact Amount Shortcut
  // If both normalized references are identical and amounts are identical, score is 100 (EXACT)
  if (referenceRelation === 'EXACT' && isExactAmount) {
    const contributions: ScoringContributions = {
      amount: amountPoints,
      date: datePoints,
      reference: refPoints,
      externalIdentifier: extPoints,
    };
    const metadata: ScoreExplanationMetadata = {
      currencyMatch: true,
      amountDeltaMinor: 0,
      dateDifferenceDays: isDateValid ? dateDifferenceDays : null,
      referenceRelation: 'EXACT',
      externalIdentifierMatch,
      matchedIdentifierValue,
    };
    return {
      score: 100,
      isEligible: true,
      classification: 'EXACT',
      contributions,
      reasons: ['REFERENCE', 'AMOUNT'],
      dateDifferenceDays: isDateValid ? dateDifferenceDays : null,
      metadata,
    };
  }

  // Multi-Attribute Score Combination
  const rawScore = amountPoints + datePoints + refPoints + extPoints;
  const finalScore = Math.min(100, Math.max(0, rawScore));

  const reasons: MatchReason[] = [];
  if (amountPoints > 0) reasons.push('AMOUNT');
  if (datePoints > 0) reasons.push('DATE');
  if (referenceRelation === 'EXACT') {
    reasons.push('REFERENCE');
  } else if (referenceRelation === 'SIMILAR') {
    reasons.push('REFERENCE_SIMILAR');
  }
  if (externalIdentifierMatch) reasons.push('EXTERNAL_IDENTIFIER');

  const classification = classify(finalScore, resolvedConfig);

  const contributions: ScoringContributions = {
    amount: amountPoints,
    date: datePoints,
    reference: refPoints,
    externalIdentifier: extPoints,
  };

  const metadata: ScoreExplanationMetadata = {
    currencyMatch: true,
    amountDeltaMinor,
    dateDifferenceDays: isDateValid ? dateDifferenceDays : null,
    referenceRelation,
    externalIdentifierMatch,
    matchedIdentifierValue,
  };

  return {
    score: finalScore,
    isEligible: isDateValid,
    classification,
    contributions,
    reasons,
    dateDifferenceDays: isDateValid ? dateDifferenceDays : null,
    metadata,
  };
}
