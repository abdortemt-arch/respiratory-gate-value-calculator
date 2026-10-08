/**
 * Revenue: occupancy × package-price matrix, ICU package revenue for the
 * selected scenario, other revenue streams and billing leakage recovery.
 * Workbook: Revenue!B18:E35, Revenue!D39:D41, Value Bridge!C10, C14.
 */
import { OCCUPANCY_SCENARIO_KEYS, PRICE_SCENARIO_KEYS, type InputKey, type InputValues } from "../inputs/catalog";
import { STATUS_LABELS } from "../copy/statusLabels";
import { formatEgp, formatNumber, formatPercent } from "../format";
import type { ScenarioSettings } from "../scenario";
import { calculated, missing, type Quantity } from "./quantity";

export type RevenuePeriod = "daily" | "monthly" | "annual";

function nullKeys(values: InputValues, keys: readonly InputKey[]): InputKey[] {
  return keys.filter((k) => values[k] === null);
}

export interface RevenueMatrixRow {
  readonly occupancy: number;
  /** ICU beds × occupancy — not rounded (45 × 0.55 = 24.75). */
  readonly occupiedBeds: number;
  /** Gross per price column, in the same order as `prices`. */
  readonly daily: readonly number[];
  readonly monthly: readonly number[];
  readonly annual: readonly number[];
}

export type RevenueMatrix =
  | {
      readonly kind: "ready";
      readonly beds: number;
      readonly daysPerMonth: number;
      readonly daysPerYear: number;
      readonly occupancies: readonly number[];
      readonly prices: readonly number[];
      readonly rows: readonly RevenueMatrixRow[];
    }
  | { readonly kind: "missing"; readonly required: readonly InputKey[] };

/**
 * Occupancy × price grid (Revenue!B18:E35). Requires ICU beds; the workbook
 * would show zeros without them (deviation D1).
 */
export function occupancyPriceMatrix(values: InputValues): RevenueMatrix {
  const required: InputKey[] = ["icu_beds", "days_per_month", "days_per_year", ...OCCUPANCY_SCENARIO_KEYS, ...PRICE_SCENARIO_KEYS];
  const absent = nullKeys(values, required);
  if (absent.length > 0) return { kind: "missing", required: absent };

  const beds = values.icu_beds as number;
  const daysPerMonth = values.days_per_month as number;
  const daysPerYear = values.days_per_year as number;
  const occupancies = OCCUPANCY_SCENARIO_KEYS.map((k) => values[k] as number);
  const prices = PRICE_SCENARIO_KEYS.map((k) => values[k] as number);

  const rows = occupancies.map((occupancy) => {
    const occupiedBeds = beds * occupancy;
    const daily = prices.map((price) => occupiedBeds * price);
    return {
      occupancy,
      occupiedBeds,
      daily,
      monthly: daily.map((d) => d * daysPerMonth),
      annual: daily.map((d) => d * daysPerYear),
    };
  });

  return { kind: "ready", beds, daysPerMonth, daysPerYear, occupancies, prices, rows };
}

/**
 * ICU Respiratory Management Package gross revenue for the selected scenario.
 * Annual = Value Bridge!C10 = beds × occupancy × price × days/year.
 * Gross potential only — not profit.
 */
export function icuPackageGross(values: InputValues, scenario: ScenarioSettings, period: RevenuePeriod = "annual"): Quantity {
  const daysKey: InputKey | null = period === "annual" ? "days_per_year" : period === "monthly" ? "days_per_month" : null;
  const required: InputKey[] = daysKey ? ["icu_beds", daysKey] : ["icu_beds"];
  const absent = nullKeys(values, required);
  if (absent.length > 0) return missing(STATUS_LABELS.dataRequired, absent);

  const beds = values.icu_beds as number;
  const days = daysKey ? (values[daysKey] as number) : 1;
  const value = beds * scenario.occupancyRate * scenario.packagePrice * days;
  const basis =
    `${formatNumber(beds)} beds × ${formatPercent(scenario.occupancyRate)} occupancy × ${formatEgp(scenario.packagePrice)}` +
    (daysKey ? ` × ${formatNumber(days)} days` : " per day");
  return calculated(value, basis, required);
}

export type OtherStreamId = "pft" | "education" | "future_programs";

export interface OtherStreamDefinition {
  readonly id: OtherStreamId;
  readonly label: string;
  readonly bridgeLabel: string;
  readonly volumeKey: InputKey;
  readonly priceKey: InputKey;
  readonly basisLabel: string;
}

export const OTHER_STREAMS: readonly OtherStreamDefinition[] = [
  {
    id: "pft",
    label: "Pulmonary Function Testing",
    bridgeLabel: "PFT revenue",
    volumeKey: "pft_annual_tests",
    priceKey: "pft_price_per_test",
    basisLabel: "Tests a year × PFT tariff",
  },
  {
    id: "education",
    label: "Education Center",
    bridgeLabel: "Education revenue",
    volumeKey: "education_annual_participants",
    priceKey: "education_fee_per_participant",
    basisLabel: "Participants × course fee",
  },
  {
    id: "future_programs",
    label: "Future clinical programs",
    bridgeLabel: "Future clinical programs",
    volumeKey: "future_programs_annual_enrolled",
    priceKey: "future_programs_fee",
    basisLabel: "Enrolments × program fee",
  },
];

/** Revenue!D39:D41 = IF(OR(volume="",price=""),"Scenario pending",volume*price) */
export function otherStreamGross(values: InputValues, stream: OtherStreamDefinition): Quantity {
  const keys = [stream.volumeKey, stream.priceKey];
  const absent = nullKeys(values, keys);
  if (absent.length > 0) return missing(STATUS_LABELS.scenarioPending, absent);
  const volume = values[stream.volumeKey] as number;
  const price = values[stream.priceKey] as number;
  return calculated(volume * price, `${formatNumber(volume)} × ${formatEgp(price)}`, keys);
}

export const BILLING_LEAKAGE_KEYS = [
  "unbilled_eligible_respiratory_activities",
  "avg_tariff_per_respiratory_activity",
  "collection_rate",
] as const satisfies readonly InputKey[];

/**
 * Value Bridge!C14: unbilled eligible activities × average tariff × collection rate.
 * Recovered billing is revenue, not a saving (Rule 5).
 */
export function billingLeakageRecovery(values: InputValues): Quantity {
  const absent = nullKeys(values, BILLING_LEAKAGE_KEYS);
  if (absent.length > 0) return missing(STATUS_LABELS.baselineRequired, absent);
  const unbilled = values.unbilled_eligible_respiratory_activities as number;
  const tariff = values.avg_tariff_per_respiratory_activity as number;
  const rate = values.collection_rate as number;
  return calculated(
    unbilled * tariff * rate,
    `${formatNumber(unbilled)} unbilled activities × ${formatEgp(tariff)} × ${formatPercent(rate)} collection`,
    BILLING_LEAKAGE_KEYS,
  );
}
