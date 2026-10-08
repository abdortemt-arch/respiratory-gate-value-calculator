/**
 * What to compare: a month, a quarter, a year, year-to-date or a selection of
 * months — written compactly for URLs:
 *   "2026-02"  "2026-Q1"  "2026"  "ytd:2026-03"  "2026-01+2026-03"
 */
import { aggregate } from "./aggregate";
import { addMonths, isMonth, monthLabel, quarterMonths, quarterOf, yearMonths, ytdMonths, type Month } from "./month";
import type { FinancialSummary } from "./period";
import type { HospitalConfig } from "./types";

export type PeriodSpec =
  | { readonly kind: "month"; readonly month: Month }
  | { readonly kind: "quarter"; readonly year: number; readonly quarter: 1 | 2 | 3 | 4 }
  | { readonly kind: "year"; readonly year: number }
  | { readonly kind: "ytd"; readonly month: Month }
  | { readonly kind: "months"; readonly months: readonly Month[] };

export function parseSpec(value: unknown): PeriodSpec | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  const raw: string = v; // `v` narrows to never after the isMonth check below
  if (isMonth(v)) return { kind: "month", month: v };
  const q = /^(\d{4})-Q([1-4])$/.exec(v);
  if (q) return { kind: "quarter", year: Number(q[1]), quarter: Number(q[2]) as 1 | 2 | 3 | 4 };
  if (/^\d{4}$/.test(v)) return { kind: "year", year: Number(v) };
  const ytd = /^ytd:(\d{4}-\d{2})$/.exec(v);
  if (ytd && isMonth(ytd[1])) return { kind: "ytd", month: ytd[1] };
  const list = raw.split("+").filter(Boolean);
  if (list.length > 1 && list.every(isMonth)) return { kind: "months", months: [...new Set(list)].sort() };
  return null;
}

export function specToString(spec: PeriodSpec): string {
  switch (spec.kind) {
    case "month":
      return spec.month;
    case "quarter":
      return `${spec.year}-Q${spec.quarter}`;
    case "year":
      return String(spec.year);
    case "ytd":
      return `ytd:${spec.month}`;
    case "months":
      return spec.months.join("+");
  }
}

export function specMonths(spec: PeriodSpec): Month[] {
  switch (spec.kind) {
    case "month":
      return [spec.month];
    case "quarter":
      return quarterMonths(spec.year, spec.quarter);
    case "year":
      return yearMonths(spec.year);
    case "ytd":
      return ytdMonths(spec.month);
    case "months":
      return [...spec.months];
  }
}

export function specLabel(spec: PeriodSpec): string {
  switch (spec.kind) {
    case "month":
      return monthLabel(spec.month);
    case "quarter":
      return `Q${spec.quarter} ${spec.year}`;
    case "year":
      return String(spec.year);
    case "ytd":
      return `YTD ${monthLabel(spec.month, "short")}`;
    case "months":
      return spec.months.map((m) => monthLabel(m, "short")).join(", ");
  }
}

/** The same span one year earlier (for YTD and year-over-year comparisons). */
export function priorYear(spec: PeriodSpec): PeriodSpec {
  switch (spec.kind) {
    case "month":
      return { kind: "month", month: addMonths(spec.month, -12) };
    case "quarter":
      return { ...spec, year: spec.year - 1 };
    case "year":
      return { kind: "year", year: spec.year - 1 };
    case "ytd":
      return { kind: "ytd", month: addMonths(spec.month, -12) };
    case "months":
      return { kind: "months", months: spec.months.map((m) => addMonths(m, -12)) };
  }
}

/** The previous span of the same kind (month before, quarter before, year before). */
export function previousSpec(spec: PeriodSpec): PeriodSpec {
  switch (spec.kind) {
    case "month":
      return { kind: "month", month: addMonths(spec.month, -1) };
    case "quarter":
      return spec.quarter === 1 ? { kind: "quarter", year: spec.year - 1, quarter: 4 } : { ...spec, quarter: (spec.quarter - 1) as 1 | 2 | 3 };
    default:
      return priorYear(spec);
  }
}

/** Quarters ("2026-Q1") and years that contain any of the given months, newest first. */
export function quartersOf(months: readonly Month[]): string[] {
  return [...new Set(months.map((m) => `${quarterOf(m).year}-Q${quarterOf(m).quarter}`))].sort().reverse();
}
export function yearsOf(months: readonly Month[]): string[] {
  return [...new Set(months.map((m) => m.slice(0, 4)))].sort().reverse();
}

/**
 * Financial summary of a hospital for a span, from its calculated months.
 * A single month is returned as calculated; spans are aggregated, and months
 * without an operating period are reported as missing data.
 */
export function summarizeSpec(config: HospitalConfig, monthly: readonly FinancialSummary[], spec: PeriodSpec): FinancialSummary {
  const months = specMonths(spec);
  if (spec.kind === "month") {
    const found = monthly.find((m) => m.months[0] === spec.month);
    if (found) return found;
  }
  return aggregate(config, specLabel(spec), months, monthly.filter((m) => months.includes(m.months[0])));
}
