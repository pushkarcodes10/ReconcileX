import { REQUIRED_CANONICAL_FIELDS } from './types';

export interface HeaderValidationResult {
  valid: boolean;
  errors: string[];
  fieldToHeaderIndex: Map<string, number>;
  cleanedHeaders: string[];
}

/**
 * Validates CSV headers against the data source's column mapping.
 *
 * Rules:
 * - Checks that all required canonical fields ('external_id', 'amount', 'date'/'transaction_date', 'currency') exist in mapping.
 * - Strips BOM and trims whitespace and quotes from CSV headers.
 * - Detects duplicate header names in the CSV.
 * - Verifies that every CSV header specified in the column mapping actually exists in the CSV.
 */
export function validateHeadersAndMapping(
  rawHeaders: string[],
  columnMapping: Record<string, string>,
): HeaderValidationResult {
  const errors: string[] = [];

  if (!rawHeaders || rawHeaders.length === 0) {
    return {
      valid: false,
      errors: ['CSV file contains no headers or is empty'],
      fieldToHeaderIndex: new Map(),
      cleanedHeaders: [],
    };
  }

  // 1. Clean headers: strip BOM anywhere, trim quotes and whitespace
  const cleanedHeaders = rawHeaders.map((header) => {
    let h = String(header ?? '').replace(/^\uFEFF/, '').trim();
    if ((h.startsWith('"') && h.endsWith('"')) || (h.startsWith("'") && h.endsWith("'"))) {
      h = h.slice(1, -1).trim();
    }
    return h;
  });

  // 2. Check for duplicate headers in CSV
  const headerSeen = new Map<string, number>();
  for (let i = 0; i < cleanedHeaders.length; i++) {
    const header = cleanedHeaders[i];
    if (header === '') {
      errors.push(`CSV header at column ${i + 1} is empty`);
      continue;
    }
    const lower = header.toLowerCase();
    if (headerSeen.has(lower)) {
      errors.push(
        `Duplicate header "${header}" detected at column ${i + 1} (already found at column ${headerSeen.get(lower)! + 1})`,
      );
    } else {
      headerSeen.set(lower, i);
    }
  }

  // 3. Normalize column mapping aliases
  const normalizedMapping: Record<string, string> = { ...columnMapping };

  // Handle date / transaction_date alias
  const dateMapping =
    columnMapping['date'] ||
    columnMapping['transaction_date'] ||
    columnMapping['transactionDate'];
  if (dateMapping) {
    normalizedMapping['date'] = dateMapping;
    normalizedMapping['transaction_date'] = dateMapping;
  }

  const extIdMapping = columnMapping['external_id'] || columnMapping['externalId'];
  if (extIdMapping) {
    normalizedMapping['external_id'] = extIdMapping;
  }

  const extTxnIdMapping = columnMapping['external_txn_id'] || columnMapping['externalTxnId'];
  if (extTxnIdMapping) {
    normalizedMapping['external_txn_id'] = extTxnIdMapping;
  }

  const merchantOrderIdMapping =
    columnMapping['merchant_or_order_id'] || columnMapping['merchantOrOrderId'];
  if (merchantOrderIdMapping) {
    normalizedMapping['merchant_or_order_id'] = merchantOrderIdMapping;
  }

  const txnTypeMapping = columnMapping['txn_type'] || columnMapping['txnType'];
  if (txnTypeMapping) {
    normalizedMapping['txn_type'] = txnTypeMapping;
  }

  // Verify that all required canonical fields exist in the column mapping
  for (const reqField of REQUIRED_CANONICAL_FIELDS) {
    const mappedHeader = normalizedMapping[reqField];
    if (!mappedHeader || String(mappedHeader).trim() === '') {
      errors.push(`Missing required canonical mapping for "${reqField}"`);
    }
  }

  // 4. Map canonical fields to column indices
  const fieldToHeaderIndex = new Map<string, number>();

  for (const [canonicalField, targetHeader] of Object.entries(normalizedMapping)) {
    if (!targetHeader || String(targetHeader).trim() === '') {
      continue;
    }
    const targetTrimmed = String(targetHeader).trim().toLowerCase();
    const colIdx = headerSeen.get(targetTrimmed);

    if (colIdx === undefined) {
      const isRequired =
        canonicalField === 'external_id' ||
        canonicalField === 'amount' ||
        canonicalField === 'date' ||
        canonicalField === 'transaction_date' ||
        canonicalField === 'currency';

      if (isRequired) {
        errors.push(
          `Configured CSV header "${targetHeader}" for field "${canonicalField}" was not found in CSV headers: [${cleanedHeaders.join(', ')}]`,
        );
      }
    } else {
      fieldToHeaderIndex.set(canonicalField, colIdx);
    }
  }

  // Ensure alias parity in index map
  if (fieldToHeaderIndex.has('date') && !fieldToHeaderIndex.has('transaction_date')) {
    fieldToHeaderIndex.set('transaction_date', fieldToHeaderIndex.get('date')!);
  }
  if (fieldToHeaderIndex.has('transaction_date') && !fieldToHeaderIndex.has('date')) {
    fieldToHeaderIndex.set('date', fieldToHeaderIndex.get('transaction_date')!);
  }

  return {
    valid: errors.length === 0,
    errors,
    fieldToHeaderIndex,
    cleanedHeaders,
  };
}

/**
 * Automatically suggests column mappings for ReconcileX canonical fields
 * based on detected CSV headers.
 */
export function suggestColumnMapping(rawHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  if (!rawHeaders || rawHeaders.length === 0) return mapping;

  const normalized = rawHeaders.map((h, i) => {
    let clean = String(h ?? '').replace(/^\uFEFF/, '').trim();
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      clean = clean.slice(1, -1).trim();
    }
    return {
      original: clean,
      sanitized: clean.toLowerCase().replace(/[^a-z0-9]/g, ''),
      index: i,
    };
  });

  const findHeader = (candidates: string[], exclude?: Set<string>): string | undefined => {
    for (const cand of candidates) {
      const candClean = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
      const exact = normalized.find((h) => h.sanitized === candClean && (!exclude || !exclude.has(h.original)));
      if (exact) return exact.original;
    }
    for (const cand of candidates) {
      const candClean = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Avoid loose substring matches for short tokens (e.g. 'id' matching 'paid_date' or 'dividend')
      if (candClean.length < 3) continue;
      const sub = normalized.find(
        (h) => (h.sanitized.includes(candClean) || candClean.includes(h.sanitized)) && (!exclude || !exclude.has(h.original)),
      );
      if (sub) return sub.original;
    }
    return undefined;
  };

  const used = new Set<string>();

  const extId = findHeader([
    'external_id',
    'externalid',
    'ext_id',
    'order_id',
    'orderid',
    'txn_id',
    'transaction_id',
    'txnid',
    'transactionid',
    'reference_id',
    'ref_id',
    'id',
  ]);
  if (extId) {
    mapping.external_id = extId;
    used.add(extId);
  }

  const amount = findHeader([
    'amount',
    'gross_amount',
    'transaction_amount',
    'total_amount',
    'total',
    'sum',
    'amt',
    'value',
    'price',
    'net_amount',
    'net',
  ], used);
  if (amount) {
    mapping.amount = amount;
    used.add(amount);
  }

  const cur = findHeader(['currency', 'currency_code', 'curr', 'ccy', 'cur'], used);
  if (cur) {
    mapping.currency = cur;
    used.add(cur);
  }

  const date = findHeader([
    'transaction_date',
    'transactiondate',
    'txn_date',
    'tx_date',
    'payment_date',
    'date',
    'timestamp',
    'created_at',
    'txn_dt',
    'tx_dt',
    'datetime',
    'time',
  ], used);
  if (date) {
    mapping.transaction_date = date;
    mapping.date = date;
    used.add(date);
  }

  const ref = findHeader([
    'reference',
    'reference_number',
    'reference_no',
    'ref_number',
    'ref',
    'ref_no',
  ], used);
  if (ref) {
    mapping.reference = ref;
    used.add(ref);
  }

  const extTxnId = findHeader([
    'external_txn_id',
    'external_transaction_id',
    'gateway_txn_id',
    'gateway_id',
    'payment_id',
    'stmt_id',
  ], used);
  if (extTxnId) {
    mapping.external_txn_id = extTxnId;
    used.add(extTxnId);
  }

  const merchantOrderId = findHeader([
    'merchant_or_order_id',
    'merchant_order_id',
    'order_id',
    'batch_id',
  ], used);
  if (merchantOrderId) {
    mapping.merchant_or_order_id = merchantOrderId;
    used.add(merchantOrderId);
  }

  const txnType = findHeader([
    'txn_type',
    'transaction_type',
    'payment_type',
    'type',
  ], used);
  if (txnType) {
    mapping.txn_type = txnType;
    used.add(txnType);
  }

  return mapping;
}
