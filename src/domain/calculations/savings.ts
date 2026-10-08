/**
 * Cost-avoidance levers. Workbook: Savings Scenarios!C8:F14, Value Bridge!C16:C21.
 *
 * Annual saving = hospital baseline × scenario %. Percentages are sensitivities,
 * not forecasts (Rule 3). Levers can overlap (Rule 4); totals are an
 * undeduplicated sum of the levers that have a baseline.
 */
import type { InputKey, InputValues } from "../inputs/catalog";
import { STATUS_LABELS } from "../copy/statusLabels";
import { formatEgp, formatPercent } from "../format";
import { SAVINGS_LEVELS, SAVINGS_LEVEL_LABELS, type SavingsLevel, type SavingsSensitivities } from "../scenario";
import { calculated, hasValue, missing, missingInputs, partial, unique, type Quantity } from "./quantity";

export type SavingsLeverId =
  | "ventilator_resources"
  | "niv_hfnc_utilization"
  | "oxygen_stewardship"
  | "consumable_standardization"
  | "equipment_utilization"
  | "staffing_outsourcing";

export interface SavingsLeverDefinition {
  readonly id: SavingsLeverId;
  readonly label: string;
  /** Workbook column B wording. */
  readonly basisLabel: string;
  readonly inputs: readonly InputKey[];
  /** Extra caution shown with the lever (formula map F13/F15). */
  readonly caveat?: string;
}

export const SAVINGS_LEVERS: readonly SavingsLeverDefinition[] = [
  {
    id: "ventilator_resources",
    label: "Ventilator resources",
    basisLabel: "Ventilated patient-days × cost per ventilator-day",
    inputs: ["ventilated_patient_days", "cost_per_ventilator_day"],
  },
  {
    id: "niv_hfnc_utilization",
    label: "NIV / HFNC utilization",
    basisLabel: "NIV days × cost per NIV day + HFNC days × cost per HFNC day",
    inputs: ["niv_patient_days", "cost_per_niv_day", "hfnc_patient_days", "cost_per_hfnc_day"],
  },
  {
    id: "oxygen_stewardship",
    label: "Oxygen stewardship",
    basisLabel: "Annual oxygen spend",
    inputs: ["oxygen_spend"],
  },
  {
    id: "consumable_standardization",
    label: "Consumable standardization",
    basisLabel: "Annual respiratory consumable spend",
    inputs: ["respiratory_consumable_spend"],
  },
  {
    id: "equipment_utilization",
    label: "Equipment utilization",
    basisLabel: "Rental + maintenance + planned purchases",
    inputs: ["equipment_rental_spend", "equipment_maintenance_spend", "planned_equipment_purchases"],
    caveat: "Baseline includes planned capital purchases (one-off capex), not only annual operating spend.",
  },
  {
    id: "staffing_outsourcing",
    label: "Staffing & outsourcing",
    basisLabel: "Overtime + PFT outsourcing + external respiratory services",
    inputs: ["respiratory_overtime_spend", "pft_outsourcing_spend", "external_respiratory_services_spend"],
    caveat: "PFT outsourcing savings may overlap with in-house PFT revenue.",
  },
];

/** Baseline (Savings Scenarios column C). Missing ⇔ the workbook's "". */
export function leverBaseline(values: InputValues, lever: SavingsLeverDefinition): Quantity {
  const v = (k: InputKey) => values[k];
  const absent = lever.inputs.filter((k) => v(k) === null);

  switch (lever.id) {
    case "ventilator_resources":
    case "oxygen_stewardship":
    case "consumable_standardization": {
      // All inputs required: IF(OR(a="",b=""),"",a*b) / IF(a="","",a)
      if (absent.length > 0) return missing(STATUS_LABELS.baselineRequired, absent);
      const value = lever.inputs.reduce((product, k) => product * (v(k) as number), 1);
      return calculated(value, `${lever.basisLabel} = ${formatEgp(value)}`, lever.inputs);
    }
    case "niv_hfnc_utilization": {
      // Quantified when at least one (days, cost) pair is complete; a blank in the
      // other pair counts as 0 (N() in the workbook) -> partial.
      const [nivDays, nivCost, hfncDays, hfncCost] = lever.inputs.map(v);
      const nivComplete = nivDays !== null && nivCost !== null;
      const hfncComplete = hfncDays !== null && hfncCost !== null;
      if (!nivComplete && !hfncComplete) return missing(STATUS_LABELS.baselineRequired, absent);
      const value = (nivDays ?? 0) * (nivCost ?? 0) + (hfncDays ?? 0) * (hfncCost ?? 0);
      return partial(value, `${lever.basisLabel} = ${formatEgp(value)}`, lever.inputs, absent);
    }
    case "equipment_utilization":
    case "staffing_outsourcing": {
      // IF(COUNT(a,b,c)=0,"",SUM(a,b,c)): blank components are excluded -> partial.
      if (absent.length === lever.inputs.length) return missing(STATUS_LABELS.baselineRequired, absent);
      const value = lever.inputs.reduce((sum, k) => sum + (v(k) ?? 0), 0);
      return partial(value, `${lever.basisLabel} = ${formatEgp(value)}`, lever.inputs, absent);
    }
  }
}

/** Savings Scenarios!D8:F13 = IF(baseline="","Baseline required",baseline*pct) */
export function leverSaving(baseline: Quantity, pct: number, level: SavingsLevel): Quantity {
  if (!hasValue(baseline)) return missing(STATUS_LABELS.baselineRequired, baseline.required);
  const basis = `${formatEgp(baseline.value)} baseline × ${formatPercent(pct)} (${SAVINGS_LEVEL_LABELS[level]} sensitivity)`;
  return { ...baseline, value: baseline.value * pct, basis };
}

export interface LeverResult {
  readonly lever: SavingsLeverDefinition;
  readonly baseline: Quantity;
  readonly savings: Readonly<Record<SavingsLevel, Quantity>>;
}

export function calculateLevers(values: InputValues, sensitivities: SavingsSensitivities): LeverResult[] {
  return SAVINGS_LEVERS.map((lever) => {
    const baseline = leverBaseline(values, lever);
    const savings = Object.fromEntries(
      SAVINGS_LEVELS.map((level) => [level, leverSaving(baseline, sensitivities[level], level)]),
    ) as Record<SavingsLevel, Quantity>;
    return { lever, baseline, savings };
  });
}

/**
 * Savings Scenarios row 14: IF(COUNT(range)=0,"Baseline required",SUM(range)).
 * Undeduplicated sum of levers with a value; partial when any lever is missing
 * or partial.
 */
export function sumLevers(quantities: readonly Quantity[], basisLabel: string): Quantity {
  const withValue = quantities.filter(hasValue);
  const absent = unique(quantities.flatMap(missingInputs));
  if (withValue.length === 0) return missing(STATUS_LABELS.baselineRequired, absent);
  const value = withValue.reduce((sum, q) => sum + q.value, 0);
  const inputs = unique(withValue.flatMap((q) => q.inputs));
  const counted = `${withValue.length} of ${quantities.length} levers`;
  return partial(value, `${basisLabel} (${counted}, undeduplicated)`, inputs, absent);
}

export interface SavingsTotals {
  readonly baseline: Quantity;
  readonly byLevel: Readonly<Record<SavingsLevel, Quantity>>;
}

export function savingsTotals(levers: readonly LeverResult[]): SavingsTotals {
  return {
    baseline: sumLevers(
      levers.map((l) => l.baseline),
      "Sum of lever baselines",
    ),
    byLevel: Object.fromEntries(
      SAVINGS_LEVELS.map((level) => [
        level,
        sumLevers(
          levers.map((l) => l.savings[level]),
          `Sum of ${SAVINGS_LEVEL_LABELS[level]} lever savings`,
        ),
      ]),
    ) as Record<SavingsLevel, Quantity>,
  };
}
