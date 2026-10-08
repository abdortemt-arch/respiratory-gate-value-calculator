/**
 * Chart colours. Snapped from the brand hues to pass the dataviz checks on the
 * white card surface (chroma >= 0.10, >= 3:1 contrast, CVD ΔE 23):
 *   node <dataviz>/scripts/validate_palette.js "#0c6a9a,#db7419" --mode light --surface "#ffffff"
 * Text never uses these colours; labels use ink tokens.
 */
export const CHART = {
  revenue: "#0c6a9a",
  costAvoidance: "#db7419",
  /** De-emphasis gray for the cost step (≥ 3:1 on white). */
  cost: "#77838f",
  /** Net value total bar. */
  net: "#0f2340",
  grid: "#e3e7ec",
  baseline: "#cfd6de",
} as const;
