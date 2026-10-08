/**
 * Side-by-side metrics for any two summaries: month vs month, quarter vs
 * quarter, year vs year or hospital vs hospital.
 */
import type { DepartmentSummary, FinancialSummary, ServiceSummary } from "./period";

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
    row("revenuePerBed", "Revenue per RT-covered bed", "money", a.kpis.revenuePerBed, b.kpis.revenuePerBed),
    row("revenuePerOccupiedBed", "Revenue per occupied bed", "money", a.kpis.revenuePerOccupiedBed, b.kpis.revenuePerOccupiedBed),
    row("revenuePerRt", "Revenue per RT (FTE)", "money", a.kpis.revenuePerRt, b.kpis.revenuePerRt),
    row("costPerPatient", "Cost per patient", "money", a.kpis.costPerPatient, b.kpis.costPerPatient, false),
    row("costPerVentilatorDay", "Cost per ventilator day", "money", a.kpis.costPerVentilatorDay, b.kpis.costPerVentilatorDay, false),
    row("occupancy", "Occupancy", "percent", a.kpis.occupancy, b.kpis.occupancy),
  ];
}

/** Department vs department within one summary (or across two summaries of the same hospital). */
export function compareDepartments(a: DepartmentSummary, b: DepartmentSummary, days: number): MetricRow[] {
  const perBed = (d: DepartmentSummary) => (d.revenue === null || !d.beds ? null : d.revenue / d.beds);
  const occupancy = (d: DepartmentSummary) => (d.stats.occupiedBedDays === null || !d.beds || !days ? null : d.stats.occupiedBedDays / (d.beds * days));
  return [
    row("revenue", "Revenue", "money", a.revenue, b.revenue),
    row("volume", "Service volume (all units)", "number", a.volume, b.volume),
    row("beds", "Beds", "number", a.beds, b.beds),
    row("revenuePerBed", "Revenue per bed", "money", perBed(a), perBed(b)),
    row("patients", "Patients", "number", a.stats.patients, b.stats.patients),
    row("occupiedBedDays", "Occupied bed-days", "number", a.stats.occupiedBedDays, b.stats.occupiedBedDays),
    row("ventilatorDays", "Ventilator days", "number", a.stats.ventilatorDays, b.stats.ventilatorDays),
    row("occupancy", "Occupancy", "percent", occupancy(a), occupancy(b)),
  ];
}

/** Service vs service (two services, or the same service in two periods or hospitals). */
export function compareServices(a: ServiceSummary, b: ServiceSummary): MetricRow[] {
  return [
    row("price", "Price (average realised)", "money", a.price, b.price),
    row("volume", "Volume", "number", a.volume, b.volume),
    row("revenue", "Revenue", "money", a.revenue.value, b.revenue.value),
    row("directCost", "Direct cost", "money", a.directCost, b.directCost, false),
    row("contribution", "Contribution", "money", a.contribution, b.contribution),
  ];
}
