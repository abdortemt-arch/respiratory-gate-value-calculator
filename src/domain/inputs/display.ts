/**
 * How inputs are shown and edited. Percentages are stored as fractions and
 * edited as percent; unknown values are never rendered as 0.
 */
import { BILLING_LEAKAGE_KEYS } from "../calculations/revenue";
import { SAVINGS_LEVERS } from "../calculations/savings";
import { STATUS_LABELS } from "../copy/statusLabels";
import { formatEgp, formatNumber, formatPercent } from "../format";
import type { InputDefinition, InputKey } from "./catalog";

const BASELINE_INPUTS = new Set<string>([...SAVINGS_LEVERS.flatMap((l) => l.inputs), ...BILLING_LEAKAGE_KEYS]);

/** Label shown while an input is blank (CLAUDE.md: "Baseline required" / "Data required"). */
export function missingLabel(def: InputDefinition): string {
  if (def.usage === "informational") return "Not provided";
  return BASELINE_INPUTS.has(def.key) ? STATUS_LABELS.baselineRequired : STATUS_LABELS.dataRequired;
}

/** Read-only display, e.g. "EGP 3,000,000", "85%", "4,200". */
export function formatInputValue(def: InputDefinition, value: number | null): string {
  if (value === null) return missingLabel(def);
  if (def.kind === "percent") return formatPercent(value);
  if (def.kind === "currency") return formatEgp(value);
  return formatNumber(value);
}

/** Text placed in the edit box: percent as "85", numbers without grouping. */
export function toEditableText(def: InputDefinition, value: number | null): string {
  if (value === null) return "";
  if (def.kind === "percent") return String(Number((value * 100).toPrecision(12)));
  return String(value);
}

/** Suffix/prefix shown inside the edit box. */
export function inputAdornment(def: InputDefinition): { prefix?: string; suffix?: string } {
  if (def.kind === "percent") return { suffix: "%" };
  if (def.kind === "currency") return { prefix: "EGP" };
  return {};
}

export function isBaselineInput(key: InputKey): boolean {
  return BASELINE_INPUTS.has(key);
}
