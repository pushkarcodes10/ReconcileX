import { describe, expect, it } from 'vitest';
import { matchTwoSets } from '../src/match-two-sets';
import { MatchTransaction } from '../src/types';

describe('Greedy Two-Set Matching Engine (matchTwoSets)', () => {
  it('handles the canonical PRD Section 9 business scenario (ORD-1001 vs TXN-7832 vs BNK-1129)', () => {
    // Internal Order
    const order: MatchTransaction = {
      id: 'ord-1001-id',
      externalId: 'ORD-1001',
      amountMinor: 99900, // ₹999.00
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'ORD-1001',
    };

    // Payment Gateway
    const gateway: MatchTransaction = {
      id: 'txn-7832-id',
      externalId: 'TXN-7832',
      amountMinor: 99900, // ₹999.00
      currency: 'INR',
      transactionDate: '2026-09-15',
      reference: 'ORD-1001',
    };

    // Bank Statement (no reference available)
    const bank: MatchTransaction = {
      id: 'bnk-1129-id',
      externalId: 'BNK-1129',
      amountMinor: 99900, // ₹999.00
      currency: 'INR',
      transactionDate: '2026-09-16', // settled 1 day later
    };

    // 1. Order vs Gateway -> Exact Match
    const orderGatewayResult = matchTwoSets([order], [gateway]);
    expect(orderGatewayResult.acceptedMatches).toHaveLength(1);
    expect(orderGatewayResult.acceptedMatches[0].classification).toBe('EXACT');
    expect(orderGatewayResult.acceptedMatches[0].score).toBe(100);
    expect(orderGatewayResult.acceptedMatches[0].reasons).toEqual(['REFERENCE', 'AMOUNT']);
    expect(orderGatewayResult.unmatchedIdsA).toHaveLength(0);
    expect(orderGatewayResult.unmatchedIdsB).toHaveLength(0);

    // 2. Gateway vs Bank -> Bank has no reference, but same amount and 1-day date difference
    // Under default config (threshold potential = 60), amount (30) + date (13) = 43 (NO_MATCH).
    // With configured potential threshold = 40 (or amount weight = 50), it classifies as POTENTIAL
    const bankReviewConfig = {
      thresholds: {
        exact: 100,
        potentialStrong: 80,
        potential: 40,
      },
    };
    const gatewayBankResult = matchTwoSets([gateway], [bank], bankReviewConfig);
    expect(gatewayBankResult.acceptedMatches).toHaveLength(1);
    expect(gatewayBankResult.acceptedMatches[0].classification).toBe('POTENTIAL');
    expect(gatewayBankResult.acceptedMatches[0].score).toBe(43);
    expect(gatewayBankResult.acceptedMatches[0].reasons).toEqual(['AMOUNT', 'DATE']);
  });

  it('can produce a potential match for same amount with a one-day date difference', () => {
    const txnA: MatchTransaction = {
      id: 'txn-a',
      amountMinor: 25000,
      currency: 'USD',
      transactionDate: '2026-09-15',
    };
    const txnB: MatchTransaction = {
      id: 'txn-b',
      amountMinor: 25000,
      currency: 'USD',
      transactionDate: '2026-09-16', // 1 day diff
    };

    // Configure potential threshold = 40 so amount (30) + date (13) = 43 qualifies as POTENTIAL
    const result = matchTwoSets([txnA], [txnB], {
      thresholds: { potential: 40 },
    });

    expect(result.acceptedMatches).toHaveLength(1);
    expect(result.acceptedMatches[0].classification).toBe('POTENTIAL');
    expect(result.acceptedMatches[0].score).toBe(43);
    expect(result.acceptedMatches[0].reasons).toEqual(['AMOUNT', 'DATE']);
  });

  it('never matches transactions with different currencies', () => {
    const txnA: MatchTransaction = {
      id: 'txn-usd',
      amountMinor: 10000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'IDENTICAL-REF',
    };
    const txnB: MatchTransaction = {
      id: 'txn-eur',
      amountMinor: 10000,
      currency: 'EUR',
      transactionDate: '2026-09-15',
      reference: 'IDENTICAL-REF',
    };

    const result = matchTwoSets([txnA], [txnB]);
    expect(result.acceptedMatches).toHaveLength(0);
    expect(result.unmatchedIdsA).toEqual(['txn-usd']);
    expect(result.unmatchedIdsB).toEqual(['txn-eur']);
    expect(result.statistics.unmatchedACount).toBe(1);
    expect(result.statistics.unmatchedBCount).toBe(1);
  });

  it('returns unmatched transactions correctly', () => {
    const txnA1: MatchTransaction = {
      id: 'a1',
      amountMinor: 1000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'REF-1',
    };
    const txnA2: MatchTransaction = {
      id: 'a2',
      amountMinor: 2000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'REF-2',
    };
    const txnB1: MatchTransaction = {
      id: 'b1',
      amountMinor: 1000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'REF-1',
    };
    const txnB3: MatchTransaction = {
      id: 'b3',
      amountMinor: 9999,
      currency: 'USD',
      transactionDate: '2026-09-29',
      reference: 'REF-NONE',
    };

    const result = matchTwoSets([txnA1, txnA2], [txnB1, txnB3]);

    expect(result.acceptedMatches).toHaveLength(1);
    expect(result.acceptedMatches[0].transactionAId).toBe('a1');
    expect(result.acceptedMatches[0].transactionBId).toBe('b1');
    expect(result.unmatchedIdsA).toEqual(['a2']);
    expect(result.unmatchedIdsB).toEqual(['b3']);
    expect(result.statistics.totalAcceptedMatches).toBe(1);
    expect(result.statistics.unmatchedACount).toBe(1);
    expect(result.statistics.unmatchedBCount).toBe(1);
  });

  it('handles empty input arrays safely', () => {
    const result1 = matchTwoSets([], []);
    expect(result1.acceptedMatches).toHaveLength(0);
    expect(result1.unmatchedIdsA).toHaveLength(0);
    expect(result1.statistics.totalAcceptedMatches).toBe(0);

    const singleA: MatchTransaction = {
      id: 'a-lone',
      amountMinor: 5000,
      currency: 'USD',
      transactionDate: '2026-09-15',
    };
    const result2 = matchTwoSets([singleA], []);
    expect(result2.acceptedMatches).toHaveLength(0);
    expect(result2.unmatchedIdsA).toEqual(['a-lone']);
    expect(result2.statistics.unmatchedACount).toBe(1);
  });

  it('enforces greedy selection and prevents double matching (1:1 cardinality)', () => {
    // Contention scenario:
    // A1 matches B1 with score 100 (Exact Ref + Exact Amt)
    // A1 matches B2 with score 80 (Amt + Date + Similar Ref)
    // A2 matches B1 with score 80 (Amt + Date + Similar Ref)
    const a1: MatchTransaction = {
      id: 'A1',
      amountMinor: 10000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'REF-X',
    };
    const a2: MatchTransaction = {
      id: 'A2',
      amountMinor: 10000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'REF-X-SUB',
    };
    const b1: MatchTransaction = {
      id: 'B1',
      amountMinor: 10000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'REF-X',
    };
    const b2: MatchTransaction = {
      id: 'B2',
      amountMinor: 10000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'REF-X-SUB',
    };

    const result = matchTwoSets([a1, a2], [b1, b2]);

    // A1 locks in with B1 (score 100)
    // A2 then pairs with B2 (score 100)
    expect(result.acceptedMatches).toHaveLength(2);
    expect(result.acceptedMatches.find((m) => m.transactionAId === 'A1')?.transactionBId).toBe(
      'B1',
    );
    expect(result.acceptedMatches.find((m) => m.transactionAId === 'A2')?.transactionBId).toBe(
      'B2',
    );
    expect(result.unmatchedIdsA).toHaveLength(0);
    expect(result.unmatchedIdsB).toHaveLength(0);
  });

  it('resolves equal-score ties deterministically regardless of input order', () => {
    const a1: MatchTransaction = {
      id: 'A-ALPHA',
      amountMinor: 5000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'COMMON',
    };
    const a2: MatchTransaction = {
      id: 'A-BETA',
      amountMinor: 5000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'COMMON',
    };
    const b1: MatchTransaction = {
      id: 'B-ONE',
      amountMinor: 5000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'COMMON',
    };

    // Both A-ALPHA and A-BETA have score 100 with B-ONE.
    // Order 1: [A-ALPHA, A-BETA] vs [B-ONE]
    const res1 = matchTwoSets([a1, a2], [b1]);
    // Order 2: [A-BETA, A-ALPHA] vs [B-ONE]
    const res2 = matchTwoSets([a2, a1], [b1]);

    // Deterministic tie-breaking on ID sorts A-ALPHA before A-BETA
    expect(res1.acceptedMatches[0].transactionAId).toBe('A-ALPHA');
    expect(res2.acceptedMatches[0].transactionAId).toBe('A-ALPHA');
    expect(res1.acceptedMatches[0].transactionBId).toBe('B-ONE');
    expect(res2.acceptedMatches[0].transactionBId).toBe('B-ONE');
  });

  it('does not mutate input arrays or transaction objects', () => {
    const originalA: MatchTransaction = {
      id: 'imm-a',
      amountMinor: 1000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'ORIG-A',
    };
    const originalB: MatchTransaction = {
      id: 'imm-b',
      amountMinor: 1000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'ORIG-A',
    };

    const arrayA = Object.freeze([Object.freeze({ ...originalA })]);
    const arrayB = Object.freeze([Object.freeze({ ...originalB })]);

    expect(() => matchTwoSets(arrayA, arrayB)).not.toThrow();
  });

  it('handles duplicate transaction IDs safely by deduplicating on first occurrence', () => {
    // Two transactions in set A with identical id
    const aDup1: MatchTransaction = {
      id: 'dup-id',
      amountMinor: 1000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'FIRST-OCCURRENCE',
    };
    const aDup2: MatchTransaction = {
      id: 'dup-id',
      amountMinor: 2000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'SECOND-OCCURRENCE',
    };
    const b: MatchTransaction = {
      id: 'b-single',
      amountMinor: 1000,
      currency: 'USD',
      transactionDate: '2026-09-15',
      reference: 'FIRST-OCCURRENCE',
    };

    const result = matchTwoSets([aDup1, aDup2], [b]);

    // Only the first occurrence was matched
    expect(result.acceptedMatches).toHaveLength(1);
    expect(result.acceptedMatches[0].transactionA.reference).toBe('FIRST-OCCURRENCE');
    expect(result.acceptedMatches[0].transactionAId).toBe('dup-id');
  });

  it('allows custom configuration to alter matching behavior', () => {
    const txnA: MatchTransaction = {
      id: 'txn-a-date',
      amountMinor: 50000,
      currency: 'USD',
      transactionDate: '2026-09-15',
    };
    const txnB: MatchTransaction = {
      id: 'txn-b-date',
      amountMinor: 50000,
      currency: 'USD',
      transactionDate: '2026-09-19', // 4 days difference
    };

    // Under default config (dateToleranceDays = 2), 4 days difference gets 0 date points (score = 30 -> NO_MATCH)
    const defaultRes = matchTwoSets([txnA], [txnB]);
    expect(defaultRes.acceptedMatches).toHaveLength(0);

    // With custom dateToleranceDays = 5 and potential threshold = 35:
    // date score for 4 days difference with tolerance 5: Math.round(20 * (1 - 4/6)) = Math.round(6.67) = 7
    // total = 30 + 7 = 37 >= 35 (POTENTIAL)
    const customRes = matchTwoSets([txnA], [txnB], {
      dateToleranceDays: 5,
      thresholds: { potential: 35 },
    });
    expect(customRes.acceptedMatches).toHaveLength(1);
    expect(customRes.acceptedMatches[0].classification).toBe('POTENTIAL');
  });
});
