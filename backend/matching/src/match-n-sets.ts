import {
  DiscrepancyDetail,
  MatchNSetsResult,
  MatchTransaction,
  MultiSourceClassification,
  MultiSourceMatchGroup,
  MultiSourceQuarantinedDuplicate,
  MultiSourceStatistics,
  SourceInput,
  SourceStatusType,
} from './types';

export interface MatchNSetsConfig {
  dateToleranceDays?: number;
  thresholds?: {
    exact?: number;
    potential?: number;
  };
}

interface InternalEdge {
  sourceAIdx: number;
  sourceBIdx: number;
  txnA: MatchTransaction;
  txnB: MatchTransaction;
  score: number;
  hasRefLink: boolean;
  hasAmountMatch: boolean;
  hasDateWithinTolerance: boolean;
  daysDiff: number;
  reasons: string[];
}

function parseDateMs(d: Date | string): number {
  if (d instanceof Date) return d.getTime();
  const parsed = new Date(d).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

function getDaysDiff(d1: Date | string, d2: Date | string): number {
  const ms1 = parseDateMs(d1);
  const ms2 = parseDateMs(d2);
  return Math.abs(Math.round((ms1 - ms2) / (1000 * 60 * 60 * 24)));
}

/**
 * Checks if two transactions share an exact or transitive identifier link.
 */
function checkIdentifierLink(a: MatchTransaction, b: MatchTransaction): {
  isLinked: boolean;
  reason?: string;
} {
  const aExt = (a.externalId || '').trim().toLowerCase();
  const bExt = (b.externalId || '').trim().toLowerCase();
  const aRef = (a.reference || '').trim().toLowerCase();
  const bRef = (b.reference || '').trim().toLowerCase();
  const aTxn = (a.externalTxnId || '').trim().toLowerCase();
  const bTxn = (b.externalTxnId || '').trim().toLowerCase();
  const aOrder = (a.merchantOrOrderId || '').trim().toLowerCase();
  const bOrder = (b.merchantOrOrderId || '').trim().toLowerCase();

  // 1. Direct externalId or reference parity
  if (aExt && bExt && aExt === bExt) {
    return { isLinked: true, reason: `Exact external identifier match (${a.externalId})` };
  }
  if (aRef && bRef && aRef === bRef) {
    return { isLinked: true, reason: `Matching counterparty reference (${a.reference})` };
  }

  // 2. Cross-field linking
  if (aExt && bRef && aExt === bRef) {
    return { isLinked: true, reason: `Reference (${b.reference}) matches ID (${a.externalId})` };
  }
  if (bExt && aRef && bExt === aRef) {
    return { isLinked: true, reason: `Reference (${a.reference}) matches ID (${b.externalId})` };
  }
  if (aTxn && bExt && aTxn === bExt) {
    return { isLinked: true, reason: `Gateway txn ID (${a.externalTxnId}) matches external ID (${b.externalId})` };
  }
  if (bTxn && aExt && bTxn === aExt) {
    return { isLinked: true, reason: `Gateway txn ID (${b.externalTxnId}) matches external ID (${a.externalId})` };
  }
  if (aTxn && bTxn && aTxn === bTxn) {
    return { isLinked: true, reason: `Matching gateway transaction ID (${a.externalTxnId})` };
  }
  if (aOrder && bOrder && aOrder === bOrder) {
    return { isLinked: true, reason: `Matching merchant/order ID (${a.merchantOrOrderId})` };
  }
  if (aExt && bOrder && aExt === bOrder) {
    return { isLinked: true, reason: `Order ID (${b.merchantOrOrderId}) matches external ID (${a.externalId})` };
  }
  if (bExt && aOrder && bExt === aOrder) {
    return { isLinked: true, reason: `Order ID (${a.merchantOrOrderId}) matches external ID (${b.externalId})` };
  }

  return { isLinked: false };
}

/**
 * Deterministic Multi-Source (N-Set) Financial Reconciliation Engine.
 * Supports 2, 3, 4, or arbitrary N transaction sources with full transitive clustering,
 * cross-source monetary & settlement delay evaluation, explainable confidence scoring,
 * and duplicate quarantine.
 */
export function matchNSets(
  sources: SourceInput[],
  config: MatchNSetsConfig = {},
): MatchNSetsResult {
  const dateToleranceDays = config.dateToleranceDays ?? 2;
  const potentialThreshold = config.thresholds?.potential ?? 60;
  const numSources = sources.length;

  if (numSources < 2) {
    throw new Error('matchNSets requires at least 2 data sources to reconcile.');
  }

  // 1. Duplicate Detection & Quarantine per Source
  const quarantinedDuplicates: MultiSourceQuarantinedDuplicate[] = [];
  const cleanSources: Array<{ id: string; name: string; transactions: MatchTransaction[] }> = [];

  for (const src of sources) {
    const seenExternalIds = new Map<string, MatchTransaction>();
    const seenSignatures = new Map<string, MatchTransaction>();
    const cleanList: MatchTransaction[] = [];

    for (const t of src.transactions) {
      const ext = (t.externalId || '').trim();
      const dateStr =
        t.transactionDate instanceof Date
          ? t.transactionDate.toISOString().slice(0, 10)
          : String(t.transactionDate).slice(0, 10);
      const signature = `${t.amountMinor}|${(t.currency || '').toUpperCase()}|${dateStr}|${(t.reference || '').trim()}`;

      if (ext && seenExternalIds.has(ext)) {
        quarantinedDuplicates.push({
          sourceId: src.id,
          sourceName: src.name,
          transaction: t,
          reason: `Duplicate external ID "${ext}" detected in source "${src.name}"`,
        });
      } else if (seenSignatures.has(signature)) {
        quarantinedDuplicates.push({
          sourceId: src.id,
          sourceName: src.name,
          transaction: t,
          reason: `Duplicate monetary signature (${t.amountMinor} ${t.currency} on ${dateStr}) in source "${src.name}"`,
        });
      } else {
        if (ext) seenExternalIds.set(ext, t);
        seenSignatures.set(signature, t);
        cleanList.push(t);
      }
    }
    cleanSources.push({ id: src.id, name: src.name, transactions: cleanList });
  }

  // 2. Pairwise Candidate Edge Generation across all pairs (i < j)
  const edges: InternalEdge[] = [];
  for (let i = 0; i < numSources; i++) {
    for (let j = i + 1; j < numSources; j++) {
      const srcA = cleanSources[i];
      const srcB = cleanSources[j];

      for (const tA of srcA.transactions) {
        for (const tB of srcB.transactions) {
          if (tA.currency && tB.currency && tA.currency.toUpperCase() !== tB.currency.toUpperCase()) {
            continue; // Currency mismatch disqualifies pairing
          }

          const link = checkIdentifierLink(tA, tB);
          const hasAmountMatch = tA.amountMinor === tB.amountMinor;
          const daysDiff = getDaysDiff(tA.transactionDate, tB.transactionDate);
          const hasDateWithinTolerance = daysDiff <= dateToleranceDays;

          // Disqualify if neither reference nor amount match
          if (!link.isLinked && !hasAmountMatch) {
            continue;
          }

          let pairScore = 0;
          const reasons: string[] = [];

          if (link.isLinked) {
            pairScore += 40;
            reasons.push(link.reason!);
          }

          if (hasAmountMatch) {
            pairScore += 30;
            reasons.push(`Amount matches (${(tA.amountMinor / 100).toFixed(2)} ${tA.currency})`);
          }

          if (tA.currency && tB.currency && tA.currency.toUpperCase() === tB.currency.toUpperCase()) {
            pairScore += 10;
          }

          if (hasDateWithinTolerance) {
            const decay = Math.max(0, 1 - daysDiff / Math.max(1, dateToleranceDays));
            pairScore += Math.round(20 * (0.5 + 0.5 * decay));
            if (daysDiff === 0) {
              reasons.push('Same transaction date');
            } else {
              reasons.push(`Settlement delay of ${daysDiff} day(s) within ±${dateToleranceDays}d tolerance`);
            }
          }

          edges.push({
            sourceAIdx: i,
            sourceBIdx: j,
            txnA: tA,
            txnB: tB,
            score: Math.min(100, pairScore),
            hasRefLink: link.isLinked,
            hasAmountMatch,
            hasDateWithinTolerance,
            daysDiff,
            reasons,
          });
        }
      }
    }
  }

  // 3. Transitive Clustering into Multi-Source Groups using Disjoint-Set
  type TxnKey = string; // "sourceIdx:txnId"
  const parent = new Map<TxnKey, TxnKey>();

  function find(k: TxnKey): TxnKey {
    if (!parent.has(k)) parent.set(k, k);
    if (parent.get(k) !== k) {
      parent.set(k, find(parent.get(k)!));
    }
    return parent.get(k)!;
  }

  function union(k1: TxnKey, k2: TxnKey) {
    const root1 = find(k1);
    const root2 = find(k2);
    if (root1 !== root2) {
      parent.set(root2, root1);
    }
  }

  // Connect edges with significant score
  for (const edge of edges) {
    if (edge.score >= potentialThreshold || (edge.hasRefLink && edge.hasDateWithinTolerance)) {
      union(`${edge.sourceAIdx}:${edge.txnA.id}`, `${edge.sourceBIdx}:${edge.txnB.id}`);
    }
  }

  // Group transactions by disjoint root
  const clusters = new Map<TxnKey, Array<{ sourceIdx: number; txn: MatchTransaction }>>();
  for (let i = 0; i < numSources; i++) {
    for (const t of cleanSources[i].transactions) {
      const key = `${i}:${t.id}`;
      const root = find(key);
      if (!clusters.has(root)) {
        clusters.set(root, []);
      }
      clusters.get(root)!.push({ sourceIdx: i, txn: t });
    }
  }

  // 4. Candidate Multi-Source Group Evaluation
  interface CandidateGroup {
    participatingTxns: Map<number, MatchTransaction>; // sourceIdx -> txn
    score: number;
    confidence: number;
    classification: MultiSourceClassification;
    reasons: string[];
    explanation: string;
    discrepancies: DiscrepancyDetail[];
    sourceStatusBySourceId: Record<string, SourceStatusType>;
    hasConflict: boolean;
  }

  const candidateGroups: CandidateGroup[] = [];

  for (const members of clusters.values()) {
    // If cluster only has 1 transaction, it's unmatched (no multi-source candidate)
    if (members.length < 2) continue;

    // Check for source collisions within cluster (e.g. 2 txns from same source)
    const bySource = new Map<number, MatchTransaction[]>();
    for (const m of members) {
      if (!bySource.has(m.sourceIdx)) bySource.set(m.sourceIdx, []);
      bySource.get(m.sourceIdx)!.push(m.txn);
    }

    const hasCollision = Array.from(bySource.values()).some((arr) => arr.length > 1);

    // Pick first candidate for each source in the cluster
    const chosen = new Map<number, MatchTransaction>();
    for (const [sIdx, arr] of bySource.entries()) {
      chosen.set(sIdx, arr[0]);
    }

    // Evaluate consistency across chosen transactions
    const txns = Array.from(chosen.values());
    const amounts = txns.map((t) => t.amountMinor);
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);
    const isAmountMatch = minAmount === maxAmount;

    // Evaluate dates
    const dates = txns.map((t) => parseDateMs(t.transactionDate));
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const maxDaysDiff = Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24));
    const isDateWithinTolerance = maxDaysDiff <= dateToleranceDays;

    // Evaluate currencies
    const currencies = new Set(txns.map((t) => (t.currency || '').toUpperCase()));
    const isCurrencyMatch = currencies.size <= 1;

    // Collect reasons and discrepancies
    const groupReasons: string[] = [];
    const discrepancies: DiscrepancyDetail[] = [];
    let groupScore = 0;

    // Amount scoring
    if (isAmountMatch) {
      groupScore += 30;
      groupReasons.push(`Amount matches across all participating sources (${(minAmount / 100).toFixed(2)} ${txns[0].currency})`);
    } else {
      const firstTxn = txns[0];
      const diffTxn = txns.find((t) => t.amountMinor !== firstTxn.amountMinor) || txns[1];
      const diff = Math.abs(firstTxn.amountMinor - diffTxn.amountMinor);

      discrepancies.push({
        type: 'AMOUNT',
        field: 'amount',
        expected: firstTxn.amountMinor,
        actual: diffTxn.amountMinor,
        difference: diff,
        message: `Expected ${(firstTxn.amountMinor / 100).toFixed(2)} ${firstTxn.currency} but found ${(diffTxn.amountMinor / 100).toFixed(2)} ${diffTxn.currency} (Difference: ${(diff / 100).toFixed(2)} ${firstTxn.currency}).`,
      });
      groupReasons.push(`Amount mismatch of ${(diff / 100).toFixed(2)} ${firstTxn.currency} detected`);
    }

    // Reference scoring
    let hasRefConnection = false;
    for (let a = 0; a < txns.length; a++) {
      for (let b = a + 1; b < txns.length; b++) {
        const link = checkIdentifierLink(txns[a], txns[b]);
        if (link.isLinked) {
          hasRefConnection = true;
          if (!groupReasons.includes(link.reason!)) {
            groupReasons.push(link.reason!);
          }
        }
      }
    }
    if (hasRefConnection) {
      groupScore += 40;
    }

    // Currency scoring
    if (isCurrencyMatch) {
      groupScore += 10;
      groupReasons.push(`Currency matches across all participating sources (${txns[0].currency})`);
    } else {
      discrepancies.push({
        type: 'CURRENCY',
        field: 'currency',
        message: `Cross-source currency conflict: ${Array.from(currencies).join(', ')}`,
      });
    }

    // Date scoring
    if (isDateWithinTolerance) {
      const decay = Math.max(0, 1 - maxDaysDiff / Math.max(1, dateToleranceDays));
      groupScore += Math.round(20 * (0.5 + 0.5 * decay));
      if (maxDaysDiff === 0) {
        groupReasons.push('Transaction dates match across all sources');
      } else {
        groupReasons.push(`Settlement occurred ${maxDaysDiff} day(s) later (within ±${dateToleranceDays}d tolerance)`);
      }
    } else {
      discrepancies.push({
        type: 'DATE',
        field: 'transactionDate',
        expected: `${dateToleranceDays} days tolerance`,
        actual: `${maxDaysDiff} days delay`,
        difference: maxDaysDiff - dateToleranceDays,
        message: `Settlement delay of ${maxDaysDiff} days exceeds tolerance of ${dateToleranceDays} days.`,
      });
      groupReasons.push(`Date difference of ${maxDaysDiff} days exceeds tolerance`);
    }

    // Cross-source agreement bonus: if all participating sources agree on currency, amount, and date
    if (isCurrencyMatch && isAmountMatch && isDateWithinTolerance && chosen.size >= 3) {
      groupScore += 15;
      groupReasons.push('Unanimous cross-source consistency bonus applied (+15%)');
    }

    // Check missing sources
    const sourceStatusBySourceId: Record<string, SourceStatusType> = {};
    for (let sIdx = 0; sIdx < numSources; sIdx++) {
      const src = cleanSources[sIdx];
      if (chosen.has(sIdx)) {
        sourceStatusBySourceId[src.id] = isAmountMatch ? 'MATCHED' : 'MISMATCH';
      } else {
        sourceStatusBySourceId[src.id] = 'MISSING';
        discrepancies.push({
          type: 'MISSING_SOURCE',
          field: src.id,
          message: `Record missing from source "${src.name}".`,
        });
        groupReasons.push(`Missing record from ${src.name}`);
      }
    }

    // Classification determination
    let classification: MultiSourceClassification;
    const isFullPresence = chosen.size === numSources;

    if (!isAmountMatch) {
      classification = 'AMOUNT_MISMATCH';
    } else if (!isDateWithinTolerance) {
      classification = 'DATE_MISMATCH';
    } else if (hasCollision) {
      classification = 'POTENTIAL_MATCH';
      groupReasons.push('Ambiguous candidates detected in source feed; operator confirmation required');
    } else if (isFullPresence && groupScore >= 90) {
      classification = 'FULLY_MATCHED';
    } else if (isFullPresence && groupScore >= potentialThreshold) {
      classification = 'FULLY_MATCHED';
    } else if (chosen.size >= 2 && groupScore >= potentialThreshold) {
      classification = 'PARTIALLY_MATCHED';
    } else if (groupScore >= potentialThreshold) {
      classification = 'POTENTIAL_MATCH';
    } else {
      classification = 'POTENTIAL_MATCH';
    }

    candidateGroups.push({
      participatingTxns: chosen,
      score: Math.min(100, Math.max(0, groupScore)),
      confidence: Math.min(100, Math.max(0, groupScore)),
      classification,
      reasons: groupReasons,
      explanation: groupReasons.join('. '),
      discrepancies,
      sourceStatusBySourceId,
      hasConflict: hasCollision,
    });
  }

  // 5. Greedy Conflict Resolution & Assignment
  // Sort candidate groups descending by score
  candidateGroups.sort((a, b) => b.score - a.score);

  const matchedTxnIds = new Set<string>();
  const finalMatchGroups: MultiSourceMatchGroup[] = [];

  let reconType: 'TWO_SOURCE' | 'THREE_SOURCE' | 'FOUR_SOURCE' | 'MULTI_SOURCE';
  if (numSources === 2) reconType = 'TWO_SOURCE';
  else if (numSources === 3) reconType = 'THREE_SOURCE';
  else if (numSources === 4) reconType = 'FOUR_SOURCE';
  else reconType = 'MULTI_SOURCE';

  let matchIndex = 1;

  for (const cand of candidateGroups) {
    const txns = Array.from(cand.participatingTxns.values());
    const anyAlreadyMatched = txns.some((t) => matchedTxnIds.has(t.id));

    if (anyAlreadyMatched) {
      continue; // Skip already matched transactions to preserve 1:1:...:1 invariant
    }

    // Mark as matched
    for (const t of txns) {
      matchedTxnIds.add(t.id);
    }

    const txnsBySourceId: Record<string, MatchTransaction | null> = {};
    const txnIdsBySourceId: Record<string, string | null> = {};

    for (let sIdx = 0; sIdx < numSources; sIdx++) {
      const src = cleanSources[sIdx];
      const txn = cand.participatingTxns.get(sIdx) || null;
      txnsBySourceId[src.id] = txn;
      txnIdsBySourceId[src.id] = txn ? txn.id : null;
    }

    const txnA = cand.participatingTxns.get(0) || null;
    const txnB = cand.participatingTxns.get(1) || null;
    const txnC = cand.participatingTxns.get(2) || null;
    const txnD = cand.participatingTxns.get(3) || null;

    finalMatchGroups.push({
      id: `MATCH-${String(matchIndex++).padStart(4, '0')}`,
      reconciliationType: reconType,
      classification: cand.classification,
      score: cand.score,
      confidence: cand.confidence,
      reasons: cand.reasons,
      explanation: cand.explanation,
      discrepancies: cand.discrepancies,
      transactionsBySourceId: txnsBySourceId,
      transactionIdsBySourceId: txnIdsBySourceId,
      sourceStatusBySourceId: cand.sourceStatusBySourceId,
      transactionAId: txnA ? txnA.id : null,
      transactionBId: txnB ? txnB.id : null,
      transactionCId: txnC ? txnC.id : null,
      transactionDId: txnD ? txnD.id : null,
      transactionA: txnA,
      transactionB: txnB,
      transactionC: txnC,
      transactionD: txnD,
    });
  }

  // 6. Gather Unmatched Records per Source
  const unmatchedBySourceId: Record<string, MatchTransaction[]> = {};
  for (let sIdx = 0; sIdx < numSources; sIdx++) {
    const src = cleanSources[sIdx];
    unmatchedBySourceId[src.id] = src.transactions.filter((t) => !matchedTxnIds.has(t.id));
  }

  // 7. Aggregate Multi-Source Statistics
  const totalBySourceId: Record<string, number> = {};
  let totalProcessed = 0;

  for (const src of sources) {
    totalBySourceId[src.id] = src.transactions.length;
    totalProcessed += src.transactions.length;
  }

  const fullyMatchedCount = finalMatchGroups.filter((g) => g.classification === 'FULLY_MATCHED').length;
  const partiallyMatchedCount = finalMatchGroups.filter((g) => g.classification === 'PARTIALLY_MATCHED').length;
  const amountMismatchCount = finalMatchGroups.filter((g) => g.classification === 'AMOUNT_MISMATCH').length;
  const dateMismatchCount = finalMatchGroups.filter((g) => g.classification === 'DATE_MISMATCH').length;
  const referenceMismatchCount = finalMatchGroups.filter((g) => g.classification === 'REFERENCE_MISMATCH').length;
  const potentialMatchCount = finalMatchGroups.filter((g) => g.classification === 'POTENTIAL_MATCH').length;

  let totalUnmatched = 0;
  for (const list of Object.values(unmatchedBySourceId)) {
    totalUnmatched += list.length;
  }

  const totalMatchedTxns = matchedTxnIds.size;
  const matchRate = totalProcessed > 0 ? Math.round((totalMatchedTxns / totalProcessed) * 100) : 0;

  const statistics: MultiSourceStatistics = {
    totalBySourceId,
    totalProcessed,
    fullyMatchedCount,
    partiallyMatchedCount,
    amountMismatchCount,
    dateMismatchCount,
    referenceMismatchCount,
    potentialMatchCount,
    unmatchedCount: totalUnmatched,
    quarantinedCount: quarantinedDuplicates.length,
    matchRate,
  };

  return {
    matchGroups: finalMatchGroups,
    unmatchedBySourceId,
    quarantinedDuplicates,
    statistics,
  };
}
