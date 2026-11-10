import {
  DEFAULT_MATCHING_CONFIG,
  MatchingConfig,
  PartialMatchingConfig,
  resolveAndValidateConfig,
} from './config';
import { normalizeCurrency, normalizeIdentifier, normalizeReference } from './normalize';
import { calculateDateScore, scorePair } from './scoring';
import {
  DiscrepancyDetail,
  MatchTransaction,
  MatchThreeSetsResult,
  QuarantinedDuplicate,
  ScorePairResult,
  SourceStatusType,
  ThreeSourceClassification,
  ThreeSourceMatchGroup,
  ThreeSourceStatistics,
} from './types';
import { calculateDateDifferenceDays } from './utils/date-difference';

interface TripletCandidate {
  transactionA?: MatchTransaction;
  transactionB?: MatchTransaction;
  transactionC?: MatchTransaction;
  classification: ThreeSourceClassification;
  score: number;
  confidence: number;
  reasons: string[];
  explanation: string;
  discrepancies: DiscrepancyDetail[];
  dateDeltaMax: number;
  amountDeltaMax: number;
  sourceStatus: {
    sourceA: SourceStatusType;
    sourceB: SourceStatusType;
    sourceC: SourceStatusType;
  };
}

const CLASSIFICATION_PRECEDENCE: Record<ThreeSourceClassification, number> = {
  FULLY_MATCHED: 7,
  AMOUNT_MISMATCH: 6,
  DATE_MISMATCH: 5,
  REFERENCE_MISMATCH: 4,
  PARTIALLY_MATCHED: 3,
  POTENTIAL_MATCH: 2,
  DUPLICATE_QUARANTINED: 1,
  UNMATCHED: 0,
};

function hasIdentifierLink(
  txn1: MatchTransaction,
  txn2: MatchTransaction,
): { linked: boolean; identifier?: string } {
  const normRef1 = normalizeReference(txn1.reference);
  const normRef2 = normalizeReference(txn2.reference);

  const ids1 = [
    normalizeIdentifier(txn1.externalId),
    normalizeIdentifier(txn1.externalTxnId),
    normalizeIdentifier(txn1.merchantOrOrderId),
    normRef1,
  ].filter((id): id is string => typeof id === 'string' && id.length >= 2);

  const ids2 = [
    normalizeIdentifier(txn2.externalId),
    normalizeIdentifier(txn2.externalTxnId),
    normalizeIdentifier(txn2.merchantOrOrderId),
    normRef2,
  ].filter((id): id is string => typeof id === 'string' && id.length >= 2);

  for (const id1 of ids1) {
    if (ids2.includes(id1)) {
      return { linked: true, identifier: id1 };
    }
  }

  // Substring containment if length >= 4
  for (const id1 of ids1) {
    for (const id2 of ids2) {
      if ((id1.includes(id2) || id2.includes(id1)) && Math.min(id1.length, id2.length) >= 4) {
        return { linked: true, identifier: `${id1} ~ ${id2}` };
      }
    }
  }

  return { linked: false };
}

/**
 * Detects intra-source duplicate candidates and returns quarantined transactions.
 */
function quarantineSourceDuplicates(
  transactions: readonly MatchTransaction[],
  sourceLabel: 'A' | 'B' | 'C',
): { clean: MatchTransaction[]; quarantined: QuarantinedDuplicate[] } {
  const clean: MatchTransaction[] = [];
  const quarantined: QuarantinedDuplicate[] = [];

  const seenExternalIds = new Map<string, MatchTransaction>();
  const seenSignatures = new Map<string, MatchTransaction>();

  for (const txn of transactions) {
    const extId = txn.externalId?.trim().toLowerCase();
    const dateStr =
      txn.transactionDate instanceof Date
        ? txn.transactionDate.toISOString().split('T')[0]
        : String(txn.transactionDate).split('T')[0];
    const ref = txn.reference?.trim().toLowerCase() || '';

    // Signature: amount + currency + date + reference (if reference present)
    const sig = ref.length > 0 ? `${txn.amountMinor}_${txn.currency}_${dateStr}_${ref}` : null;

    let isDuplicate = false;
    let duplicateReason = '';

    if (extId && seenExternalIds.has(extId)) {
      isDuplicate = true;
      duplicateReason = `Duplicate external ID '${txn.externalId}' in Source ${sourceLabel}`;
    } else if (sig && seenSignatures.has(sig)) {
      isDuplicate = true;
      duplicateReason = `Duplicate transaction attributes (amount ${txn.amountMinor}, date ${dateStr}, ref '${txn.reference}') in Source ${sourceLabel}`;
    }

    if (isDuplicate) {
      quarantined.push({
        source: sourceLabel,
        transaction: txn,
        reason: duplicateReason,
      });
    } else {
      if (extId) seenExternalIds.set(extId, txn);
      if (sig) seenSignatures.set(sig, txn);
      clean.push(txn);
    }
  }

  return { clean, quarantined };
}

/**
 * Executes native three-source reconciliation across Source A, Source B, and Source C.
 *
 * Scenarios evaluated:
 * - Scenario A: All three sources match (FULLY_MATCHED).
 * - Scenario B: Two sources match, one missing (PARTIALLY_MATCHED).
 * - Scenario C: Amount mismatch across sources (AMOUNT_MISMATCH).
 * - Scenario D: Settlement date offsets within or beyond tolerance (FULLY_MATCHED or DATE_MISMATCH).
 * - Scenario E: Competing/ambiguous potential matches (POTENTIAL_MATCH).
 * - Scenario F: Intra-source duplicates (DUPLICATE_QUARANTINED).
 */
export function matchThreeSets(
  setA: readonly MatchTransaction[],
  setB: readonly MatchTransaction[],
  setC: readonly MatchTransaction[],
  config?: PartialMatchingConfig | MatchingConfig,
): MatchThreeSetsResult {
  const resolvedConfig = config ? resolveAndValidateConfig(config) : DEFAULT_MATCHING_CONFIG;
  const { dateToleranceDays, thresholds } = resolvedConfig;

  // 1. Detect and quarantine duplicates in each source
  const qA = quarantineSourceDuplicates(setA, 'A');
  const qB = quarantineSourceDuplicates(setB, 'B');
  const qC = quarantineSourceDuplicates(setC, 'C');

  const allQuarantined: QuarantinedDuplicate[] = [
    ...qA.quarantined,
    ...qB.quarantined,
    ...qC.quarantined,
  ];

  const cleanA = qA.clean;
  const cleanB = qB.clean;
  const cleanC = qC.clean;

  // 2. Pre-compute pairwise affinities
  const pairScoreCache = new Map<string, ScorePairResult>();
  const getPairScore = (t1: MatchTransaction, t2: MatchTransaction): ScorePairResult => {
    const key = `${t1.id}::${t2.id}`;
    if (!pairScoreCache.has(key)) {
      pairScoreCache.set(key, scorePair(t1, t2, resolvedConfig));
    }
    return pairScoreCache.get(key)!;
  };

  // 3. Track competing candidates for Scenario E (Ambiguity detection)
  const candidateCountsA = new Map<string, number>();
  const candidateCountsB = new Map<string, number>();
  const candidateCountsC = new Map<string, number>();

  // 4. Build Triplet Candidates
  const candidateTriplets: TripletCandidate[] = [];

  for (const a of cleanA) {
    const normCurA = normalizeCurrency(a.currency);

    for (const b of cleanB) {
      const normCurB = normalizeCurrency(b.currency);
      if (normCurA !== normCurB || normCurA.length === 0) continue;

      const linkAB = hasIdentifierLink(a, b);
      const scoreAB = getPairScore(a, b);

      for (const c of cleanC) {
        const normCurC = normalizeCurrency(c.currency);
        if (normCurA !== normCurC) continue;

        const linkBC = hasIdentifierLink(b, c);
        const linkAC = hasIdentifierLink(a, c);

        const scoreBC = getPairScore(b, c);
        const scoreAC = getPairScore(a, c);

        // Check if there is any cross-system correlation linking all three
        // Direct link: a-b and b-c, or a-b and a-c, or a-c and b-c
        const isTransitivelyLinked =
          (linkAB.linked && (linkBC.linked || linkAC.linked)) ||
          (linkBC.linked && linkAC.linked);

        // Date differences
        const dateDiffAB = Math.abs(calculateDateDifferenceDays(a.transactionDate, b.transactionDate));
        const dateDiffBC = Math.abs(calculateDateDifferenceDays(b.transactionDate, c.transactionDate));
        const dateDiffAC = Math.abs(calculateDateDifferenceDays(a.transactionDate, c.transactionDate));

        const maxDateDelta = Math.max(
          isNaN(dateDiffAB) ? 999 : dateDiffAB,
          isNaN(dateDiffBC) ? 999 : dateDiffBC,
          isNaN(dateDiffAC) ? 999 : dateDiffAC,
        );

        // Amounts
        const amtA = a.amountMinor;
        const amtB = b.amountMinor;
        const amtC = c.amountMinor;
        const amountsMatch = amtA === amtB && amtB === amtC;
        const maxAmtDelta = Math.max(Math.abs(amtA - amtB), Math.abs(amtB - amtC), Math.abs(amtA - amtC));

        // Evaluate whether this triplet is eligible for consideration
        const hasScoreAffinity =
          scoreAB.score >= thresholds.potential ||
          scoreBC.score >= thresholds.potential ||
          scoreAC.score >= thresholds.potential;

        // If not transitively linked and no score affinity, and amounts or dates don't match, skip
        if (!isTransitivelyLinked && !hasScoreAffinity) {
          // Check if same exact amount and within date tolerance
          if (!amountsMatch || maxDateDelta > dateToleranceDays) {
            continue;
          }
        }

        // Triplet Evaluation
        const reasons: string[] = [];
        const discrepancies: DiscrepancyDetail[] = [];
        let classification: ThreeSourceClassification = 'POTENTIAL_MATCH';
        let score = 0;

        // Reason & Discrepancy analysis
        if (normCurA === normCurB && normCurB === normCurC) {
          reasons.push(`Currency matches across all sources (${normCurA}).`);
        }

        if (amountsMatch) {
          reasons.push(`Amount matches across all three sources (${(amtA / 100).toFixed(2)} ${normCurA}).`);
        } else {
          // Scenario C: Amount mismatch
          classification = 'AMOUNT_MISMATCH';
          if (amtA === amtB && amtB !== amtC) {
            const diff = amtA - amtC;
            discrepancies.push({
              type: 'AMOUNT',
              field: 'amount',
              expected: amtA,
              actual: amtC,
              difference: diff,
              message: `Expected ${(amtA / 100).toFixed(2)} ${normCurA} from Source A & B, but Source C recorded ${(amtC / 100).toFixed(2)} ${normCurA} (Difference: ${(diff / 100).toFixed(2)} ${normCurA}).`,
            });
            reasons.push(`Amount mismatch between Sources A/B and Source C.`);
          } else {
            discrepancies.push({
              type: 'AMOUNT',
              field: 'amount',
              expected: amtA,
              actual: amtC,
              difference: maxAmtDelta,
              message: `Discrepancy detected across sources: A=${(amtA / 100).toFixed(2)}, B=${(amtB / 100).toFixed(2)}, C=${(amtC / 100).toFixed(2)} ${normCurA}.`,
            });
            reasons.push(`Amount mismatch across sources.`);
          }
        }

        // Identifiers explanation
        if (linkAB.linked) {
          reasons.push(`Payment gateway references internal order (${linkAB.identifier || a.reference || a.externalId}).`);
        }
        if (linkBC.linked) {
          reasons.push(`Bank statement references payment gateway (${linkBC.identifier || b.externalId}).`);
        }
        if (linkAC.linked && !linkAB.linked && !linkBC.linked) {
          reasons.push(`Bank statement references internal order (${linkAC.identifier || a.reference || a.externalId}).`);
        }

        // Dates explanation
        if (maxDateDelta === 0) {
          reasons.push(`All transactions occurred on the same date.`);
        } else if (maxDateDelta <= dateToleranceDays) {
          reasons.push(
            `Settlement occurred ${maxDateDelta} day${maxDateDelta > 1 ? 's' : ''} apart (within configured ${dateToleranceDays}-day tolerance).`,
          );
        } else {
          // Scenario D: Settlement date exceeded tolerance
          if (classification !== 'AMOUNT_MISMATCH') {
            classification = 'DATE_MISMATCH';
          }
          discrepancies.push({
            type: 'DATE',
            field: 'transactionDate',
            expected: dateToleranceDays,
            actual: maxDateDelta,
            difference: maxDateDelta - dateToleranceDays,
            message: `Settlement delay of ${maxDateDelta} days exceeds configured date tolerance of ${dateToleranceDays} days.`,
          });
          reasons.push(`Settlement delay of ${maxDateDelta} days exceeds tolerance.`);
        }

        // Score calculation: composite average of pairwise scores with cross-source consistency bonus
        const dateScore = calculateDateScore(maxDateDelta, dateToleranceDays, 20);
        const amountScore = amountsMatch ? 30 : 0;
        const refScore = isTransitivelyLinked ? 50 : (linkAB.linked || linkBC.linked || linkAC.linked ? 30 : 0);
        const consistencyScore = amountsMatch && maxDateDelta <= dateToleranceDays ? 15 : 0;

        if (consistencyScore > 0) {
          reasons.push('Consistent financial parameters confirmed across all three sources.');
        }

        let compositeScore = Math.min(100, Math.max(0, amountScore + dateScore + refScore + consistencyScore));

        if (classification === 'AMOUNT_MISMATCH' || classification === 'DATE_MISMATCH') {
          score = Math.min(compositeScore, 75);
        } else if (amountsMatch && maxDateDelta <= dateToleranceDays && isTransitivelyLinked) {
          score = Math.max(compositeScore, maxDateDelta === 0 ? 100 : 95);
          classification = 'FULLY_MATCHED';
        } else if (amountsMatch && maxDateDelta <= dateToleranceDays && (linkAB.linked || linkBC.linked)) {
          score = Math.max(compositeScore, 85);
          classification = score >= thresholds.exact ? 'FULLY_MATCHED' : 'POTENTIAL_MATCH';
        } else if (compositeScore >= thresholds.potential) {
          score = compositeScore;
          classification = score >= thresholds.exact ? 'FULLY_MATCHED' : 'POTENTIAL_MATCH';
        } else {
          continue; // Not a viable triplet
        }

        candidateCountsA.set(a.id, (candidateCountsA.get(a.id) || 0) + 1);
        candidateCountsB.set(b.id, (candidateCountsB.get(b.id) || 0) + 1);
        candidateCountsC.set(c.id, (candidateCountsC.get(c.id) || 0) + 1);

        candidateTriplets.push({
          transactionA: a,
          transactionB: b,
          transactionC: c,
          classification,
          score,
          confidence: score,
          reasons,
          explanation: reasons.join(' '),
          discrepancies,
          dateDeltaMax: maxDateDelta,
          amountDeltaMax: maxAmtDelta,
          sourceStatus: {
            sourceA: 'MATCHED',
            sourceB: 'MATCHED',
            sourceC: classification === 'AMOUNT_MISMATCH' || classification === 'DATE_MISMATCH' ? 'MISMATCH' : 'MATCHED',
          },
        });
      }
    }
  }

  // Check for Scenario E (Multiple competing matches)
  for (const triplet of candidateTriplets) {
    if (triplet.classification === 'FULLY_MATCHED') {
      const idA = triplet.transactionA!.id;
      const idB = triplet.transactionB!.id;
      const idC = triplet.transactionC!.id;

      const cntA = candidateCountsA.get(idA) || 0;
      const cntB = candidateCountsB.get(idB) || 0;
      const cntC = candidateCountsC.get(idC) || 0;

      // If any participating record has multiple competing high-affinity matches, degrade to POTENTIAL_MATCH
      if (cntA > 1 || cntB > 1 || cntC > 1) {
        // Only degrade if there is real ambiguity (no unique 100% exact link)
        if (triplet.score < 100) {
          triplet.classification = 'POTENTIAL_MATCH';
          triplet.reasons.push('Multiple candidate matches exist with similar attributes; human review required.');
          triplet.explanation = triplet.reasons.join(' ');
        }
      }
    }
  }

  // Sort candidate triplets deterministically
  candidateTriplets.sort((t1, t2) => {
    // 1. Classification precedence
    const prec1 = CLASSIFICATION_PRECEDENCE[t1.classification];
    const prec2 = CLASSIFICATION_PRECEDENCE[t2.classification];
    if (prec2 !== prec1) return prec2 - prec1;

    // 2. Score descending
    if (t2.score !== t1.score) return t2.score - t1.score;

    // 3. Date delta ascending
    if (t1.dateDeltaMax !== t2.dateDeltaMax) return t1.dateDeltaMax - t2.dateDeltaMax;

    // 4. Amount delta ascending
    if (t1.amountDeltaMax !== t2.amountDeltaMax) return t1.amountDeltaMax - t2.amountDeltaMax;

    // 5. Stable deterministic tie-breaker on IDs
    const cmpA = (t1.transactionA?.id || '').localeCompare(t2.transactionA?.id || '');
    if (cmpA !== 0) return cmpA;
    const cmpB = (t1.transactionB?.id || '').localeCompare(t2.transactionB?.id || '');
    if (cmpB !== 0) return cmpB;
    return (t1.transactionC?.id || '').localeCompare(t2.transactionC?.id || '');
  });

  // Greedy Triplet Assignment
  const matchedIdsA = new Set<string>();
  const matchedIdsB = new Set<string>();
  const matchedIdsC = new Set<string>();

  const matchGroups: ThreeSourceMatchGroup[] = [];
  let groupSequence = 1001;

  for (const triplet of candidateTriplets) {
    const idA = triplet.transactionA!.id;
    const idB = triplet.transactionB!.id;
    const idC = triplet.transactionC!.id;

    if (matchedIdsA.has(idA) || matchedIdsB.has(idB) || matchedIdsC.has(idC)) {
      continue;
    }

    matchedIdsA.add(idA);
    matchedIdsB.add(idB);
    matchedIdsC.add(idC);

    matchGroups.push({
      id: `MATCH-${groupSequence++}`,
      reconciliationType: 'THREE_SOURCE',
      classification: triplet.classification,
      score: triplet.score,
      confidence: triplet.confidence,
      reasons: triplet.reasons,
      explanation: triplet.explanation,
      discrepancies: triplet.discrepancies,
      transactionA: triplet.transactionA,
      transactionB: triplet.transactionB,
      transactionC: triplet.transactionC,
      transactionAId: idA,
      transactionBId: idB,
      transactionCId: idC,
      sourceStatus: triplet.sourceStatus,
    });
  }

  // 5. Scenario B: Two sources match, one is missing (PARTIALLY_MATCHED)
  // Check remaining unmatched transactions between (A, B), (B, C), and (A, C)
  const remainingA = cleanA.filter((t) => !matchedIdsA.has(t.id));
  const remainingB = cleanB.filter((t) => !matchedIdsB.has(t.id));
  const remainingC = cleanC.filter((t) => !matchedIdsC.has(t.id));

  // Check remaining (A, B) pairs with C missing
  for (const a of remainingA) {
    if (matchedIdsA.has(a.id)) continue;
    for (const b of remainingB) {
      if (matchedIdsB.has(b.id)) continue;

      const scoreAB = getPairScore(a, b);
      if (scoreAB.classification !== 'NO_MATCH' && scoreAB.score >= thresholds.potential) {
        matchedIdsA.add(a.id);
        matchedIdsB.add(b.id);

        const reasons = [
          `Internal Orders and Payment Gateway match with ${scoreAB.score}% confidence.`,
          `Bank Statement record is missing.`,
          ...scoreAB.reasons.map((r) => `Pairwise rule: ${r}`),
        ];

        matchGroups.push({
          id: `MATCH-${groupSequence++}`,
          reconciliationType: 'THREE_SOURCE',
          classification: 'PARTIALLY_MATCHED',
          score: scoreAB.score,
          confidence: scoreAB.score,
          reasons,
          explanation: reasons.join(' '),
          discrepancies: [
            {
              type: 'MISSING_SOURCE',
              field: 'sourceC',
              message: 'Bank statement record is missing for this transaction.',
            },
          ],
          transactionA: a,
          transactionB: b,
          transactionC: null,
          transactionAId: a.id,
          transactionBId: b.id,
          transactionCId: null,
          sourceStatus: {
            sourceA: 'MATCHED',
            sourceB: 'MATCHED',
            sourceC: 'MISSING',
          },
        });
        break;
      }
    }
  }

  // Check remaining (B, C) pairs with A missing
  for (const b of remainingB) {
    if (matchedIdsB.has(b.id)) continue;
    for (const c of remainingC) {
      if (matchedIdsC.has(c.id)) continue;

      const scoreBC = getPairScore(b, c);
      if (scoreBC.classification !== 'NO_MATCH' && scoreBC.score >= thresholds.potential) {
        matchedIdsB.add(b.id);
        matchedIdsC.add(c.id);

        const reasons = [
          `Payment Gateway and Bank Statement match with ${scoreBC.score}% confidence.`,
          `Internal Order record is missing.`,
        ];

        matchGroups.push({
          id: `MATCH-${groupSequence++}`,
          reconciliationType: 'THREE_SOURCE',
          classification: 'PARTIALLY_MATCHED',
          score: scoreBC.score,
          confidence: scoreBC.score,
          reasons,
          explanation: reasons.join(' '),
          discrepancies: [
            {
              type: 'MISSING_SOURCE',
              field: 'sourceA',
              message: 'Internal Order record is missing for this transaction.',
            },
          ],
          transactionA: null,
          transactionB: b,
          transactionC: c,
          transactionAId: null,
          transactionBId: b.id,
          transactionCId: c.id,
          sourceStatus: {
            sourceA: 'MISSING',
            sourceB: 'MATCHED',
            sourceC: 'MATCHED',
          },
        });
        break;
      }
    }
  }

  // Check remaining (A, C) pairs with B missing
  for (const a of remainingA) {
    if (matchedIdsA.has(a.id)) continue;
    for (const c of remainingC) {
      if (matchedIdsC.has(c.id)) continue;

      const scoreAC = getPairScore(a, c);
      if (scoreAC.classification !== 'NO_MATCH' && scoreAC.score >= thresholds.potential) {
        matchedIdsA.add(a.id);
        matchedIdsC.add(c.id);

        const reasons = [
          `Internal Orders and Bank Statement match with ${scoreAC.score}% confidence.`,
          `Payment Gateway record is missing.`,
        ];

        matchGroups.push({
          id: `MATCH-${groupSequence++}`,
          reconciliationType: 'THREE_SOURCE',
          classification: 'PARTIALLY_MATCHED',
          score: scoreAC.score,
          confidence: scoreAC.score,
          reasons,
          explanation: reasons.join(' '),
          discrepancies: [
            {
              type: 'MISSING_SOURCE',
              field: 'sourceB',
              message: 'Payment Gateway record is missing for this transaction.',
            },
          ],
          transactionA: a,
          transactionB: null,
          transactionC: c,
          transactionAId: a.id,
          transactionBId: null,
          transactionCId: c.id,
          sourceStatus: {
            sourceA: 'MATCHED',
            sourceB: 'MISSING',
            sourceC: 'MATCHED',
          },
        });
        break;
      }
    }
  }

  // 6. Remaining Unmatched Transactions
  const finalUnmatchedA = cleanA.filter((t) => !matchedIdsA.has(t.id));
  const finalUnmatchedB = cleanB.filter((t) => !matchedIdsB.has(t.id));
  const finalUnmatchedC = cleanC.filter((t) => !matchedIdsC.has(t.id));

  // 7. Calculate Statistics
  let fullyMatchedCount = 0;
  let partiallyMatchedCount = 0;
  let amountMismatchCount = 0;
  let dateMismatchCount = 0;
  let referenceMismatchCount = 0;
  let potentialMatchCount = 0;

  for (const g of matchGroups) {
    switch (g.classification) {
      case 'FULLY_MATCHED':
        fullyMatchedCount++;
        break;
      case 'PARTIALLY_MATCHED':
        partiallyMatchedCount++;
        break;
      case 'AMOUNT_MISMATCH':
        amountMismatchCount++;
        break;
      case 'DATE_MISMATCH':
        dateMismatchCount++;
        break;
      case 'REFERENCE_MISMATCH':
        referenceMismatchCount++;
        break;
      case 'POTENTIAL_MATCH':
        potentialMatchCount++;
        break;
    }
  }

  const totalInputTransactions = setA.length + setB.length + setC.length;
  const totalUnmatched = finalUnmatchedA.length + finalUnmatchedB.length + finalUnmatchedC.length;
  const totalMatchedTxns =
    fullyMatchedCount * 3 +
    partiallyMatchedCount * 2 +
    (amountMismatchCount + dateMismatchCount + referenceMismatchCount + potentialMatchCount) * 3;

  const matchRate =
    totalInputTransactions > 0
      ? Math.round(((fullyMatchedCount * 3) / totalInputTransactions) * 100)
      : 0;

  const statistics: ThreeSourceStatistics = {
    totalA: setA.length,
    totalB: setB.length,
    totalC: setC.length,
    fullyMatchedCount,
    partiallyMatchedCount,
    amountMismatchCount,
    dateMismatchCount,
    referenceMismatchCount,
    potentialMatchCount,
    unmatchedCount: totalUnmatched,
    quarantinedCount: allQuarantined.length,
    matchRate,
  };

  return {
    matchGroups,
    unmatchedA: finalUnmatchedA,
    unmatchedB: finalUnmatchedB,
    unmatchedC: finalUnmatchedC,
    quarantinedDuplicates: allQuarantined,
    statistics,
  };
}
