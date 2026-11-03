/**
 * Parses a Date object or date-only string (e.g. "YYYY-MM-DD" or ISO-8601)
 * into a UTC timestamp at midnight (00:00:00 UTC) to prevent timezone shifts.
 * Returns NaN if the input date is malformed or invalid.
 */
function toUtcMidnightTimestamp(val: Date | string): number {
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return NaN;
    return Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate());
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const testDate = new Date(Date.UTC(year, month, day));
      if (
        testDate.getUTCFullYear() === year &&
        testDate.getUTCMonth() === month &&
        testDate.getUTCDate() === day
      ) {
        return testDate.getTime();
      }
    }

    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return NaN;
    return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  }

  return NaN;
}

/**
 * Computes calendar day difference between two dates without timezone-dependent shifts.
 * Returns NaN if either date is invalid.
 */
export function calculateDateDifferenceDays(dateA: Date | string, dateB: Date | string): number {
  const tsA = toUtcMidnightTimestamp(dateA);
  const tsB = toUtcMidnightTimestamp(dateB);

  if (isNaN(tsA) || isNaN(tsB)) {
    return NaN;
  }

  const msDiff = Math.abs(tsA - tsB);
  return Math.round(msDiff / (1000 * 60 * 60 * 24));
}
