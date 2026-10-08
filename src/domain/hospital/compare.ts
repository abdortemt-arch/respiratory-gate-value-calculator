/**
 * Side-by-side metrics for any two summaries: month vs month, quarter vs
 * quarter, year vs year or hospital vs hospital.
 */
import type { FinancialSummary } from "./period";

export type MetricFormat = "money" | "number" | "percent";

export interface MetricRow {
  readonly key: string;
  readonly label: string;
  readonly format: MetricFormat;
  readonly a: number | null;
  readonly b: number | null;
  readonly change: number | null;
  /** Relative change (0.2 = +20%); null when A is zero or missing. */
  readonly changePct: number | null;
  /** True when higher is better (revenue) and false for costs. */
  readonly higherIsBetter: boolean;
}

function row(key: string, label: string, format: MetricFormat, a: number | null, b: number | null, higherIsBetter = true): MetricRow {
  const change = a === null || b === null ? null : b - a;
  return { key, label, format, a, b, change, changePct: change === null || !a ? null : change / Math.abs(a), higherIsBetter };
}

export function totalVolume(s: FinancialSummary): number | null {
  const v = s.services.map((x) => x.volume).filter((x): x is number => x !== null);
  return v.length ? v.reduce((t, x) => t + x, 0) : null;
}

export function compareSummaries(a: FinancialSummary, b: FinancialSummary): MetricRow[] {
  const contribution = (s: FinancialSummary) =>
    s.revenue.value === null ? null : s.services.reduce((t, x) => t + (x.contribution ?? 0), 0);
  return [
    row("revenue", "Revenue", "money", a.revenue.value, b.revenue.value),
    row("costs", "Operating cost", "money", a.costs.value, b.costs.value, false),
    row("staffing", "Staffing cost", "money", a.costsByCategory.staffing ?? null, b.costsByCategory.staffing ?? null, false),
    row("consumables", "Consumables", "money", a.costsByCategory.consumable ?? null, b.costsByCategory.consumable ?? null, false),
    row("savings", "Documented savings", "money", a.savings.value, b.savings.value),
    row("net", "Net value", "money", a.net.value, b.net.value),
    row("contribution", "Service net contribution", "money", contribution(a), contribution(b)),
    row("volume", "Service volume (all units)", "number", totalVolume(a), totalVolume(b)),
    row("revenuePerBed", "Revenue per bed", "money", a.kpis.revenuePerBed, b.kpis.revenuePerBed),
    row("revenuePerOccupiedBed", "Revenue per occupied bed", "money", a.kpis.revenuePerOccupiedBed, b.kpis.revenuePerOccupiedBed),
    row("revenuePerRt", "Revenue per RT (FTE)", "money", a.kpis.revenuePerRt, b.kpis.revenuePerRt),
    row("costPerPatient", "Cost per patient", "money", a.kpis.costPerPatient, b.kpis.costPerPatient, false),
    row("costPerVentilatorDay", "Cost per ventilator day", "money", a.kpis.costPerVentilatorDay, b.kpis.costPerVentilatorDay, false),
    row("occupancy", "Occupancy", "percent", a.kpis.occupancy, b.kpis.occupancy),
  ];
}
