/**
 * Portfolio view across hospitals for one month: totals, year-to-date,
 * highest-value and fastest-growing hospital, and the biggest cost and revenue
 * movements against the previous month. Hospitals without data for the month
 * are listed as such; they never count as zero.
 */
import { aggregate } from "./aggregate";
import { addMonths, monthLabel, ytdMonths, type Month } from "./month";
import { calculatePeriod, figure, type FinancialSummary, type Figure, type Issue } from "./period";
import type { HospitalConfig, PeriodInput } from "./types";

export interface HospitalData {
  readonly config: HospitalConfig;
  readonly active: boolean;
  readonly periods: readonly PeriodInput[];
}

/** Every month of a hospital, calculated with that month's prices and costs. */
export function monthlySummaries(config: HospitalConfig, periods: readonly PeriodInput[]): FinancialSummary[] {
  return [...periods].sort((a, b) => (a.month < b.month ? -1 : 1)).map((p) => calculatePeriod(config, p));
}

export interface PortfolioHospital {
  readonly hospitalId: string;
  readonly name: string;
  readonly code: string;
  readonly active: boolean;
  readonly month: FinancialSummary | null;
  readonly previous: FinancialSummary | null;
  readonly ytd: FinancialSummary | null;
  readonly revenueChange: number | null;
  /** Relative revenue change vs the previous month (0.1 = +10%). */
  readonly revenueGrowth: number | null;
  readonly netChange: number | null;
}

export interface CostMovement {
  readonly hospitalId: string;
  readonly hospitalName: string;
  readonly item: string;
  readonly from: number | null;
  readonly to: number | null;
  /** Cost increase in EGP (positive = higher cost). */
  readonly increase: number;
}

export interface Portfolio {
  readonly month: Month;
  readonly previousMonth: Month;
  readonly hospitals: readonly PortfolioHospital[];
  readonly hospitalsWithData: number;
  readonly totals: { readonly revenue: Figure; readonly costs: Figure; readonly savings: Figure; readonly net: Figure };
  readonly ytd: { readonly revenue: Figure; readonly costs: Figure; readonly savings: Figure; readonly net: Figure };
  readonly highestValue: PortfolioHospital | null;
  readonly highestGrowth: PortfolioHospital | null;
  readonly costIncreases: readonly CostMovement[];
  readonly revenueChanges: readonly PortfolioHospital[];
}

/** Latest month with an operating period in any hospital, or null. */
export function latestMonth(hospitals: readonly HospitalData[]): Month | null {
  let latest: Month | null = null;
  for (const h of hospitals) for (const p of h.periods) if (latest === null || p.month > latest) latest = p.month;
  return latest;
}

/** Sum figures across hospitals: missing figures make the total partial; all missing → missing. */
function sumFigures(figures: readonly (Figure | null)[], expected: number): Figure {
  const present = figures.filter((f): f is Figure => f !== null && f.value !== null);
  if (present.length === 0) return figure(null, [], "missing");
  const value = present.reduce((s, f) => s + (f.value as number), 0);
  const gaps = expected - present.length;
  const issues: Issue[] = present.flatMap((f) => f.issues);
  if (gaps > 0) issues.push({ code: "no_activity", message: `${gaps} hospital${gaps === 1 ? "" : "s"} without data`, entityId: null });
  return figure(value, issues);
}

export function buildPortfolio(hospitals: readonly HospitalData[], month: Month): Portfolio {
  const previousMonth = addMonths(month, -1);
  const ytd = ytdMonths(month);

  const rows: PortfolioHospital[] = hospitals.map((h) => {
    const monthly = monthlySummaries(h.config, h.periods);
    const current = monthly.find((m) => m.months[0] === month) ?? null;
    const previous = monthly.find((m) => m.months[0] === previousMonth) ?? null;
    const inYtd = monthly.filter((m) => ytd.includes(m.months[0]));
    const ytdSummary = inYtd.length ? aggregate(h.config, `YTD ${monthLabel(month, "short")}`, ytd.filter((m) => inYtd.some((x) => x.months[0] === m)), inYtd) : null;
    const r1 = previous?.revenue.value ?? null;
    const r2 = current?.revenue.value ?? null;
    const n1 = previous?.net.value ?? null;
    const n2 = current?.net.value ?? null;
    return {
      hospitalId: h.config.id,
      name: h.config.name,
      code: h.config.code,
      active: h.active,
      month: current,
      previous,
      ytd: ytdSummary,
      revenueChange: r1 === null || r2 === null ? null : r2 - r1,
      revenueGrowth: r1 === null || r2 === null || r1 === 0 ? null : (r2 - r1) / Math.abs(r1),
      netChange: n1 === null || n2 === null ? null : n2 - n1,
    };
  });

  const withData = rows.filter((r) => r.month !== null);
  const expected = rows.filter((r) => r.active || r.month !== null).length;
  const totals = {
    revenue: sumFigures(rows.map((r) => r.month?.revenue ?? null), expected),
    costs: sumFigures(rows.map((r) => r.month?.costs ?? null), expected),
    savings: sumFigures(rows.map((r) => (r.month && r.month.savings.status !== "missing" ? r.month.savings : null)), withData.length),
    net: sumFigures(rows.map((r) => r.month?.net ?? null), expected),
  };
  const ytdTotals = {
    revenue: sumFigures(rows.map((r) => r.ytd?.revenue ?? null), expected),
    costs: sumFigures(rows.map((r) => r.ytd?.costs ?? null), expected),
    savings: sumFigures(rows.map((r) => (r.ytd && r.ytd.savings.status !== "missing" ? r.ytd.savings : null)), rows.filter((r) => r.ytd).length),
    net: sumFigures(rows.map((r) => r.ytd?.net ?? null), expected),
  };

  // Highest value: highest net value; when no hospital has costs yet, highest revenue.
  const byNet = withData.filter((r) => r.month!.net.value !== null).sort((a, b) => b.month!.net.value! - a.month!.net.value!);
  const byRevenue = withData.filter((r) => r.month!.revenue.value !== null).sort((a, b) => b.month!.revenue.value! - a.month!.revenue.value!);
  const highestValue = byNet[0] ?? byRevenue[0] ?? null;
  const growth = rows.filter((r) => r.revenueGrowth !== null).sort((a, b) => b.revenueGrowth! - a.revenueGrowth!);

  const costIncreases: CostMovement[] = [];
  for (const r of rows) {
    if (!r.month || !r.previous) continue;
    for (const line of r.month.costLines) {
      const to = line.amount.value;
      const from = r.previous.costLines.find((c) => c.costItemId === line.costItemId)?.amount.value ?? null;
      if (to !== null && to > (from ?? 0)) {
        costIncreases.push({ hospitalId: r.hospitalId, hospitalName: r.name, item: line.name, from, to, increase: to - (from ?? 0) });
      }
    }
  }
  costIncreases.sort((a, b) => b.increase - a.increase);

  return {
    month,
    previousMonth,
    hospitals: rows,
    hospitalsWithData: withData.length,
    totals,
    ytd: ytdTotals,
    highestValue,
    highestGrowth: growth[0] ?? null,
    costIncreases: costIncreases.slice(0, 6),
    revenueChanges: rows.filter((r) => r.revenueChange !== null && r.revenueChange !== 0).sort((a, b) => Math.abs(b.revenueChange!) - Math.abs(a.revenueChange!)),
  };
}
