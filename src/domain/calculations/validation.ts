/**
 * Input parsing and validation (formula map F9). The workbook accepts anything
 * (text -> #VALUE!, 80 instead of 0.8 -> 100× revenue); the platform does not.
 *
 * Missing data is not a validation error — it is a completeness state.
 */
import { getInputDefinition, type InputDefinition, type InputKey, type InputValues } from "../inputs/catalog";
import { formatNumber } from "../format";
import { isSavingsLevel, type ScenarioSettings } from "../scenario";

export type ParseResult = { readonly ok: true; readonly value: number | null } | { readonly ok: false; readonly error: string };

/**
 * Parse what a user typed into the stored value.
 * Percentages are typed as percent ("80" or "80%") and stored as fractions (0.8).
 * Thousands separators, spaces and an "EGP" prefix are ignored. Empty = unknown (null).
 */
export function parseInputText(def: InputDefinition, raw: string): ParseResult {
  const text = raw.trim();
  if (text === "") {
    return def.source === "rg_assumption"
      ? { ok: false, error: "Required — Respiratory Gate assumptions cannot be blank." }
      : { ok: true, value: null };
  }
  const cleaned = text.replace(/^egp\s*/i, "").replace(/[,\s]/g, "").replace(/%$/, "");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return { ok: false, error: "Enter a number." };
  const number = Number(cleaned);
  if (!Number.isFinite(number)) return { ok: false, error: "Enter a number." };
  const value = def.kind === "percent" ? number / 100 : number;
  const error = validateValue(def, value);
  return error ? { ok: false, error } : { ok: true, value: def.kind === "percent" ? roundFraction(value) : value };
}

/** Avoid 0.1 + float noise when converting typed percentages (e.g. 7 / 100). */
function roundFraction(value: number): number {
  return Number(value.toPrecision(12));
}

/** Validate a stored value. Returns an error message, or null when valid. */
export function validateValue(def: InputDefinition, value: number | null): string | null {
  if (value === null) return def.source === "rg_assumption" ? "Required — Respiratory Gate assumptions cannot be blank." : null;
  if (!Number.isFinite(value)) return "Enter a number.";
  if (value < 0) return "Must not be negative.";
  if (def.kind === "count" && !Number.isInteger(value)) return "Enter a whole number.";
  if (def.kind === "currency" && Math.abs(Math.round(value * 100) - value * 100) > 1e-6) {
    return "Use at most 2 decimal places.";
  }
  const display = (v: number) => (def.kind === "percent" ? `${formatNumber(v * 100)}%` : formatNumber(v));
  const max = def.max ?? (def.kind === "percent" ? 1 : undefined);
  if (max !== undefined && value > max) return `Must be at most ${display(max)}.`;
  if (def.min !== undefined) {
    if (def.exclusiveMin && value <= def.min) return `Must be greater than ${display(def.min)}.`;
    if (!def.exclusiveMin && value < def.min) return `Must be at least ${display(def.min)}.`;
  }
  return null;
}

export interface PlausibilityWarning {
  readonly keys: readonly InputKey[];
  readonly message: string;
}

/**
 * Saved but flagged: values that are valid yet unlikely, or need a qualifier.
 * `texts` carries the optional text qualifiers (e.g. oxygen consumption unit).
 */
export function plausibilityWarnings(
  values: InputValues,
  texts: Partial<Record<InputKey, string | null>> = {},
): PlausibilityWarning[] {
  const warnings: PlausibilityWarning[] = [];
  const { icu_beds: beds, days_per_year: days } = values;

  if (values.ventilated_patient_days !== null && beds !== null && days !== null && values.ventilated_patient_days > beds * days) {
    warnings.push({
      keys: ["ventilated_patient_days", "icu_beds"],
      message: `Ventilated patient-days exceed available ICU bed-days (${formatNumber(beds)} beds × ${formatNumber(days)} days).`,
    });
  }
  if (values.oxygen_consumption !== null && !texts.oxygen_consumption?.trim()) {
    warnings.push({ keys: ["oxygen_consumption"], message: "State the unit of oxygen consumption (e.g. m³, cylinders)." });
  }
  if (
    values.unbilled_eligible_respiratory_activities !== null &&
    values.unbilled_eligible_respiratory_activities > 0 &&
    values.avg_tariff_per_respiratory_activity === 0
  ) {
    warnings.push({
      keys: ["avg_tariff_per_respiratory_activity"],
      message: "Average tariff is 0, so billing leakage recovery will be 0.",
    });
  }
  if (values.collection_rate === 0) {
    warnings.push({ keys: ["collection_rate"], message: "Collection rate is 0%, so billing leakage recovery will be 0." });
  }
  return warnings;
}

export function validateInputs(values: InputValues): { key: InputKey; error: string }[] {
  return (Object.keys(values) as InputKey[])
    .map((key) => ({ key, error: validateValue(getInputDefinition(key), values[key]) }))
    .filter((e): e is { key: InputKey; error: string } => e.error !== null);
}

/** Scenario selection and sensitivities (Value Bridge C4:C6, Savings D5:F5). */
export function validateScenario(s: ScenarioSettings): string[] {
  const errors: string[] = [];
  if (!(s.occupancyRate > 0 && s.occupancyRate <= 1)) errors.push("Occupancy must be greater than 0% and at most 100%.");
  if (!(s.packagePrice > 0) || !Number.isFinite(s.packagePrice)) errors.push("Package price must be greater than EGP 0.");
  if (!isSavingsLevel(s.savingsLevel)) errors.push("Savings level must be Low, Mid or High.");
  for (const [level, pct] of Object.entries(s.sensitivities)) {
    if (!(pct >= 0 && pct <= 1)) errors.push(`${level} savings sensitivity must be between 0% and 100%.`);
  }
  return errors;
}
