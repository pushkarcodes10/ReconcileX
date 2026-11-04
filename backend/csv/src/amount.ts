import { getCurrencyMinorUnitScale } from './currency';
import { RowError } from './types';

export const PERMITTED_NEGATIVE_TXN_TYPES = new Set([
  'REFUND',
  'CHARGEBACK',
  'REVERSAL',
  'RETURN',
  'FEE',
  'DISPUTE',
  'ADJUSTMENT',
  'PAYOUT',
  'WITHDRAWAL',
  'EXPENSE',
]);

export const VALID_TXN_TYPES = new Set([
  'SALE',
  'CAPTURE',
  'AUTHORIZATION',
  'SETTLEMENT',
  'REFUND',
  'CHARGEBACK',
  'REVERSAL',
  'FEE',
  'DISPUTE',
  'PAYMENT',
  'PAYOUT',
  'TRANSFER',
  'ADJUSTMENT',
  'INVOICE',
  'ORDER',
  'DEPOSIT',
  'WITHDRAWAL',
  'CREDIT',
  'DEBIT',
]);

/**
 * Normalizes a raw monetary amount string into integer minor units without using floating-point math.
 *
 * Examples:
 * - '₹1,000.00' with INR -> 100000
 * - '100.00' with INR -> 10000
 * - '250' with INR -> 25000
 * - '(50.25)' with USD -> -5025
 * - '1500' with JPY -> 1500
 */
export function normalizeAmount(
  rawValue: unknown,
  currency: string,
  rowNumber: number = 0,
  txnType?: string | null,
): { amountMinor?: number; error?: RowError } {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return {
      error: {
        rowNumber,
        field: 'amount',
        code: 'MISSING_REQUIRED_FIELD',
        rawValue: String(rawValue ?? ''),
        message: 'Amount is required',
      },
    };
  }

  let str = String(rawValue).trim();

  // Check for accounting parentheses for negative values: (1,000.00) or (₹1,000.00)
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  // Strip currency symbols and letters: ₹, $, €, £, ¥, ₩, ₺, ₴, ฿, ₫, etc.
  str = str.replace(/[₹$€£¥₩₺₴฿₫A-Za-z]/g, '').trim();

  // Now check for negative sign: -250, - 250, 250-
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1).trim();
  } else if (str.endsWith('-')) {
    isNegative = true;
    str = str.slice(0, -1).trim();
  }

  // Remove thousand separator commas: '1,000.50' -> '1000.50'
  // But also check for malformed commas
  if (str.includes(',')) {
    // If string has both commas and dots: e.g. 1,000.50
    if (str.includes('.')) {
      // Validate that commas only appear before dots
      const lastComma = str.lastIndexOf(',');
      const firstDot = str.indexOf('.');
      if (lastComma > firstDot) {
        return {
          error: {
            rowNumber,
            field: 'amount',
            code: 'INVALID_AMOUNT',
            rawValue: String(rawValue),
            message: `Malformed amount format: "${rawValue}". Ambiguous thousands/decimal separators.`,
          },
        };
      }
      str = str.replace(/,/g, '');
    } else {
      // String only has comma(s): check if it's thousands separator (e.g. 1,000) or malformed
      const parts = str.split(',');
      if (parts.length === 2 && parts[1].length !== 3 && parts[1].length <= 2) {
        // European style decimal separator: 100,50 -> 100.50
        str = parts[0] + '.' + parts[1];
      } else {
        // Standard thousands grouping
        str = str.replace(/,/g, '');
      }
    }
  }

  // Ensure only valid digits and at most one decimal point remain
  if (!/^\d+(\.\d+)?$/.test(str)) {
    return {
      error: {
        rowNumber,
        field: 'amount',
        code: 'INVALID_AMOUNT',
        rawValue: String(rawValue),
        message: `Invalid amount format: "${rawValue}". Must be numeric.`,
      },
    };
  }

  const scale = getCurrencyMinorUnitScale(currency);
  const [integerPart, decimalPart = ''] = str.split('.');

  if (decimalPart.length > scale) {
    return {
      error: {
        rowNumber,
        field: 'amount',
        code: 'INVALID_AMOUNT_PRECISION',
        rawValue: String(rawValue),
        message: `Amount "${rawValue}" has ${decimalPart.length} decimal places, exceeding the allowed precision of ${scale} for currency ${currency}.`,
      },
    };
  }

  // Pad decimal part to required scale
  const paddedDecimal = decimalPart.padEnd(scale, '0');
  const combinedStr = integerPart + paddedDecimal;

  // Convert to BigInt to avoid floating point issues, then to Number
  try {
    const rawBig = BigInt(combinedStr);
    const signedVal = isNegative ? -rawBig : rawBig;

    if (signedVal === 0n) {
      return {
        error: {
          rowNumber,
          field: 'amount',
          code: 'INVALID_AMOUNT',
          rawValue: String(rawValue),
          message: `Monetary amount cannot be zero.`,
        },
      };
    }

    if (isNegative && txnType) {
      const normType = txnType.trim().toUpperCase();
      if (!PERMITTED_NEGATIVE_TXN_TYPES.has(normType)) {
        return {
          error: {
            rowNumber,
            field: 'amount',
            code: 'INVALID_AMOUNT',
            rawValue: String(rawValue),
            message: `Negative monetary amounts are not permitted for transaction type "${txnType}". Only refunds, chargebacks, reversals, fees, and adjustments may be negative.`,
          },
        };
      }
    }

    // Check JavaScript safe integer bounds
    if (
      signedVal > BigInt(Number.MAX_SAFE_INTEGER) ||
      signedVal < BigInt(Number.MIN_SAFE_INTEGER)
    ) {
      return {
        error: {
          rowNumber,
          field: 'amount',
          code: 'AMOUNT_OUT_OF_BOUNDS',
          rawValue: String(rawValue),
          message: `Amount "${rawValue}" exceeds maximum safe numerical bounds.`,
        },
      };
    }

    return { amountMinor: Number(signedVal) };
  } catch {
    return {
      error: {
        rowNumber,
        field: 'amount',
        code: 'INVALID_AMOUNT',
        rawValue: String(rawValue),
        message: `Failed to parse amount "${rawValue}".`,
      },
    };
  }
}
