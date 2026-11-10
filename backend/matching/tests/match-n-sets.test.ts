import { describe, expect, it } from 'vitest';
import { matchNSets } from '../src/match-n-sets';
import { MatchTransaction, SourceInput } from '../src/types';

describe('Generalized N-Source (4-Way) Reconciliation Engine', () => {
  it('Scenario A: 4-Way Full Match across Internal Orders, Gateway, Bank, and Screenshot', () => {
    // Transaction matching across 4 feeds:
    // A: ORD-1001 (₹999, 15 Sep)
    // B: TXN-2001 (₹999, ref=ORD-1001, 15 Sep)
    // C: BNK-3001 (₹999, extTxnId=TXN-2001, 16 Sep)
    // D: UPI-IMG-4001 (₹999, ref=ORD-1001, 15 Sep)
    const sourceA: SourceInput = {
      id: 'src-orders',
      name: 'Internal Orders',
      transactions: [
        {
          id: 'ord-1001',
          externalId: 'ORD-1001',
          amountMinor: 99900,
          currency: 'INR',
          transactionDate: '2026-09-15',
        },
      ],
    };

    const sourceB: SourceInput = {
      id: 'src-gateway',
      name: 'Payment Gateway',
      transactions: [
        {
          id: 'txn-2001',
          externalId: 'TXN-2001',
          reference: 'ORD-1001',
          amountMinor: 99900,
          currency: 'INR',
          transactionDate: '2026-09-15',
        },
      ],
    };

    const sourceC: SourceInput = {
      id: 'src-bank',
      name: 'Bank Statement',
      transactions: [
        {
          id: 'bnk-3001',
          externalId: 'BNK-3001',
          externalTxnId: 'TXN-2001',
          amountMinor: 99900,
          currency: 'INR',
          transactionDate: '2026-09-16', // 1 day settlement delay
        },
      ],
    };

    const sourceD: SourceInput = {
      id: 'src-screenshot',
      name: 'Screenshot Ingestion',
      transactions: [
        {
          id: 'upi-4001',
          externalId: 'UPI-IMG-4001',
          reference: 'ORD-1001',
          amountMinor: 99900,
          currency: 'INR',
          transactionDate: '2026-09-15',
        },
      ],
    };

    const result = matchNSets([sourceA, sourceB, sourceC, sourceD], { dateToleranceDays: 2 });

    expect(result.matchGroups).toHaveLength(1);
    const group = result.matchGroups[0];

    expect(group.reconciliationType).toBe('FOUR_SOURCE');
    expect(group.classification).toBe('FULLY_MATCHED');
    expect(group.score).toBeGreaterThanOrEqual(90);
    expect(group.transactionAId).toBe('ord-1001');
    expect(group.transactionBId).toBe('txn-2001');
    expect(group.transactionCId).toBe('bnk-3001');
    expect(group.transactionDId).toBe('upi-4001');
    expect(group.discrepancies).toHaveLength(0);

    // Unmatched should be empty
    expect(result.unmatchedBySourceId['src-orders']).toHaveLength(0);
    expect(result.unmatchedBySourceId['src-gateway']).toHaveLength(0);
    expect(result.unmatchedBySourceId['src-bank']).toHaveLength(0);
    expect(result.unmatchedBySourceId['src-screenshot']).toHaveLength(0);
    expect(result.statistics.fullyMatchedCount).toBe(1);
  });

  it('Scenario B: 4-Way Partial Match (Screenshot feed is missing)', () => {
    const sourceA: SourceInput = {
      id: 'src-a',
      name: 'Orders',
      transactions: [
        {
          id: 'a-1',
          externalId: 'ORD-1002',
          amountMinor: 50000,
          currency: 'INR',
          transactionDate: '2026-09-15',
        },
      ],
    };

    const sourceB: SourceInput = {
      id: 'src-b',
      name: 'Gateway',
      transactions: [
        {
          id: 'b-1',
          externalId: 'TXN-2002',
          reference: 'ORD-1002',
          amountMinor: 50000,
          currency: 'INR',
          transactionDate: '2026-09-15',
        },
      ],
    };

    const sourceC: SourceInput = {
      id: 'src-c',
      name: 'Bank',
      transactions: [
        {
          id: 'c-1',
          externalId: 'BNK-3002',
          externalTxnId: 'TXN-2002',
          amountMinor: 50000,
          currency: 'INR',
          transactionDate: '2026-09-16',
        },
      ],
    };

    const sourceD: SourceInput = {
      id: 'src-d',
      name: 'Screenshot',
      transactions: [], // No screenshot record
    };

    const result = matchNSets([sourceA, sourceB, sourceC, sourceD], { dateToleranceDays: 2 });

    expect(result.matchGroups).toHaveLength(1);
    const group = result.matchGroups[0];

    expect(group.classification).toBe('PARTIALLY_MATCHED');
    expect(group.transactionAId).toBe('a-1');
    expect(group.transactionBId).toBe('b-1');
    expect(group.transactionCId).toBe('c-1');
    expect(group.transactionDId).toBeNull();

    expect(group.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'MISSING_SOURCE',
          field: 'src-d',
        }),
      ]),
    );
  });

  it('Scenario C: 4-Way Amount Mismatch (Screenshot amount differs from ledger)', () => {
    const sourceA: SourceInput = {
      id: 'src-a',
      name: 'Orders',
      transactions: [
        { id: 'a-1', externalId: 'ORD-1003', amountMinor: 100000, currency: 'INR', transactionDate: '2026-09-15' },
      ],
    };
    const sourceB: SourceInput = {
      id: 'src-b',
      name: 'Gateway',
      transactions: [
        { id: 'b-1', externalId: 'TXN-2003', reference: 'ORD-1003', amountMinor: 100000, currency: 'INR', transactionDate: '2026-09-15' },
      ],
    };
    const sourceC: SourceInput = {
      id: 'src-c',
      name: 'Bank',
      transactions: [
        { id: 'c-1', externalId: 'BNK-3003', externalTxnId: 'TXN-2003', amountMinor: 100000, currency: 'INR', transactionDate: '2026-09-16' },
      ],
    };
    const sourceD: SourceInput = {
      id: 'src-d',
      name: 'Screenshot',
      transactions: [
        { id: 'd-1', externalId: 'IMG-4003', reference: 'ORD-1003', amountMinor: 95000, currency: 'INR', transactionDate: '2026-09-15' },
      ],
    };

    const result = matchNSets([sourceA, sourceB, sourceC, sourceD]);

    expect(result.matchGroups).toHaveLength(1);
    const group = result.matchGroups[0];

    expect(group.classification).toBe('AMOUNT_MISMATCH');
    expect(group.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'AMOUNT',
          difference: 5000,
        }),
      ]),
    );
  });

  it('Scenario D: Preserves 1:1:1:1 invariant preventing double matching', () => {
    // 1 transaction in A, 2 competing candidate transactions in B
    const sourceA: SourceInput = {
      id: 'src-a',
      name: 'Orders',
      transactions: [
        { id: 'a-1', externalId: 'ORD-SINGLE', amountMinor: 5000, currency: 'INR', transactionDate: '2026-09-15' },
      ],
    };
    const sourceB: SourceInput = {
      id: 'src-b',
      name: 'Gateway',
      transactions: [
        { id: 'b-1', externalId: 'TXN-1', reference: 'ORD-SINGLE', amountMinor: 5000, currency: 'INR', transactionDate: '2026-09-15' },
        { id: 'b-2', externalId: 'TXN-2', reference: 'TXN-DIFF', amountMinor: 5000, currency: 'INR', transactionDate: '2026-09-15' },
      ],
    };

    const result = matchNSets([sourceA, sourceB]);

    expect(result.matchGroups).toHaveLength(1);
    expect(result.unmatchedBySourceId['src-b']).toHaveLength(1);
    expect(result.unmatchedBySourceId['src-b'][0].id).toBe('b-2');
  });

  it('Scenario E: Correctly identifies and quarantines intra-source duplicates in N-source reconciliation', () => {
    const sourceA: SourceInput = {
      id: 'src-a',
      name: 'Orders',
      transactions: [
        { id: 'a-1', externalId: 'ORD-100', amountMinor: 10000, currency: 'INR', transactionDate: '2026-09-15' },
        { id: 'a-dup', externalId: 'ORD-100', amountMinor: 10000, currency: 'INR', transactionDate: '2026-09-15' },
      ],
    };
    const sourceB: SourceInput = {
      id: 'src-b',
      name: 'Gateway',
      transactions: [
        { id: 'b-1', externalId: 'TXN-100', reference: 'ORD-100', amountMinor: 10000, currency: 'INR', transactionDate: '2026-09-15' },
      ],
    };

    const result = matchNSets([sourceA, sourceB]);
    expect(result.quarantinedDuplicates).toHaveLength(1);
    expect(result.quarantinedDuplicates[0].transaction.id).toBe('a-dup');
    expect(result.statistics.quarantinedCount).toBe(1);
    expect(result.matchGroups).toHaveLength(1);
  });
});
