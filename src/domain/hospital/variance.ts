/**
 * Why did B differ from A? Decomposes the change in net value into drivers:
 *   service revenue  ΔR = (Q₂ − Q₁) × P₁  [volume]  +  (P₂ − P₁) × Q₂  [price]
 *   per-unit costs   ΔC = (q₂ − q₁) × c₁  [quantity] + (c₂ − c₁) × q₂ [unit cost]
 *   monthly costs    ΔC = A₂ − A₁ [rate]
 *   savings          ΔS by category
 * The effects add up exactly to the change (prices may be monthly or averages).
 */
import { BILLING_UNITS, SAVINGS_CATEGORIES, type SavingsCategory } from "./lists";
import type { FinancialSummary } from "./period";

export type DriverKind =
  | "service_volume"
  | "service_price"
  | "service_new"
  | "service_stopped"
  | "service_fixed"
  | "cost_quantity"
  | "cost_rate"
  | "cost_new"
  | "cost_stopped"
  | "savings";

export interface Driver {
  readonly kind: DriverKind;
  /** Service, cost item or savings category name. */
  readonly subject: string;
  /** Effect on net value (EGP): revenue and savings up = positive, cost up = negative. */
  readonly effect: number;
  readonly from: number | null;
  readonly to: number | null;
  readonly unit: string;
}

export interface VarianceSummary {
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly revenueChange: number | null;
  readonly costChange: number | null;
  readonly savingsChange: number;
  readonly netChange: number | null;
  readonly drivers: readonly Driver[];
  /** Items whose change could not be explained because data is missing. */
  readonly unexplained: readonly string[];
}

const val = (n: number | null | undefined): number => n ?? 0;

export function explainVariance(a: FinancialSummary, b: FinancialSummary): VarianceSummary {
  const drivers: Driver[] = [];
  const unexplained: string[] = [];

  // Services, matched by library service so hospitals can be compared too.
  const keys = new Set([...a.services.map((s) => s.serviceId), ...b.services.map((s) => s.serviceId)]);
  for (const key of keys) {
    const s1 = a.services.find((s) => s.serviceId === key);
    const s2 = b.services.find((s) => s.serviceId === key);
    const name = (s2 ?? s1)!.name;
    const r1 = s1?.revenue.value ?? null;
    const r2 = s2?.revenue.value ?? null;
    if (!s1 || r1 === null) {
      if (s2 && r2 !== null && r2 !== 0) drivers.push({ kind: "service_new", subject: name, effect: r2, from: null, to: r2, unit: "EGP" });
      else if (s2 && r2 === null) unexplained.push(`${name}: revenue not available in ${b.label}`);
      continue;
    }
    if (!s2 || r2 === null) {
      if (!s2 && r1 !== 0) drivers.push({ kind: "service_stopped", subject: name, effect: -r1, from: r1, to: null, unit: "EGP" });
      else if (s2) unexplained.push(`${name}: revenue not available in ${b.label}`);
      continue;
    }
    if (r1 === r2) continue;
    const unit = s2.billingUnit ?? s1.billingUnit;
    const priced = unit !== null && unit !== "fixed_contract" && s1.volume !== null && s2.volume !== null && s1.price !== null && s2.price !== null;
    if (!priced) {
      drivers.push({ kind: "service_fixed", subject: name, effect: r2 - r1, from: r1, to: r2, unit: "EGP" });
      continue;
    }
    const factor = unit === "percentage" ? 0.01 : 1;
    const volumeEffect = (s2.volume! - s1.volume!) * s1.price! * factor;
    const priceEffect = (s2.price! - s1.price!) * s2.volume! * factor;
    const volumeUnit = BILLING_UNITS[unit].volume;
    if (Math.abs(volumeEffect) > 0.005) {
      drivers.push({ kind: "service_volume", subject: name, effect: volumeEffect, from: s1.volume, to: s2.volume, unit: volumeUnit });
    }
    if (Math.abs(priceEffect) > 0.005) {
      drivers.push({ kind: "service_price", subject: name, effect: priceEffect, from: s1.price, to: s2.price, unit: "EGP" });
    }
  }

  // Costs: same hospital -> by cost item; different hospitals -> by category.
  const sameHospital = a.hospitalId === b.hospitalId;
  if (sameHospital) {
    const ids = new Set([...a.costLines.map((c) => c.costItemId), ...b.costLines.map((c) => c.costItemId)]);
    for (const id of ids) {
      const c1 = a.costLines.find((c) => c.costItemId === id);
      const c2 = b.costLines.find((c) => c.costItemId === id);
      const name = (c2 ?? c1)!.name;
      const v1 = c1?.amount.value ?? null;
      const v2 = c2?.amount.value ?? null;
      if (!c1 || v1 === null) {
        if (c2 && v2 !== null && v2 !== 0) drivers.push({ kind: "cost_new", subject: name, effect: -v2, from: null, to: v2, unit: "EGP" });
        else if (c2 && v2 === null) unexplained.push(`${name}: cost not available in ${b.label}`);
        continue;
      }
      if (!c2 || v2 === null) {
        if (!c2 && v1 !== 0) drivers.push({ kind: "cost_stopped", subject: name, effect: v1, from: v1, to: null, unit: "EGP" });
        else if (c2) unexplained.push(`${name}: cost not available in ${b.label}`);
        continue;
      }
      if (v1 === v2) continue;
      if (c2.basis === "monthly" || c1.quantity === null || c2.quantity === null || c1.unitCost === null || c2.unitCost === null) {
        drivers.push({ kind: "cost_rate", subject: name, effect: -(v2 - v1), from: v1, to: v2, unit: "EGP" });
        continue;
      }
      const quantityEffect = (c2.quantity - c1.quantity) * c1.unitCost;
      const rateEffect = (c2.unitCost - c1.unitCost) * c2.quantity;
      if (Math.abs(quantityEffect) > 0.005) {
        drivers.push({ kind: "cost_quantity", subject: name, effect: -quantityEffect, from: c1.quantity, to: c2.quantity, unit: c2.unitLabel });
      }
      if (Math.abs(rateEffect) > 0.005) {
        drivers.push({ kind: "cost_rate", subject: name, effect: -rateEffect, from: c1.unitCost, to: c2.unitCost, unit: "EGP" });
      }
    }
  } else {
    const cats = new Set([...Object.keys(a.costsByCategory), ...Object.keys(b.costsByCategory)]);
    for (const cat of cats) {
      const v1 = val(a.costsByCategory[cat as keyof typeof a.costsByCategory]);
      const v2 = val(b.costsByCategory[cat as keyof typeof b.costsByCategory]);
      if (v1 !== v2) drivers.push({ kind: "cost_rate", subject: cat, effect: -(v2 - v1), from: v1, to: v2, unit: "EGP" });
    }
  }

  // Savings by category
  const savingsCats = new Set([...Object.keys(a.savingsByCategory), ...Object.keys(b.savingsByCategory)]) as Set<SavingsCategory>;
  for (const cat of savingsCats) {
    const v1 = val(a.savingsByCategory[cat]);
    const v2 = val(b.savingsByCategory[cat]);
    if (v1 !== v2) drivers.push({ kind: "savings", subject: SAVINGS_CATEGORIES[cat], effect: v2 - v1, from: v1, to: v2, unit: "EGP" });
  }

  drivers.sort((x, y) => Math.abs(y.effect) - Math.abs(x.effect));
  const change = (x: number | null, y: number | null) => (x === null || y === null ? null : y - x);
  return {
    fromLabel: a.label,
    toLabel: b.label,
    revenueChange: change(a.revenue.value, b.revenue.value),
    costChange: change(a.costs.value, b.costs.value),
    savingsChange: val(b.savings.value) - val(a.savings.value),
    netChange: change(a.net.value, b.net.value),
    drivers,
    unexplained,
  };
}
