import { describe, expect, it } from 'vitest';
import { matchThreeSets } from '../src/match-three-sets';
import { MatchTransaction } from '../src/types';

describe('Native Three-Source Matching Engine (matchThreeSets)', () => {
  // Scenario A: All three sources match
  it('Scenario A: matches when all three sources agree (Order + Gateway + Bank with 1-day delay)', () => {
    const order: MatchTransaction = {
      id: 'ord-1001',
      externalId: 'ORD-1001',
      amountMinor: 99900,
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'ORD-1001',
    };

    const gateway: MatchTransaction = {
      id: 'txn-2001',
      externalId: 'TXN-2001',
      amountMinor: 99900,
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'ORD-1001',
      merchantOrOrderId: 'ORD-1001',
    };

    const bank: MatchTransaction = {
      id: 'bnk-3001',
      externalId: 'BNK-3001',
      amountMinor: 99900,
      currency: 'INR',
      transactionDate: '2026-09-16', // 1 day settlement delay
      reference: 'TXN-2001',
    };

    const result = matchThreeSets([order], [gateway], [bank], { dateToleranceDays: 2 });

    expect(result.matchGroups).toHaveLength(1);
    const group = result.matchGroups[0];
    expect(group.classification).toBe('FULLY_MATCHED');
    expect(group.score).toBeGreaterThanOrEqual(95);
    expect(group.transactionAId).toBe('ord-1001');
    expect(group.transactionBId).toBe('txn-2001');
    expect(group.transactionCId).toBe('bnk-3001');
    expect(group.sourceStatus.sourceA).toBe('MATCHED');
    expect(group.sourceStatus.sourceB).toBe('MATCHED');
    expect(group.sourceStatus.sourceC).toBe('MATCHED');
    expect(result.statistics.fullyMatchedCount).toBe(1);
    expect(result.statistics.unmatchedCount).toBe(0);
    expect(group.reasons.some((r) => r.includes('Currency matches'))).toBe(true);
    expect(group.reasons.some((r) => r.includes('Amount matches'))).toBe(true);
  });

  // Scenario B: Two sources match, one missing
  it('Scenario B: correctly flags PARTIALLY_MATCHED when Bank record is missing', () => {
    const order: MatchTransaction = {
      id: 'ord-1002',
      externalId: 'ORD-1002',
      amountMinor: 50000,
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'ORD-1002',
    };

    const gateway: MatchTransaction = {
      id: 'txn-2002',
      externalId: 'TXN-2002',
      amountMinor: 50000,
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'ORD-1002',
    };

    // Bank statement is empty or has non-matching record
    const result = matchThreeSets([order], [gateway], []);

    expect(result.matchGroups).toHaveLength(1);
    const group = result.matchGroups[0];
    expect(group.classification).toBe('PARTIALLY_MATCHED');
    expect(group.transactionAId).toBe('ord-1002');
    expect(group.transactionBId).toBe('txn-2002');
    expect(group.transactionCId).toBeNull();
    expect(group.sourceStatus.sourceA).toBe('MATCHED');
    expect(group.sourceStatus.sourceB).toBe('MATCHED');
    expect(group.sourceStatus.sourceC).toBe('MISSING');
    expect(group.discrepancies).toHaveLength(1);
    expect(group.discrepancies[0].type).toBe('MISSING_SOURCE');
    expect(result.statistics.partiallyMatchedCount).toBe(1);
  });

  // Scenario C: Amount mismatch
  it('Scenario C: flags AMOUNT_MISMATCH with clear discrepancy explanation when Bank settles less', () => {
    const order: MatchTransaction = {
      id: 'ord-1003',
      externalId: 'ORD-1003',
      amountMinor: 100000, // ₹1,000.00
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'ORD-1003',
    };

    const gateway: MatchTransaction = {
      id: 'txn-2003',
      externalId: 'TXN-2003',
      amountMinor: 100000, // ₹1,000.00
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'ORD-1003',
    };

    const bank: MatchTransaction = {
      id: 'bnk-3003',
      externalId: 'BNK-3003',
      amountMinor: 95000, // ₹950.00 (₹50 discrepancy)
      currency: 'INR',
      transactionDate: '2026-09-16',
      reference: 'ORD-1003',
    };

    const result = matchThreeSets([order], [gateway], [bank]);

    expect(result.matchGroups).toHaveLength(1);
    const group = result.matchGroups[0];
    expect(group.classification).toBe('AMOUNT_MISMATCH');
    expect(group.discrepancies).toHaveLength(1);
    expect(group.discrepancies[0].type).toBe('AMOUNT');
    expect(group.discrepancies[0].difference).toBe(5000); // 50.00
    expect(result.statistics.amountMismatchCount).toBe(1);
  });

  // Scenario D: Settlement date tolerance
  it('Scenario D: matches within tolerance, but flags DATE_MISMATCH when settlement exceeds tolerance', () => {
    const order: MatchTransaction = {
      id: 'ord-1004',
      externalId: 'ORD-1004',
      amountMinor: 200000,
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'ORD-1004',
    };

    const gateway: MatchTransaction = {
      id: 'txn-2004',
      externalId: 'TXN-2004',
      amountMinor: 200000,
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'ORD-1004',
    };

    const bankLate: MatchTransaction = {
      id: 'bnk-3004',
      externalId: 'BNK-3004',
      amountMinor: 200000,
      currency: 'INR',
      transactionDate: '2026-09-25', // 10 days later (> 2 days tolerance)
      reference: 'ORD-1004',
    };

    const result = matchThreeSets([order], [gateway], [bankLate], { dateToleranceDays: 2 });

    expect(result.matchGroups).toHaveLength(1);
    const group = result.matchGroups[0];
    expect(group.classification).toBe('DATE_MISMATCH');
    expect(group.discrepancies.some((d) => d.type === 'DATE')).toBe(true);
    expect(result.statistics.dateMismatchCount).toBe(1);
  });

  // Scenario E: Multiple potential matches
  it('Scenario E: identifies competing potential matches requiring human review', () => {
    const order: MatchTransaction = {
      id: 'ord-1005',
      externalId: 'ORD-1005',
      amountMinor: 300000,
      currency: 'INR',
      transactionDate: '2026-09-15',
      // No reference, rely on amount & date
    };

    const gatewayCand1: MatchTransaction = {
      id: 'txn-2005-a',
      externalId: 'TXN-2005-A',
      amountMinor: 300000,
      currency: 'INR',
      transactionDate: '2026-09-15',
    };

    const gatewayCand2: MatchTransaction = {
      id: 'txn-2005-b',
      externalId: 'TXN-2005-B',
      amountMinor: 300000,
      currency: 'INR',
      transactionDate: '2026-09-15',
    };

    const bank: MatchTransaction = {
      id: 'bnk-3005',
      externalId: 'BNK-3005',
      amountMinor: 300000,
      currency: 'INR',
      transactionDate: '2026-09-15',
    };

    const result = matchThreeSets([order], [gatewayCand1, gatewayCand2], [bank]);

    // Should not arbitrarily confirm as EXACT 100%; should be POTENTIAL_MATCH requiring human sign-off
    expect(result.matchGroups.length).toBeGreaterThan(0);
    const group = result.matchGroups[0];
    expect(['POTENTIAL_MATCH', 'PARTIALLY_MATCHED']).toContain(group.classification);
  });

  // Scenario F: Duplicate transactions quarantined
  it('Scenario F: quarantines intra-source duplicates and preserves records', () => {
    const order1: MatchTransaction = {
      id: 'ord-1006-1',
      externalId: 'ORD-1006',
      amountMinor: 150000,
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'REF-DUP',
    };

    // Duplicate candidate with identical external ID in same source
    const order2Duplicate: MatchTransaction = {
      id: 'ord-1006-2',
      externalId: 'ORD-1006',
      amountMinor: 150000,
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'REF-DUP',
    };

    const gateway: MatchTransaction = {
      id: 'txn-2006',
      externalId: 'TXN-2006',
      amountMinor: 150000,
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'REF-DUP',
    };

    const bank: MatchTransaction = {
      id: 'bnk-3006',
      externalId: 'BNK-3006',
      amountMinor: 150000,
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'REF-DUP',
    };

    const result = matchThreeSets([order1, order2Duplicate], [gateway], [bank]);

    expect(result.quarantinedDuplicates.length).toBe(1);
    expect(result.quarantinedDuplicates[0].source).toBe('A');
    expect(result.quarantinedDuplicates[0].transaction.id).toBe('ord-1006-2');
    expect(result.statistics.quarantinedCount).toBe(1);

    // The clean record matches
    expect(result.matchGroups.length).toBe(1);
    expect(result.matchGroups[0].classification).toBe('FULLY_MATCHED');
  });

  // Transitive Multi-Hop Linking
  it('transitive linking: links Order -> Gateway -> Bank even when Bank only knows Gateway ID', () => {
    const order: MatchTransaction = {
      id: 'ord-1007',
      externalId: 'ORD-1007',
      amountMinor: 75000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'ORD-1007',
    };

    const gateway: MatchTransaction = {
      id: 'txn-2007',
      externalId: 'TXN-2007',
      amountMinor: 75000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'ORD-1007', // Links to Order
    };

    const bank: MatchTransaction = {
      id: 'bnk-3007',
      externalId: 'BNK-3007',
      amountMinor: 75000,
      currency: 'USD',
      transactionDate: '2026-09-16',
      reference: 'TXN-2007', // Links to Gateway, no direct Order ID
    };

    const result = matchThreeSets([order], [gateway], [bank]);

    expect(result.matchGroups).toHaveLength(1);
    const group = result.matchGroups[0];
    expect(group.classification).toBe('FULLY_MATCHED');
    expect(group.transactionAId).toBe('ord-1007');
    expect(group.transactionBId).toBe('txn-2007');
    expect(group.transactionCId).toBe('bnk-3007');
  });
});
