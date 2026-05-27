// Single source of truth for tabular display. Every percent / number
// in the UI flows through here so n/a fallbacks and decimal places
// stay consistent across cards, tables, and charts.
//
// All functions accept `null | undefined` and return the same `'n/a'`
// string. Callers should *not* re-implement this; doing so silently
// diverges from how empty values look elsewhere.

const N_A = 'n/a';

export function formatPercent(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return N_A;
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return N_A;
  return new Intl.NumberFormat('en-US', options).format(value);
}

// Sign-aware delta pill text: '+12.40%' for positive, '-3.20%' for
// negative, with the same n/a fallback. Sign is explicit so the eye
// can register direction without scanning color.
export function formatDelta(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return N_A;
  const pct = (value * 100).toFixed(fractionDigits);
  return value >= 0 ? `+${pct}%` : `${pct}%`;
}
