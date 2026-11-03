import { describe, it, expect } from 'vitest';
import { formatAmountMinor, toAmountMinor } from './amount';

describe('amount utilities', () => {
  it('converts major units to minor units', () => {
    expect(toAmountMinor(10.5)).toBe(1050);
    expect(toAmountMinor('25.99')).toBe(2599);
    expect(toAmountMinor(0)).toBe(0);
  });

  it('formats minor units into human readable currency string', () => {
    expect(formatAmountMinor(1050, 'USD')).toContain('10.50');
    expect(formatAmountMinor(0, 'USD')).toContain('0.00');
    expect(formatAmountMinor(null, 'USD')).toBe('0.00');
  });
});
