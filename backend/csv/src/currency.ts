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

// Standard ISO 4217 3-letter currency codes
const ISO_4217_CODES = new Set([
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD',
  'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP',
  'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR',
  'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS',
  'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR',
  'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP',
  'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO',
  'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN',
  'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG',
  'SEK', 'SGD', 'SHP', 'SLL', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP',
  'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS',
  'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF',
  'XCD', 'XDR', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL',
]);

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
  if (!/^[A-Z]{3}$/.test(str) || !ISO_4217_CODES.has(str)) {
    return {
      error: {
        rowNumber,
        field: 'currency',
        code: 'INVALID_CURRENCY',
        rawValue: String(rawValue),
        message: `Invalid ISO currency code: "${rawValue}". Must be a valid 3-letter ISO 4217 currency code.`,
      },
    };
  }

  return { currency: str };
}
