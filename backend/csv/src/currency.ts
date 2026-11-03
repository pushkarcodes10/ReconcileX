import { RowError } from './types';

// Currencies with 0 decimal places
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

// Currencies with 3 decimal places
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

/**
 * Returns the minor unit decimal scale for a given ISO currency code.
 * Defaults to 2 (e.g. USD, EUR, INR, GBP).
 */
export function getCurrencyMinorUnitScale(currencyCode: string): number {
  const code = currencyCode.toUpperCase().trim();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return 0;
  }
  if (THREE_DECIMAL_CURRENCIES.has(code)) {
    return 3;
  }
  return 2;
}

/**
 * Validates and normalizes an ISO 4217 3-letter currency code.
 */
export function normalizeCurrency(
  rawValue: unknown,
  rowNumber: number = 0,
): { currency?: string; error?: RowError } {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return {
      error: {
        rowNumber,
        field: 'currency',
        code: 'MISSING_REQUIRED_FIELD',
        rawValue: String(rawValue ?? ''),
        message: 'Currency is required',
      },
    };
  }

  const str = String(rawValue).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(str)) {
    return {
      error: {
        rowNumber,
        field: 'currency',
        code: 'INVALID_CURRENCY',
        rawValue: String(rawValue),
        message: `Invalid ISO currency code: "${rawValue}". Must be 3 alphabetic characters.`,
      },
    };
  }

  return { currency: str };
}
