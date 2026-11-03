/**
 * Deterministically normalizes a reference string:
 * - Trims leading and trailing whitespace.
 * - Converts to consistent lowercase.
 * - Treats empty strings and whitespace-only strings as missing (undefined).
 * - Preserves all alphanumeric characters, hyphens, and delimiters without inventing values.
 */
export function normalizeReference(val: string | null | undefined): string | undefined {
  if (val === null || val === undefined) {
    return undefined;
  }
  const trimmed = val.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.toLowerCase();
}

/**
 * Normalizes an external transaction ID, merchant/order ID, or identifier string:
 * - Trims whitespace.
 * - Converts to consistent lowercase.
 * - Treats empty or whitespace-only strings as missing (undefined).
 */
export function normalizeIdentifier(val: string | null | undefined): string | undefined {
  if (val === null || val === undefined) {
    return undefined;
  }
  const trimmed = val.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.toLowerCase();
}

/**
 * Normalizes currency codes:
 * - Trims whitespace.
 * - Converts to uppercase 3-letter ISO representation.
 */
export function normalizeCurrency(val: string | null | undefined): string {
  if (val === null || val === undefined) {
    return '';
  }
  return val.trim().toUpperCase();
}
