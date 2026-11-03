import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import {
  generateFingerprint,
  getCurrencyMinorUnitScale,
  normalizeAmount,
  normalizeCurrency,
  normalizeDate,
  parseCsvStream,
  validateHeadersAndMapping,
} from '../src';

describe('backend/csv unit tests', () => {
  describe('Currency & Scale', () => {
    it('should return correct decimal scale for various currencies', () => {
      expect(getCurrencyMinorUnitScale('INR')).toBe(2);
      expect(getCurrencyMinorUnitScale('USD')).toBe(2);
      expect(getCurrencyMinorUnitScale('EUR')).toBe(2);
      expect(getCurrencyMinorUnitScale('JPY')).toBe(0);
      expect(getCurrencyMinorUnitScale('KRW')).toBe(0);
      expect(getCurrencyMinorUnitScale('BHD')).toBe(3);
      expect(getCurrencyMinorUnitScale('KWD')).toBe(3);
    });

    it('should normalize valid 3-letter currency codes', () => {
      expect(normalizeCurrency('inr').currency).toBe('INR');
      expect(normalizeCurrency(' USD ').currency).toBe('USD');
      expect(normalizeCurrency('eur').currency).toBe('EUR');
    });

    it('should reject invalid currency codes', () => {
      expect(normalizeCurrency('US').error?.code).toBe('INVALID_CURRENCY');
      expect(normalizeCurrency('USDT').error?.code).toBe('INVALID_CURRENCY');
      expect(normalizeCurrency('123').error?.code).toBe('INVALID_CURRENCY');
      expect(normalizeCurrency('').error?.code).toBe('MISSING_REQUIRED_FIELD');
    });
  });

  describe('Amount Normalization (No Floating Point)', () => {
    it('should normalize amounts for INR into paise (2 decimals)', () => {
      expect(normalizeAmount('₹1,000.00', 'INR').amountMinor).toBe(100000);
      expect(normalizeAmount('100.00', 'INR').amountMinor).toBe(10000);
      expect(normalizeAmount('250', 'INR').amountMinor).toBe(25000);
      expect(normalizeAmount('0.50', 'INR').amountMinor).toBe(50);
      expect(normalizeAmount('0.05', 'INR').amountMinor).toBe(5);
    });

    it('should normalize negative amounts correctly without converting to positive', () => {
      expect(normalizeAmount('-100.00', 'INR').amountMinor).toBe(-10000);
      expect(normalizeAmount('(1,000.50)', 'INR').amountMinor).toBe(-100050);
      expect(normalizeAmount('₹ -250', 'INR').amountMinor).toBe(-25000);
    });

    it('should handle zero-decimal currencies like JPY', () => {
      expect(normalizeAmount('1000', 'JPY').amountMinor).toBe(1000);
      expect(normalizeAmount('¥500', 'JPY').amountMinor).toBe(500);
    });

    it('should handle three-decimal currencies like BHD', () => {
      expect(normalizeAmount('10.500', 'BHD').amountMinor).toBe(10500);
      expect(normalizeAmount('10.5', 'BHD').amountMinor).toBe(10500);
    });

    it('should reject amounts with precision exceeding currency scale', () => {
      const res = normalizeAmount('10.123', 'INR');
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe('INVALID_AMOUNT_PRECISION');
    });

    it('should reject non-numeric or malformed amounts', () => {
      expect(normalizeAmount('abc', 'INR').error?.code).toBe('INVALID_AMOUNT');
      expect(normalizeAmount('10.20.30', 'INR').error?.code).toBe('INVALID_AMOUNT');
      expect(normalizeAmount('', 'INR').error?.code).toBe('MISSING_REQUIRED_FIELD');
    });
  });

  describe('Date Normalization', () => {
    it('should normalize ISO 8601 dates', () => {
      expect(normalizeDate('2024-03-01').transactionDate).toBe('2024-03-01');
      expect(normalizeDate('2024-03-01T14:30:00Z').transactionDate).toBe('2024-03-01');
      expect(normalizeDate('2024/03/01').transactionDate).toBe('2024-03-01');
    });

    it('should normalize DD-MM-YYYY and DD/MM/YYYY dates', () => {
      expect(normalizeDate('15-08-2024').transactionDate).toBe('2024-08-15');
      expect(normalizeDate('15/08/2024').transactionDate).toBe('2024-08-15');
      expect(normalizeDate('05-12-2024').transactionDate).toBe('2024-12-05');
    });

    it('should handle leap years accurately', () => {
      expect(normalizeDate('29-02-2024').transactionDate).toBe('2024-02-29');
      // 2023 is not a leap year
      expect(normalizeDate('29-02-2023').error?.code).toBe('INVALID_DATE_DAY');
    });

    it('should reject invalid calendar dates', () => {
      expect(normalizeDate('31-04-2024').error?.code).toBe('INVALID_DATE_DAY'); // April has 30 days
      expect(normalizeDate('32-01-2024').error?.code).toBe('INVALID_DATE_DAY');
      expect(normalizeDate('15-13-2024').error?.code).toBe('INVALID_DATE_MONTH');
      expect(normalizeDate('invalid-date').error?.code).toBe('INVALID_DATE');
    });
  });

  describe('Fingerprint Generation', () => {
    it('should generate deterministic 64-char hex SHA-256 fingerprint', () => {
      const fp1 = generateFingerprint({
        externalId: 'ORD-1001',
        amountMinor: 100000,
        currency: 'INR',
        transactionDate: '2024-03-01',
        reference: 'REF-XYZ',
      });

      const fp2 = generateFingerprint({
        externalId: 'ORD-1001',
        amountMinor: 100000,
        currency: 'INR',
        transactionDate: '2024-03-01',
        reference: 'REF-XYZ',
      });

      expect(fp1).toHaveLength(64);
      expect(fp1).toBe(fp2);

      const fp3 = generateFingerprint({
        externalId: 'ORD-1002',
        amountMinor: 100000,
        currency: 'INR',
        transactionDate: '2024-03-01',
        reference: 'REF-XYZ',
      });
      expect(fp1).not.toBe(fp3);
    });
  });

  describe('Headers and Column Mapping Validation', () => {
    const validMapping = {
      external_id: 'Order ID',
      amount: 'Transaction Amount',
      date: 'Payment Date',
      currency: 'Currency',
      reference: 'Reference Number',
    };

    it('should validate matching headers with BOM and whitespace', () => {
      const rawHeaders = [
        '\uFEFFOrder ID ',
        ' Transaction Amount',
        'Payment Date',
        'Currency',
        'Reference Number',
      ];
      const res = validateHeadersAndMapping(rawHeaders, validMapping);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.fieldToHeaderIndex.get('external_id')).toBe(0);
      expect(res.fieldToHeaderIndex.get('amount')).toBe(1);
    });

    it('should reject missing required canonical field in mapping', () => {
      const incompleteMapping = {
        external_id: 'Order ID',
        amount: 'Transaction Amount',
        // date missing
        currency: 'Currency',
      };
      const rawHeaders = ['Order ID', 'Transaction Amount', 'Payment Date', 'Currency'];
      const res = validateHeadersAndMapping(rawHeaders, incompleteMapping);
      expect(res.valid).toBe(false);
      expect(
        res.errors.some((e) => e.includes('Missing required canonical mapping for "date"')),
      ).toBe(true);
    });

    it('should reject mapped headers not present in CSV', () => {
      const rawHeaders = ['Order ID', 'Transaction Amount', 'Currency'];
      const res = validateHeadersAndMapping(rawHeaders, validMapping);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Payment Date'))).toBe(true);
    });

    it('should detect duplicate headers in CSV', () => {
      const rawHeaders = ['Order ID', 'Transaction Amount', 'Payment Date', 'Currency', 'Order ID'];
      const res = validateHeadersAndMapping(rawHeaders, validMapping);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Duplicate header'))).toBe(true);
    });
  });

  describe('Streaming CSV Parser', () => {
    const mapping = {
      external_id: 'Order ID',
      amount: 'Amount',
      date: 'Date',
      currency: 'Currency',
      reference: 'Ref',
    };

    it('should parse valid CSV stream with normalized records', async () => {
      const csvContent = [
        'Order ID,Amount,Date,Currency,Ref',
        'ORD-1,"₹1,000.00",2024-03-01,INR,REF-1',
        'ORD-2,250.50,15-03-2024,USD,REF-2',
      ].join('\n');

      const stream = Readable.from(Buffer.from(csvContent));
      const generator = parseCsvStream(stream, mapping);

      const rows = [];
      for await (const item of generator) {
        rows.push(item);
      }

      expect(rows).toHaveLength(2);
      expect(rows[0].normalizedRow).toBeDefined();
      expect(rows[0].normalizedRow?.externalId).toBe('ORD-1');
      expect(rows[0].normalizedRow?.amountMinor).toBe(100000);
      expect(rows[0].normalizedRow?.currency).toBe('INR');
      expect(rows[0].normalizedRow?.transactionDate).toBe('2024-03-01');
      expect(rows[0].normalizedRow?.reference).toBe('REF-1');

      expect(rows[1].normalizedRow?.externalId).toBe('ORD-2');
      expect(rows[1].normalizedRow?.amountMinor).toBe(25050);
      expect(rows[1].normalizedRow?.currency).toBe('USD');
      expect(rows[1].normalizedRow?.transactionDate).toBe('2024-03-15');
    });

    it('should collect row errors for invalid rows and continue streaming', async () => {
      const csvContent = [
        'Order ID,Amount,Date,Currency,Ref',
        'ORD-VALID,100.00,2024-03-01,INR,REF-OK',
        'ORD-BAD-AMT,INVALID_AMT,2024-03-01,INR,REF-ERR',
        'ORD-BAD-DATE,100.00,32-01-2024,INR,REF-ERR2',
        ',100.00,2024-03-01,INR,REF-NO-ID',
      ].join('\n');

      const stream = Readable.from(Buffer.from(csvContent));
      const generator = parseCsvStream(stream, mapping);

      const results = [];
      for await (const item of generator) {
        results.push(item);
      }

      expect(results).toHaveLength(4);
      expect(results[0].normalizedRow).toBeDefined(); // row 2 valid
      expect(results[1].errors).toBeDefined(); // row 3 bad amount
      expect(results[1].errors![0].code).toBe('INVALID_AMOUNT');
      expect(results[2].errors).toBeDefined(); // row 4 bad date
      expect(results[2].errors![0].code).toBe('INVALID_DATE_DAY');
      expect(results[3].errors).toBeDefined(); // row 5 missing id
      expect(results[3].errors![0].code).toBe('MISSING_REQUIRED_FIELD');
    });

    it('should reject file if headers are invalid', async () => {
      const csvContent = ['Wrong Header 1,Wrong Header 2', 'val1,val2'].join('\n');

      const stream = Readable.from(Buffer.from(csvContent));
      const generator = parseCsvStream(stream, mapping);

      const results = [];
      for await (const item of generator) {
        results.push(item);
      }

      expect(results).toHaveLength(1);
      expect(results[0].rowNumber).toBe(1);
      expect(results[0].errors).toBeDefined();
      expect(results[0].errors![0].code).toBe('INVALID_HEADERS');
    });
  });
});
