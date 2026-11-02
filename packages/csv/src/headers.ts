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
 * - Checks that all required canonical fields ('external_id', 'amount', 'date', 'currency') exist in mapping.
 * - Strips BOM and trims whitespace from CSV headers.
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

  // 1. Clean headers: strip BOM from the first header and trim all
  const cleanedHeaders = rawHeaders.map((header, idx) => {
    let h = String(header ?? '').trim();
    if (idx === 0 && h.charCodeAt(0) === 0xfeff) {
      h = h.slice(1).trim();
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

  // 3. Verify that all required canonical fields exist in the column mapping
  for (const reqField of REQUIRED_CANONICAL_FIELDS) {
    const mappedHeader = columnMapping[reqField];
    if (!mappedHeader || String(mappedHeader).trim() === '') {
      errors.push(`Missing required canonical mapping for "${reqField}"`);
    }
  }

  // 4. Map canonical fields to column indices
  const fieldToHeaderIndex = new Map<string, number>();

  for (const [canonicalField, targetHeader] of Object.entries(columnMapping)) {
    if (!targetHeader || String(targetHeader).trim() === '') {
      continue;
    }
    const targetTrimmed = String(targetHeader).trim().toLowerCase();
    const colIdx = headerSeen.get(targetTrimmed);

    if (colIdx === undefined) {
      errors.push(
        `Configured CSV header "${targetHeader}" for field "${canonicalField}" was not found in CSV headers: [${cleanedHeaders.join(', ')}]`,
      );
    } else {
      fieldToHeaderIndex.set(canonicalField, colIdx);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    fieldToHeaderIndex,
    cleanedHeaders,
  };
}
