/**
 * Monthly financials for one hospital period:
 *   revenue  = Σ service volume × the price version effective that month
 *   costs    = Σ cost items using the cost version effective that month
 *   savings  = documented cost avoidance for the month
 *   net      = revenue − costs + savings (only once operating cost exists)
 *
 * Unknown is never zero: missing volumes, prices or quantities make a figure
 * "partial" or "missing" and are listed as issues.
 */
import { daysInMonth, monthLabel, type Month } from "./month";
import type { BillingUnit, CostBasis, CostCategory, PeriodStatus, SavingsCategory, ServiceCategory } from "./lists";
import type { CostItemConfig, HospitalConfig, PeriodInput, StatsEntry } from "./types";
import { versionFor, versionsOf } from "./versions";

export type FigureStatus = "complete" | "partial" | "missing";

export interface Issue {
  readonly code:
    | "missing_volume"
    | "missing_price"
    | "missing_cost_quantity"
    | "missing_linked_volume"
    | "no_cost_data"
    | "no_activity";
  readonly message: string;
  readonly entityId: string | null;
}

export interface Figure {
  readonly value: number | null;
  readonly status: FigureStatus;
  readonly issues: readonly Issue[];
}

export interface DepartmentSlice {
  readonly departmentId: string | null;
  readonly volume: number | null;
  readonly revenue: number | null;
}

export interface ServiceSummary {
  readonly hospitalServiceId: string;
  readonly serviceId: string;
  readonly name: string;
  readonly category: ServiceCategory;
  readonly billingUnit: BillingUnit | null;
  /** Effective price for a month; volume-weighted average for multi-month summaries. */
  readonly price: number | null;
  readonly priceEffectiveFrom: Month | null;
  readonly volume: number | null;
  readonly revenue: Figure;
  /** Costs linked directly to this service (per-service-unit and linked items). */
  readonly directCost: number;
  readonly contribution: number | null;
  readonly byDepartment: readonly DepartmentSlice[];
}

export interface CostLine {
  readonly costItemId: string;
  readonly name: string;
  readonly category: CostCategory;
  readonly basis: CostBasis;
  readonly unitLabel: string;
  readonly hospitalServiceId: string | null;
  readonly departmentId: string | null;
  readonly isRtStaff: boolean;
  readonly unitCost: number | null;
  readonly quantity: number | null;
  readonly amount: Figure;
}

export interface Stats {
  readonly patients: number | null;
  readonly admissions: number | null;
  readonly occupiedBedDays: number | null;
  readonly ventilatorDays: number | null;
}

export interface Kpis {
  readonly beds: number | null;
  readonly days: number;
  readonly occupancy: number | null;
  readonly rtFte: number | null;
  readonly revenuePerBed: number | null;
  readonly revenuePerOccupiedBed: number | null;
  readonly revenuePerRt: number | null;
  readonly costPerPatient: number | null;
  readonly costPerVentilatorDay: number | null;
}

export interface DepartmentSummary {
  readonly departmentId: string;
  readonly name: string;
  readonly beds: number | null;
  readonly volume: number | null;
  readonly revenue: number | null;
  readonly stats: Stats;
}

/** Shared shape for one month or several (quarter, year, YTD). */
export interface FinancialSummary {
  readonly hospitalId: string;
  readonly hospitalName: string;
  readonly label: string;
  readonly months: readonly Month[];
  /** Months in `months` that have an operating period. */
  readonly monthsWithData: readonly Month[];
  readonly status: PeriodStatus | null;
  readonly revenue: Figure;
  readonly costs: Figure;
  readonly savings: Figure;
  readonly net: Figure;
  readonly services: readonly ServiceSummary[];
  readonly costLines: readonly CostLine[];
  readonly costsByCategory: Readonly<Partial<Record<CostCategory, number>>>;
  readonly savingsByCategory: Readonly<Partial<Record<SavingsCategory, number>>>;
  readonly departments: readonly DepartmentSummary[];
  readonly stats: Stats;
  readonly kpis: Kpis;
  readonly issues: readonly Issue[];
}

// ── helpers ────────────────────────────────────────────────────────────────

export function figure(value: number | null, issues: readonly Issue[] = [], forceStatus?: FigureStatus): Figure {
  const status: FigureStatus = forceStatus ?? (value === null ? "missing" : issues.length > 0 ? "partial" : "complete");
  return { value, status, issues };
}

const sumOrNull = (values: readonly (number | null)[]): number | null =>
  values.some((v) => v !== null) ? values.reduce<number>((s, v) => s + (v ?? 0), 0) : null;

const div = (a: number | null, b: number | null): number | null => (a === null || b === null || b === 0 ? null : a / b);

/** Revenue for one activity quantity under a billing unit. */
export function revenueFor(unit: BillingUnit, amount: number, quantity: number): number {
  if (unit === "percentage") return (quantity * amount) / 100;
  return quantity * amount;
}

function statsFrom(entries: readonly StatsEntry[]): Stats {
  const hospitalWide = entries.find((s) => s.departmentId === null);
  const pick = (k: keyof Omit<StatsEntry, "departmentId">) =>
    hospitalWide && hospitalWide[k] !== null ? hospitalWide[k] : sumOrNull(entries.filter((s) => s.departmentId !== null).map((s) => s[k]));
  return { patients: pick("patients"), admissions: pick("admissions"), occupiedBedDays: pick("occupiedBedDays"), ventilatorDays: pick("ventilatorDays") };
}

const EMPTY_STATS: Stats = { patients: null, admissions: null, occupiedBedDays: null, ventilatorDays: null };

/** Does the cost item apply in this month? (a version has started and it has not ended). */
export function costItemApplies(item: CostItemConfig, versionStarted: boolean, month: Month): boolean {
  return versionStarted && (item.endedFrom === null || month < item.endedFrom);
}

// ── calculation ────────────────────────────────────────────────────────────

export function calculatePeriod(config: HospitalConfig, period: PeriodInput): FinancialSummary {
  const month = period.month;
  const issues: Issue[] = [];
  const deptName = new Map(config.departments.map((d) => [d.id, d.name]));
  const serviceVolume = new Map<string, number | null>();

  // Services: revenue = volume × effective price
  const services: ServiceSummary[] = [];
  for (const service of config.services) {
    const rows = period.activity.filter((a) => a.hospitalServiceId === service.id);
    const price = versionFor(versionsOf(config.priceVersions, "hospitalServiceId", service.id), month);
    // Skip services that were not set up yet and have nothing recorded.
    if (!service.active && rows.length === 0) continue;
    if (!price && rows.length === 0) continue;

    const expected = service.departmentIds.length > 0 ? service.departmentIds : [null];
    const slots = new Map<string | null, number | null>(expected.map((d) => [d, null]));
    for (const r of rows) slots.set(r.departmentId, r.quantity);
    const missingSlots = [...slots.entries()].filter(([, q]) => q === null).map(([d]) => d);
    const volume = sumOrNull([...slots.values()]);
    serviceVolume.set(service.id, missingSlots.length === slots.size ? null : volume);

    const serviceIssues: Issue[] = missingSlots.map((d) => ({
      code: "missing_volume" as const,
      message: `${service.name}${d ? ` (${deptName.get(d) ?? "department"})` : ""}: volume not entered for ${monthLabel(month)}`,
      entityId: service.id,
    }));

    let revenue: Figure;
    let byDepartment: DepartmentSlice[];
    if (!price) {
      const priceIssue: Issue = {
        code: "missing_price",
        message: `${service.name}: no price effective for ${monthLabel(month)}`,
        entityId: service.id,
      };
      revenue = volume === 0 ? figure(0, serviceIssues) : figure(null, [priceIssue, ...serviceIssues], "missing");
      byDepartment = [...slots.entries()].map(([d, q]) => ({ departmentId: d, volume: q, revenue: null }));
    } else if (price.billingUnit === "fixed_contract") {
      revenue = figure(price.amount);
      byDepartment = [...slots.entries()].map(([d, q]) => ({ departmentId: d, volume: q, revenue: null }));
    } else {
      byDepartment = [...slots.entries()].map(([d, q]) => ({
        departmentId: d,
        volume: q,
        revenue: q === null ? null : revenueFor(price.billingUnit, price.amount, q),
      }));
      const value = sumOrNull(byDepartment.map((s) => s.revenue));
      revenue = value === null ? figure(null, serviceIssues, "missing") : figure(value, serviceIssues);
    }
    issues.push(...revenue.issues);

    services.push({
      hospitalServiceId: service.id,
      serviceId: service.serviceId,
      name: service.name,
      category: service.category,
      billingUnit: price?.billingUnit ?? null,
      price: price?.amount ?? null,
      priceEffectiveFrom: price?.effectiveFrom ?? null,
      volume: serviceVolume.get(service.id) ?? null,
      revenue,
      directCost: 0,
      contribution: null,
      byDepartment,
    });
  }

  // Costs: unit cost / monthly amount / per-FTE cost from the effective version
  const costLines: CostLine[] = [];
  for (const item of config.costItems) {
    const version = versionFor(versionsOf(config.costVersions, "costItemId", item.id), month);
    if (!costItemApplies(item, version !== null, month) || !version) continue;
    let quantity: number | null;
    let lineIssues: Issue[] = [];
    if (item.basis === "monthly") {
      quantity = 1;
    } else if (item.basis === "per_service_unit") {
      quantity = item.hospitalServiceId ? (serviceVolume.get(item.hospitalServiceId) ?? null) : null;
      if (quantity === null) {
        lineIssues = [{ code: "missing_linked_volume", message: `${item.name}: linked service volume not entered`, entityId: item.id }];
      }
    } else {
      quantity = period.costEntries.find((e) => e.costItemId === item.id)?.quantity ?? null;
      if (quantity === null) {
        lineIssues = [
          { code: "missing_cost_quantity", message: `${item.name}: ${item.unitLabel} quantity not entered for ${monthLabel(month)}`, entityId: item.id },
        ];
      }
    }
    const amount = quantity === null ? figure(null, lineIssues, "missing") : figure(quantity * version.amount);
    issues.push(...lineIssues);
    costLines.push({
      costItemId: item.id,
      name: item.name,
      category: item.category,
      basis: item.basis,
      unitLabel: item.unitLabel,
      hospitalServiceId: item.hospitalServiceId,
      departmentId: item.departmentId,
      isRtStaff: item.isRtStaff,
      unitCost: version.amount,
      quantity,
      amount,
    });
  }

  // Direct cost and contribution per service
  const withContribution = services.map((s) => {
    const direct = costLines
      .filter((c) => c.hospitalServiceId === s.hospitalServiceId && c.amount.value !== null)
      .reduce((sum, c) => sum + (c.amount.value as number), 0);
    return { ...s, directCost: direct, contribution: s.revenue.value === null ? null : s.revenue.value - direct };
  });

  const totals = summarizeTotals(withContribution, costLines, period.savings.map((s) => ({ category: s.category, amount: s.amount })), issues);
  const stats = statsFrom(period.stats);
  const departments = config.departments
    .filter((d) => d.active || period.activity.some((a) => a.departmentId === d.id) || period.stats.some((s) => s.departmentId === d.id))
    .map((d) => {
      const slices = withContribution.flatMap((s) => s.byDepartment.filter((b) => b.departmentId === d.id));
      const deptStats = period.stats.find((s) => s.departmentId === d.id);
      return {
        departmentId: d.id,
        name: d.name,
        beds: d.beds,
        volume: sumOrNull(slices.map((b) => b.volume)),
        revenue: sumOrNull(slices.map((b) => b.revenue)),
        stats: deptStats ? statsFrom([{ ...deptStats, departmentId: null }]) : EMPTY_STATS,
      };
    });

  return {
    hospitalId: config.id,
    hospitalName: config.name,
    label: monthLabel(month),
    months: [month],
    monthsWithData: [month],
    status: period.status,
    ...totals,
    services: withContribution,
    costLines,
    departments,
    stats,
    kpis: kpisFor(config, totals.revenue.value, totals.costs.value, stats, costLines, daysInMonth(month), 1),
  };
}

/** Revenue, cost, savings and net figures from lines (shared by months and aggregates). */
export function summarizeTotals(
  services: readonly ServiceSummary[],
  costLines: readonly CostLine[],
  savingsEntries: readonly { category: SavingsCategory; amount: number }[],
  issues: readonly Issue[],
) {
  const revenueIssues = services.flatMap((s) => s.revenue.issues);
  const revenueValue = sumOrNull(services.map((s) => s.revenue.value));
  const revenue =
    services.length === 0
      ? figure(null, [{ code: "no_activity", message: "No services with prices or activity for this period", entityId: null }], "missing")
      : revenueValue === null
        ? figure(null, revenueIssues, "missing")
        : figure(revenueValue, revenueIssues);

  const costIssues = costLines.flatMap((c) => c.amount.issues);
  const costValue = sumOrNull(costLines.map((c) => c.amount.value));
  const costs =
    costLines.length === 0 || costValue === null
      ? figure(null, [{ code: "no_cost_data", message: "Operating cost not configured for this period", entityId: null }, ...costIssues], "missing")
      : figure(costValue, costIssues);

  const costsByCategory: Partial<Record<CostCategory, number>> = {};
  for (const c of costLines) {
    if (c.amount.value !== null) costsByCategory[c.category] = (costsByCategory[c.category] ?? 0) + c.amount.value;
  }
  const savingsByCategory: Partial<Record<SavingsCategory, number>> = {};
  for (const s of savingsEntries) savingsByCategory[s.category] = (savingsByCategory[s.category] ?? 0) + s.amount;
  const savingsValue = savingsEntries.reduce((sum, s) => sum + s.amount, 0);
  const savings = savingsEntries.length === 0 ? figure(0, [], "missing") : figure(savingsValue);

  let net: Figure;
  if (costs.status === "missing") {
    net = figure(null, costs.issues, "missing");
  } else if (revenue.status === "missing") {
    net = figure(null, revenue.issues, "missing");
  } else {
    const value = (revenue.value ?? 0) - (costs.value ?? 0) + savingsValue;
    net = figure(value, [...revenue.issues, ...costs.issues]);
  }
  return { revenue, costs, savings, net, costsByCategory, savingsByCategory, issues: dedupe(issues) };
}

function dedupe(issues: readonly Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((i) => (seen.has(i.message) ? false : (seen.add(i.message), true)));
}

/** Bed capacity: the hospital's total beds, else the sum of its departments' beds. */
export function hospitalBeds(config: HospitalConfig): number | null {
  if (config.totalBeds !== null) return config.totalBeds;
  return sumOrNull(config.departments.filter((d) => d.active).map((d) => d.beds));
}

export function kpisFor(
  config: HospitalConfig,
  revenue: number | null,
  costs: number | null,
  stats: Stats,
  costLines: readonly CostLine[],
  days: number,
  monthsCount: number,
): Kpis {
  const beds = hospitalBeds(config);
  const rtLines = costLines.filter((c) => c.isRtStaff && c.quantity !== null);
  // FTE per month, averaged across the months summarised.
  const rtFte = rtLines.length ? rtLines.reduce((s, c) => s + (c.quantity as number), 0) / monthsCount : null;
  const avgOccupiedBeds = div(stats.occupiedBedDays, days);
  return {
    beds,
    days,
    occupancy: beds === null ? null : div(avgOccupiedBeds, beds),
    rtFte,
    revenuePerBed: div(revenue, beds),
    revenuePerOccupiedBed: div(revenue, avgOccupiedBeds),
    revenuePerRt: div(revenue, rtFte),
    costPerPatient: div(costs, stats.patients),
    costPerVentilatorDay: div(costs, stats.ventilatorDays),
  };
}
