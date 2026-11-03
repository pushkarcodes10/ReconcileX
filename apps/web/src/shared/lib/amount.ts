// Utilities for minor units currency manipulation

export function formatAmountMinor(amountMinor: number | null | undefined, currency = 'USD'): string {
  if (amountMinor === null || amountMinor === undefined || isNaN(amountMinor)) {
    return '0.00';
  }

  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

export function toAmountMinor(major: number | string): number {
  if (typeof major === 'string') {
    const parsed = parseFloat(major);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  }
  return Math.round(major * 100);
}
