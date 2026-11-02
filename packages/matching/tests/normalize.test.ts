import { describe, expect, it } from 'vitest';
import { normalizeCurrency, normalizeIdentifier, normalizeReference } from '../src/normalize';
import { calculateDateDifferenceDays } from '../src/utils/date-difference';

describe('Normalization Rules', () => {
  describe('normalizeReference', () => {
    it('normalizes references with different casing consistently', () => {
      expect(normalizeReference('ORD-1001')).toBe('ord-1001');
      expect(normalizeReference('ord-1001')).toBe('ord-1001');
      expect(normalizeReference('OrD-1001')).toBe('ord-1001');
    });

    it('ignores leading and trailing whitespace', () => {
      expect(normalizeReference('   INV-9988   ')).toBe('inv-9988');
      expect(normalizeReference('\tPAY-1234\n')).toBe('pay-1234');
    });

    it('treats empty strings and whitespace-only strings as missing (undefined)', () => {
      expect(normalizeReference('')).toBeUndefined();
      expect(normalizeReference('   ')).toBeUndefined();
      expect(normalizeReference(null)).toBeUndefined();
      expect(normalizeReference(undefined)).toBeUndefined();
    });

    it('preserves meaningful characters without inventing or truncating content', () => {
      expect(normalizeReference('REF_2026/09/15#01')).toBe('ref_2026/09/15#01');
      expect(normalizeReference('txn-alpha.beta')).toBe('txn-alpha.beta');
    });
  });

  describe('normalizeIdentifier', () => {
    it('normalizes external identifiers and merchant/order IDs consistently', () => {
      expect(normalizeIdentifier('ORD-5544')).toBe('ord-5544');
      expect(normalizeIdentifier('  TXN-9981  ')).toBe('txn-9981');
      expect(normalizeIdentifier('')).toBeUndefined();
      expect(normalizeIdentifier('   ')).toBeUndefined();
      expect(normalizeIdentifier(null)).toBeUndefined();
      expect(normalizeIdentifier(undefined)).toBeUndefined();
    });
  });

  describe('normalizeCurrency', () => {
    it('normalizes currency codes to uppercase ISO strings', () => {
      expect(normalizeCurrency('inr')).toBe('INR');
      expect(normalizeCurrency('   usd  ')).toBe('USD');
      expect(normalizeCurrency('eur')).toBe('EUR');
    });

    it('returns empty string for null, undefined, or empty values', () => {
      expect(normalizeCurrency('')).toBe('');
      expect(normalizeCurrency(null)).toBe('');
      expect(normalizeCurrency(undefined)).toBe('');
    });
  });

  describe('calculateDateDifferenceDays', () => {
    it('compares dates without timezone shifts across calendar boundaries', () => {
      // 15 Sep 2026 vs 16 Sep 2026 = 1 calendar day
      expect(calculateDateDifferenceDays('2026-09-15', '2026-09-16')).toBe(1);

      // Same calendar day = 0
      expect(calculateDateDifferenceDays('2026-09-15', '2026-09-15')).toBe(0);

      // Multi-day gap
      expect(calculateDateDifferenceDays('2026-09-15', '2026-09-18')).toBe(3);

      // Order independent (A vs B or B vs A is identical)
      expect(calculateDateDifferenceDays('2026-09-20', '2026-09-15')).toBe(5);
    });

    it('safely handles JavaScript Date objects with UTC parts', () => {
      const dateA = new Date(Date.UTC(2026, 8, 15, 23, 30, 0));
      const dateB = new Date(Date.UTC(2026, 8, 16, 1, 0, 0));

      // 1 calendar day difference in UTC
      expect(calculateDateDifferenceDays(dateA, dateB)).toBe(1);
    });

    it('returns NaN on malformed or unparseable dates', () => {
      expect(calculateDateDifferenceDays('invalid-date', '2026-09-15')).toBeNaN();
      expect(calculateDateDifferenceDays('2026-09-15', 'not-a-date')).toBeNaN();
    });
  });
});
