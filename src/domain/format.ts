/**
 * Display formatting. Calculations never round; only these functions do.
 */

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const twoDp = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** EGP 14,600,000 */
export function formatEgp(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}EGP ${integer.format(Math.abs(value))}`;
}

/** EGP 14.6M / EGP 850K / EGP 900 */
export function formatEgpCompact(value: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}EGP ${trim(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}EGP ${trim(abs / 1_000_000)}M`;
  if (abs >= 10_000) return `${sign}EGP ${trim(abs / 1_000)}K`;
  return `${sign}EGP ${integer.format(abs)}`;
}

function trim(n: number): string {
  // 14.6, 14.62 -> "14.62", 15 -> "15"; at most 2 decimals, at least 3 significant digits shown.
  const decimals = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return Number(n.toFixed(decimals)).toString();
}

/** 0.8 -> "80%", 0.625 -> "62.5%" */
export function formatPercent(fraction: number): string {
  return `${Number((fraction * 100).toFixed(2))}%`;
}

/** Plain number with grouping: 4,200 or 24.75 */
export function formatNumber(value: number): string {
  return twoDp.format(value);
}
