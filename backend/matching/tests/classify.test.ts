import { describe, expect, it } from 'vitest';
import { classify } from '../src/classify';

describe('Match Classification', () => {
  it('classifies 100 as EXACT', () => {
    expect(classify(100)).toBe('EXACT');
    expect(classify(105)).toBe('EXACT');
  });

  it('classifies 80 to 99 as POTENTIAL_STRONG', () => {
    expect(classify(80)).toBe('POTENTIAL_STRONG');
    expect(classify(85)).toBe('POTENTIAL_STRONG');
    expect(classify(99)).toBe('POTENTIAL_STRONG');
  });

  it('classifies 60 to 79 as POTENTIAL', () => {
    expect(classify(60)).toBe('POTENTIAL');
    expect(classify(70)).toBe('POTENTIAL');
    expect(classify(79)).toBe('POTENTIAL');
  });

  it('classifies 59 and below as NO_MATCH', () => {
    expect(classify(59)).toBe('NO_MATCH');
    expect(classify(50)).toBe('NO_MATCH');
    expect(classify(0)).toBe('NO_MATCH');
  });

  it('honors custom classification thresholds', () => {
    const customConfig = {
      thresholds: {
        exact: 95,
        potentialStrong: 75,
        potential: 50,
      },
    };

    expect(classify(95, customConfig)).toBe('EXACT');
    expect(classify(90, customConfig)).toBe('POTENTIAL_STRONG');
    expect(classify(75, customConfig)).toBe('POTENTIAL_STRONG');
    expect(classify(50, customConfig)).toBe('POTENTIAL');
    expect(classify(49, customConfig)).toBe('NO_MATCH');
  });

  it('safely handles invalid or negative scores as NO_MATCH', () => {
    expect(classify(-10)).toBe('NO_MATCH');
    expect(classify(NaN)).toBe('NO_MATCH');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(classify(undefined as any)).toBe('NO_MATCH');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(classify('100' as any)).toBe('NO_MATCH');
  });
});
