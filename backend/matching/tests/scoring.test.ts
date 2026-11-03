import { describe, expect, it } from 'vitest';
import { resolveAndValidateConfig } from '../src/config';
import { calculateDateScore, scorePair } from '../src/scoring';
import { MatchTransaction } from '../src/types';

describe('Pairwise Scoring Engine', () => {
  const baseTxnA: MatchTransaction = {
    id: 'txn-a-1',
    amountMinor: 99900,
    currency: 'INR',
    transactionDate: '2026-09-15',
    reference: 'ORD-1001',
    externalId: 'EXT-1001',
  };

  const baseTxnB: MatchTransaction = {
    id: 'txn-b-1',
    amountMinor: 99900,
    currency: 'INR',
    transactionDate: '2026-09-15',
    reference: 'ORD-1001',
    externalId: 'EXT-1001',
  };

  it('produces score 100 and EXACT classification for exact reference + exact amount (Rule 2)', () => {
    const result = scorePair(baseTxnA, baseTxnB);

    expect(result.score).toBe(100);
    expect(result.classification).toBe('EXACT');
    expect(result.isEligible).toBe(true);
    expect(result.reasons).toEqual(['REFERENCE', 'AMOUNT']);
    expect(result.metadata.referenceRelation).toBe('EXACT');
    expect(result.metadata.amountDeltaMinor).toBe(0);
  });

  it('awards configured amount weight for exact amount match', () => {
    // Different reference, different dates outside tolerance, but matching amount
    const txnA: MatchTransaction = {
      ...baseTxnA,
      reference: 'REF-ALPHA',
      transactionDate: '2026-09-10',
    };
    const txnB: MatchTransaction = {
      ...baseTxnB,
      reference: 'REF-BETA',
      transactionDate: '2026-09-20',
      externalId: 'DIFF-ID',
    };

    const result = scorePair(txnA, txnB);

    expect(result.contributions.amount).toBe(30);
    expect(result.reasons).toContain('AMOUNT');
    expect(result.score).toBe(30);
    expect(result.classification).toBe('NO_MATCH');
  });

  it('awards maximum date score for same-day transactions', () => {
    const score = calculateDateScore(0, 2, 20);
    expect(score).toBe(20);

    // Multi-attribute pair with same date
    const txnA: MatchTransaction = {
      ...baseTxnA,
      reference: undefined,
      externalId: undefined,
    };
    const txnB: MatchTransaction = {
      ...baseTxnB,
      reference: undefined,
      externalId: undefined,
    };

    const result = scorePair(txnA, txnB);
    expect(result.contributions.date).toBe(20);
    expect(result.reasons).toContain('DATE');
  });

  it('applies linear taper for a 1-day date difference', () => {
    // tolerance = 2, maxWeight = 20: Math.round(20 * (1 - 1/3)) = 13
    const taperedScore = calculateDateScore(1, 2, 20);
    expect(taperedScore).toBe(13);

    const txnA: MatchTransaction = {
      ...baseTxnA,
      reference: undefined,
      transactionDate: '2026-09-15',
      externalId: undefined,
    };
    const txnB: MatchTransaction = {
      ...baseTxnB,
      reference: undefined,
      transactionDate: '2026-09-16',
      externalId: undefined,
    };

    const result = scorePair(txnA, txnB);
    expect(result.dateDifferenceDays).toBe(1);
    expect(result.contributions.date).toBe(13);
    expect(result.reasons).toContain('DATE');
  });

  it('awards zero date points when date difference is outside tolerance', () => {
    // 3 days difference with tolerance of 2 days
    const score = calculateDateScore(3, 2, 20);
    expect(score).toBe(0);

    const txnA: MatchTransaction = {
      ...baseTxnA,
      reference: undefined,
      transactionDate: '2026-09-15',
      externalId: undefined,
    };
    const txnB: MatchTransaction = {
      ...baseTxnB,
      reference: undefined,
      transactionDate: '2026-09-25',
      externalId: undefined,
    };

    const result = scorePair(txnA, txnB);
    expect(result.contributions.date).toBe(0);
    expect(result.reasons).not.toContain('DATE');
  });

  it('contributes configured reference weight for exact reference match', () => {
    // Different amounts so Rule 2 does not bypass, testing individual reference contribution
    const txnA: MatchTransaction = {
      ...baseTxnA,
      amountMinor: 50000,
      transactionDate: '2026-09-10',
      externalId: undefined,
    };
    const txnB: MatchTransaction = {
      ...baseTxnB,
      amountMinor: 60000,
      transactionDate: '2026-09-25',
      externalId: undefined,
    };

    const result = scorePair(txnA, txnB);
    expect(result.contributions.reference).toBe(50);
    expect(result.reasons).toContain('REFERENCE');
    expect(result.score).toBe(50);
  });

  it('awards smaller similarity contribution for contains-based reference similarity', () => {
    const txnA: MatchTransaction = {
      ...baseTxnA,
      reference: 'INV-1001',
      amountMinor: 50000,
      transactionDate: '2026-09-10',
      externalId: undefined,
    };
    const txnB: MatchTransaction = {
      ...baseTxnB,
      reference: 'ORDER-INV-1001-SETTLED',
      amountMinor: 60000,
      transactionDate: '2026-09-25',
      externalId: undefined,
    };

    const result = scorePair(txnA, txnB);
    expect(result.contributions.reference).toBe(30);
    expect(result.reasons).toContain('REFERENCE_SIMILAR');
    expect(result.metadata.referenceRelation).toBe('SIMILAR');
  });

  it('contributes configured weight when external identifiers match', () => {
    const txnA: MatchTransaction = {
      id: 'txn-a-ext',
      amountMinor: 50000,
      currency: 'INR',
      transactionDate: '2026-09-10',
      externalId: 'EXT-ORDER-99',
    };
    const txnB: MatchTransaction = {
      id: 'txn-b-ext',
      amountMinor: 60000,
      currency: 'INR',
      transactionDate: '2026-09-25',
      merchantOrOrderId: 'EXT-ORDER-99',
    };

    const result = scorePair(txnA, txnB);
    expect(result.contributions.externalIdentifier).toBe(20);
    expect(result.reasons).toContain('EXTERNAL_IDENTIFIER');
    expect(result.metadata.externalIdentifierMatch).toBe(true);
  });

  it('treats currency mismatch as completely ineligible with score zero', () => {
    const txnA: MatchTransaction = { ...baseTxnA, currency: 'USD' };
    const txnB: MatchTransaction = { ...baseTxnB, currency: 'INR' };

    const result = scorePair(txnA, txnB);
    expect(result.score).toBe(0);
    expect(result.isEligible).toBe(false);
    expect(result.classification).toBe('NO_MATCH');
    expect(result.reasons).toEqual(['CURRENCY_MISMATCH']);
    expect(result.metadata.currencyMatch).toBe(false);
  });

  it('ensures final score never exceeds 100', () => {
    // Custom config with very high weights that sum above 100
    const highWeightConfig = {
      weights: {
        amount: 50,
        date: 40,
        reference: 60,
        externalIdentifier: 30,
      },
    };

    const txnA: MatchTransaction = {
      ...baseTxnA,
      reference: 'REF-OVERFLOW',
      externalId: 'ID-OVERFLOW',
    };
    const txnB: MatchTransaction = {
      ...baseTxnB,
      amountMinor: 99901, // slightly different amount so Rule 2 doesn't short-circuit
      reference: 'REF-OVERFLOW',
      externalId: 'ID-OVERFLOW',
    };

    const result = scorePair(txnA, txnB, highWeightConfig);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBe(100);
  });

  it('rejects invalid configurations', () => {
    expect(() => resolveAndValidateConfig({ dateToleranceDays: -1 })).toThrowError(
      /dateToleranceDays must be a non-negative number/,
    );

    expect(() =>
      resolveAndValidateConfig({
        thresholds: { exact: 70, potentialStrong: 80, potential: 60 },
      }),
    ).toThrowError(/thresholds must satisfy exact >= potentialStrong >= potential/);

    expect(() =>
      resolveAndValidateConfig({
        weights: { amount: -5 },
      }),
    ).toThrowError(/weight 'amount' must be a non-negative number/);
  });
});
