import { parse } from 'csv-parse';
import { normalizeAmount, VALID_TXN_TYPES } from './amount';
import { normalizeCurrency } from './currency';
import { normalizeDate } from './date';
import { generateFingerprint } from './fingerprint';
import { validateHeadersAndMapping } from './headers';
import { CanonicalField, NormalizedRow, RowError, StreamParseRowResult } from './types';

export interface ParseCsvOptions {
  maxRows?: number;
  delimiter?: string;
}

export interface StreamSummary {
  rowCount: number;
  validCount: number;
  invalidCount: number;
  headers: string[];
}

/**
 * Parses a CSV stream incrementally, validating headers, mapping canonical fields,
 * and normalizing amounts, dates, and currencies.
 *
 * Emits StreamParseRowResult objects for each data row.
 */
export async function* parseCsvStream(
  stream: NodeJS.ReadableStream,
  columnMapping: Record<string, string>,
  options?: ParseCsvOptions,
): AsyncGenerator<StreamParseRowResult, StreamSummary> {
  const parser = stream.pipe(
    parse({
      delimiter: options?.delimiter ? options.delimiter : [',', ';', '\t', '|'],
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
      bom: true,
    }),
  );

  let isFirstRow = true;
  let headers: string[] = [];
  let fieldToHeaderIndex = new Map<string, number>();
  let rowNumber = 1; // 1-indexed (row 1 = headers)
  let validCount = 0;
  let invalidCount = 0;

  const maxRows = options?.maxRows ?? 20000;

  for await (const record of parser) {
    const rawRow = record as string[];

    if (isFirstRow) {
      isFirstRow = false;
      const validation = validateHeadersAndMapping(rawRow, columnMapping);
      headers = validation.cleanedHeaders;
      fieldToHeaderIndex = validation.fieldToHeaderIndex;

      if (!validation.valid) {
        // Yield error for row 1 (header row)
        const headerErrors: RowError[] = validation.errors.map((msg) => ({
          rowNumber: 1,
          code: 'INVALID_HEADERS',
          message: msg,
        }));
        yield {
          rowNumber: 1,
          errors: headerErrors,
        };
        return {
          rowCount: 0,
          validCount: 0,
          invalidCount: 1,
          headers,
        };
      }
      continue;
    }

    rowNumber++;
    const dataRowNumber = rowNumber; // CSV line number
    const rowErrors: RowError[] = [];

    if (rowNumber - 1 > maxRows) {
      rowErrors.push({
        rowNumber: dataRowNumber,
        code: 'ROW_LIMIT_EXCEEDED',
        message: `File exceeds the maximum allowed row limit of ${maxRows} rows.`,
      });
      invalidCount++;
      yield {
        rowNumber: dataRowNumber,
        errors: rowErrors,
      };
      break;
    }

    // Helper to get raw cell value
    const getVal = (canonicalField: CanonicalField | string): string | undefined => {
      const idx = fieldToHeaderIndex.get(canonicalField);
      if (idx === undefined || idx >= rawRow.length) {
        return undefined;
      }
      const val = rawRow[idx]?.trim();
      return val === '' ? undefined : val;
    };

    // 1. external_id (required)
    const rawExternalId = getVal('external_id') ?? getVal('externalId');
    if (!rawExternalId) {
      rowErrors.push({
        rowNumber: dataRowNumber,
        field: 'external_id',
        code: 'MISSING_REQUIRED_FIELD',
        rawValue: '',
        message: 'External ID is required',
      });
    } else if (rawExternalId.length > 255) {
      rowErrors.push({
        rowNumber: dataRowNumber,
        field: 'external_id',
        code: 'INVALID_IDENTIFIER',
        rawValue: rawExternalId,
        message: 'External ID exceeds maximum allowed length of 255 characters',
      });
    }

    // 2. currency (required)
    const rawCurrency = getVal('currency');
    const currencyResult = normalizeCurrency(rawCurrency, dataRowNumber);
    if (currencyResult.error) {
      rowErrors.push(currencyResult.error);
    }
    const currency = currencyResult.currency ?? 'INR';

    // 3. txn_type (optional, validated if present)
    const rawTxnType = getVal('txn_type') ?? getVal('txnType');
    const txnType = rawTxnType ? rawTxnType.trim() : null;
    if (txnType) {
      const upperType = txnType.toUpperCase();
      if (!VALID_TXN_TYPES.has(upperType)) {
        rowErrors.push({
          rowNumber: dataRowNumber,
          field: 'txn_type',
          code: 'INVALID_TXN_TYPE',
          rawValue: txnType,
          message: `Invalid transaction type: "${txnType}". Must be a recognized transaction type (e.g. SALE, CAPTURE, REFUND, SETTLEMENT).`,
        });
      }
    }

    // 4. amount (required)
    const rawAmount = getVal('amount');
    const amountResult = normalizeAmount(rawAmount, currency, dataRowNumber, txnType);
    if (amountResult.error) {
      rowErrors.push(amountResult.error);
    }

    // 5. date (required)
    const rawDate = getVal('transaction_date') ?? getVal('date');
    const dateResult = normalizeDate(rawDate, dataRowNumber);
    if (dateResult.error) {
      rowErrors.push(dateResult.error);
    }

    // 6. reference (required if mapped)
    const isReferenceMapped = fieldToHeaderIndex.has('reference');
    const rawReference = getVal('reference');
    if (isReferenceMapped && (rawReference === undefined || rawReference === '')) {
      rowErrors.push({
        rowNumber: dataRowNumber,
        field: 'reference',
        code: 'MISSING_REQUIRED_FIELD',
        rawValue: '',
        message: 'Reference is required',
      });
    }
    const reference = rawReference ?? null;

    // 7. Optional identifiers
    const externalTxnId = getVal('external_txn_id') ?? getVal('externalTxnId') ?? null;
    const merchantOrOrderId =
      getVal('merchant_or_order_id') ?? getVal('merchantOrOrderId') ?? null;

    if (rowErrors.length > 0) {
      invalidCount++;
      yield {
        rowNumber: dataRowNumber,
        errors: rowErrors,
      };
    } else {
      validCount++;
      const externalId = rawExternalId!;
      const amountMinor = amountResult.amountMinor!;
      const transactionDate = dateResult.transactionDate!;

      const fingerprint = generateFingerprint({
        externalId,
        amountMinor,
        currency,
        transactionDate,
        reference,
      });

      // Construct payload of all row data
      const normalizedPayload: Record<string, unknown> = {
        external_id: externalId,
        amount_minor: amountMinor,
        currency,
        transaction_date: transactionDate,
        reference,
        external_txn_id: externalTxnId,
        merchant_or_order_id: merchantOrOrderId,
        txn_type: txnType,
      };

      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (header && !(header in normalizedPayload)) {
          normalizedPayload[header] = rawRow[i] ?? null;
        }
      }

      const normalizedRow: NormalizedRow = {
        rowNumber: dataRowNumber,
        externalId,
        amountMinor,
        currency,
        transactionDate,
        reference,
        externalTxnId,
        merchantOrOrderId,
        txnType,
        fingerprint,
        normalizedPayload,
      };

      yield {
        rowNumber: dataRowNumber,
        normalizedRow,
      };
    }
  }

  const totalDataRows = rowNumber - 1; // excluding header
  return {
    rowCount: totalDataRows,
    validCount,
    invalidCount,
    headers,
  };
}
