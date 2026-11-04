import { describe, it, expect } from 'vitest';
import { formatReasons } from './format-reasons';

describe('formatReasons', () => {
  it('returns empty string for null or undefined', () => {
    expect(formatReasons(null)).toBe('');
    expect(formatReasons(undefined)).toBe('');
    expect(formatReasons('')).toBe('');
  });

  it('formats array of strings', () => {
    expect(formatReasons(['REFERENCE', 'AMOUNT'])).toBe('REFERENCE, AMOUNT');
    expect(formatReasons(['ONLY_ONE'])).toBe('ONLY_ONE');
  });

  it('formats backend object with reasonCodes array', () => {
    expect(
      formatReasons({
        reasonCodes: ['REFERENCE', 'AMOUNT'],
        contributions: { amount: 50 },
        dateDifferenceDays: 0,
      })
    ).toBe('REFERENCE, AMOUNT');
  });

  it('formats object with reasons array', () => {
    expect(
      formatReasons({
        reasons: ['AMOUNT', 'DATE'],
      })
    ).toBe('AMOUNT, DATE');
  });

  it('formats object with single reason string', () => {
    expect(
      formatReasons({
        reason: 'FINGERPRINT_MATCH',
      })
    ).toBe('FINGERPRINT_MATCH');
  });

  it('handles plain string', () => {
    expect(formatReasons('Exact match on external reference')).toBe(
      'Exact match on external reference'
    );
  });
});

