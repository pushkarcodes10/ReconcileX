import { createHash } from 'crypto';

export interface FingerprintInput {
  externalId: string;
  amountMinor: number;
  currency: string;
  transactionDate: string;
  reference?: string | null;
}

/**
 * Generates a deterministic SHA-256 fingerprint for a canonical transaction record.
 */
export function generateFingerprint(input: FingerprintInput): string {
  const parts = [
    input.externalId.trim(),
    input.amountMinor.toString(),
    input.currency.trim().toUpperCase(),
    input.transactionDate.trim(),
    (input.reference ?? '').trim(),
  ];

  const payload = parts.join('|');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
