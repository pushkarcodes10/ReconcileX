import { RowError } from './types';

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

/**
 * Normalizes dates into the canonical ISO 'YYYY-MM-DD' format.
 *
 * Supported formats:
 * - YYYY-MM-DD
 * - YYYY/MM/DD
 * - DD-MM-YYYY
 * - DD/MM/YYYY
 * - MM/DD/YYYY (when DD > 12)
 * - ISO 8601 (e.g. 2024-03-01T14:30:00Z)
 */
export function normalizeDate(
  rawValue: unknown,
  rowNumber: number = 0,
): { transactionDate?: string; error?: RowError } {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return {
      error: {
        rowNumber,
        field: 'date',
        code: 'MISSING_REQUIRED_FIELD',
        rawValue: String(rawValue ?? ''),
        message: 'Transaction date is required',
      },
    };
  }

  const str = String(rawValue).trim();

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  // 1. ISO 8601 with optional time: 2024-03-01T14:30:00Z or 2024-03-01 14:30:00
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else {
    // 2. Day/Month/Year or Month/Day/Year: DD[-/]MM[-/]YYYY or MM[-/]DD[-/]YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const part1 = parseInt(dmyMatch[1], 10);
      const part2 = parseInt(dmyMatch[2], 10);
      const parsedYear = parseInt(dmyMatch[3], 10);

      if (part1 > 12) {
        // Must be DD-MM-YYYY
        day = part1;
        month = part2;
        year = parsedYear;
      } else if (part2 > 12) {
        // Must be MM-DD-YYYY
        month = part1;
        day = part2;
        year = parsedYear;
      } else {
        // Both <= 12: default standard international DD-MM-YYYY
        day = part1;
        month = part2;
        year = parsedYear;
      }
    }
  }

  if (year === null || month === null || day === null) {
    return {
      error: {
        rowNumber,
        field: 'date',
        code: 'INVALID_DATE',
        rawValue: str,
        message: `Unrecognized date format: "${str}". Supported formats are YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, and ISO 8601.`,
      },
    };
  }

  // Validate ranges
  if (year < 1900 || year > 2100) {
    return {
      error: {
        rowNumber,
        field: 'date',
        code: 'INVALID_DATE_YEAR',
        rawValue: str,
        message: `Date year ${year} is outside supported range (1900-2100).`,
      },
    };
  }

  if (month < 1 || month > 12) {
    return {
      error: {
        rowNumber,
        field: 'date',
        code: 'INVALID_DATE_MONTH',
        rawValue: str,
        message: `Date month ${month} is invalid. Must be between 1 and 12.`,
      },
    };
  }

  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) {
    return {
      error: {
        rowNumber,
        field: 'date',
        code: 'INVALID_DATE_DAY',
        rawValue: str,
        message: `Date day ${day} is invalid for month ${month} in year ${year}.`,
      },
    };
  }

  const normalized = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  return { transactionDate: normalized };
}
