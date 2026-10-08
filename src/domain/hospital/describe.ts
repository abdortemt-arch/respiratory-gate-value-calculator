/**
 * Plain-language descriptions of prices and versions for screens and reports.
 */
import { formatMoney } from "../format";
import { BILLING_UNITS, type BillingUnit } from "./lists";
import { monthLabel, type Month } from "./month";

const UNIT_PHRASE: Record<BillingUnit, string> = {
  per_procedure: "per procedure",
  per_patient: "per patient",
  per_session: "per session",
  per_day: "per day",
  per_ventilator_day: "per ventilator day",
  per_hour: "per hour",
  per_case: "per case",
  monthly_package: "per monthly package",
  fixed_contract: "per month (fixed contract)",
  percentage: "of the billed base",
  custom: "per unit",
};

/** "EGP 1,800 per day", "12% of the billed base", "EGP 50,000 per month (fixed contract)". */
export function formatPrice(amount: number, currency: string, unit: BillingUnit): string {
  if (unit === "percentage") return `${amount}% ${UNIT_PHRASE.percentage}`;
  return `${formatMoney(amount, currency)} ${UNIT_PHRASE[unit]}`;
}

/** "EGP 1,800 per day from Feb 2026". */
export function describePriceVersion(v: { amount: number; currency: string; billingUnit: BillingUnit; effectiveFrom: Month }): string {
  return `${formatPrice(v.amount, v.currency, v.billingUnit)} from ${monthLabel(v.effectiveFrom, "short")}`;
}

/** The volume a billing unit counts, e.g. "ventilator days". */
export function volumeUnit(unit: BillingUnit | null): string {
  return unit ? BILLING_UNITS[unit].volume : "units";
}
