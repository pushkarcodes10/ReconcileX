/**
 * Safely formats match reasons or duplicate candidate reasons into a readable string.
 * Supports string arrays, objects with reasonCodes/reasons, strings, or records.
 */
export function formatReasons(reasons: unknown): string {
  if (!reasons) {
    return '';
  }

  if (Array.isArray(reasons)) {
    return reasons.filter(Boolean).map(String).join(', ');
  }

  if (typeof reasons === 'string') {
    return reasons;
  }

  if (typeof reasons === 'object') {
    const obj = reasons as Record<string, unknown>;

    if (Array.isArray(obj.reasonCodes) && obj.reasonCodes.length > 0) {
      return obj.reasonCodes.filter(Boolean).map(String).join(', ');
    }

    if (Array.isArray(obj.reasons) && obj.reasons.length > 0) {
      return obj.reasons.filter(Boolean).map(String).join(', ');
    }

    if (typeof obj.reason === 'string') {
      return obj.reason;
    }

    const simplePairs = Object.entries(obj)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .map(([k, v]) => `${k}: ${v}`);

    if (simplePairs.length > 0) {
      return simplePairs.join(', ');
    }
  }

  return String(reasons);
}

