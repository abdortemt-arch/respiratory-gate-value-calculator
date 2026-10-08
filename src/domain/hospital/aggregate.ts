/**
 * Multi-month summaries (quarter, year, year-to-date, custom range) built from
 * monthly results, so every month keeps the prices and costs that were
 * effective in that month.
 */
import type { Month } from "./month";
import {
  figure,
  kpisFor,
  summarizeTotals,
  type CostLine,
  type DepartmentSummary,
  type FinancialSummary,
  type Issue,
  type ServiceSummary,
  type Stats,
} from "./period";
import type { HospitalConfig } from "./types";

const add = (a: number | null, b: number | null): number | null => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));

function addStats(a: Stats, b: Stats): Stats {
  return {
    patients: add(a.patients, b.patients),
    admissions: add(a.admissions, b.admissions),
    occupiedBedDays: add(a.occupiedBedDays, b.occupiedBedDays),
    ventilatorDays: add(a.ventilatorDays, b.ventilatorDays),
  };
}

const EMPTY: Stats = { patients: null, admissions: null, occupiedBedDays: null, ventilatorDays: null };

/**
 * Sum monthly summaries. Months in `months` without an operating period are
 * reported as missing data, so a partial quarter is never shown as complete.
 */
export function aggregate(
  config: HospitalConfig,
  label: string,
  months: readonly Month[],
  monthly: readonly FinancialSummary[],
): FinancialSummary {
  const inRange = monthly.filter((m) => months.includes(m.months[0])).sort((a, b) => (a.months[0] < b.months[0] ? -1 : 1));
  const withData = inRange.map((m) => m.months[0]);
  const gaps = months.filter((m) => !withData.includes(m));

  // Services keyed by hospital service
  const serviceMap = new Map<string, ServiceSummary & { _issues: Issue[] }>();
  for (const m of inRange) {
    for (const s of m.services) {
      const prev = serviceMap.get(s.hospitalServiceId);
      if (!prev) {
        serviceMap.set(s.hospitalServiceId, { ...s, _issues: [...s.revenue.issues], byDepartment: s.byDepartment.map((d) => ({ ...d })) });
        continue;
      }
      const byDept = new Map(prev.byDepartment.map((d) => [d.departmentId, { ...d }]));
      for (const d of s.byDepartment) {
        const cur = byDept.get(d.departmentId);
        byDept.set(d.departmentId, cur ? { ...cur, volume: add(cur.volume, d.volume), revenue: add(cur.revenue, d.revenue) } : { ...d });
      }
      serviceMap.set(s.hospitalServiceId, {
        ...prev,
        billingUnit: s.billingUnit ?? prev.billingUnit,
        priceEffectiveFrom: s.priceEffectiveFrom ?? prev.priceEffectiveFrom,
        volume: add(prev.volume, s.volume),
        revenue: { value: add(prev.revenue.value, s.revenue.value), status: "complete", issues: [] },
        _issues: [...prev._issues, ...s.revenue.issues],
        directCost: prev.directCost + s.directCost,
        contribution: add(prev.contribution, s.contribution),
        byDepartment: [...byDept.values()],
      });
    }
  }
  const services: ServiceSummary[] = [...serviceMap.values()].map(({ _issues, ...s }) => {
    const value = s.revenue.value;
    return {
      ...s,
      // Average realised price across the months (volume-weighted).
      price: s.volume && value !== null && s.billingUnit !== "fixed_contract" ? value / s.volume : s.price,
      revenue: value === null ? figure(null, _issues, "missing") : figure(value, _issues),
    };
  });

  // Cost lines keyed by item
  const costMap = new Map<string, CostLine & { _issues: Issue[] }>();
  for (const m of inRange) {
    for (const c of m.costLines) {
      const prev = costMap.get(c.costItemId);
      if (!prev) {
        costMap.set(c.costItemId, { ...c, _issues: [...c.amount.issues] });
        continue;
      }
      costMap.set(c.costItemId, {
        ...prev,
        quantity: add(prev.quantity, c.quantity),
        unitCost: c.unitCost,
        amount: { value: add(prev.amount.value, c.amount.value), status: "complete", issues: [] },
        _issues: [...prev._issues, ...c.amount.issues],
      });
    }
  }
  const costLines: CostLine[] = [...costMap.values()].map(({ _issues, ...c }) => ({
    ...c,
    // Average unit cost over the range where quantities exist.
    unitCost: c.quantity && c.amount.value !== null ? c.amount.value / c.quantity : c.unitCost,
    amount: c.amount.value === null ? figure(null, _issues, "missing") : figure(c.amount.value, _issues),
  }));

  const savingsEntries = inRange.flatMap((m) =>
    Object.entries(m.savingsByCategory).map(([category, amount]) => ({ category: category as keyof typeof m.savingsByCategory, amount: amount as number })),
  );
  const gapIssues: Issue[] = gaps.map((g) => ({ code: "no_activity", message: `No operating period for ${g}`, entityId: null }));
  const totals = summarizeTotals(services, costLines, savingsEntries, [...inRange.flatMap((m) => m.issues), ...gapIssues]);

  // A range with missing months is at best partial.
  const withGaps = <T extends { value: number | null; status: string; issues: readonly Issue[] }>(f: T) =>
    gaps.length && f.value !== null ? figure(f.value, [...f.issues, ...gapIssues]) : f;

  const departmentsMap = new Map<string, DepartmentSummary>();
  for (const m of inRange) {
    for (const d of m.departments) {
      const prev = departmentsMap.get(d.departmentId);
      departmentsMap.set(
        d.departmentId,
        prev ? { ...prev, volume: add(prev.volume, d.volume), revenue: add(prev.revenue, d.revenue), stats: addStats(prev.stats, d.stats) } : d,
      );
    }
  }
  const stats = inRange.reduce((acc, m) => addStats(acc, m.stats), EMPTY);
  const days = inRange.reduce((s, m) => s + m.kpis.days, 0);

  return {
    hospitalId: config.id,
    hospitalName: config.name,
    label,
    months,
    monthsWithData: withData,
    status: null,
    revenue: withGaps(totals.revenue),
    costs: withGaps(totals.costs),
    savings: totals.savings,
    net: withGaps(totals.net),
    services,
    costLines,
    costsByCategory: totals.costsByCategory,
    savingsByCategory: totals.savingsByCategory,
    departments: [...departmentsMap.values()],
    stats,
    kpis: kpisFor(config, totals.revenue.value, totals.costs.value, stats, costLines, days || 1, Math.max(inRange.length, 1)),
    issues: totals.issues,
  };
}
