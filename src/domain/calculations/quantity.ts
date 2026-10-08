import type { InputKey } from "../inputs/catalog";
import type { StatusLabel } from "../copy/statusLabels";

/**
 * Every model output is a Quantity, never a bare number, so missing data can
 * never be displayed as a fake zero.
 *
 * - `calculated`: the workbook computes the same value with all inputs present.
 * - `partial`: the workbook computes a value while silently excluding blank
 *   components (formula map F1/F4). Same number, flagged with what is missing.
 * - `missing`: the workbook shows a text status; `label` is its wording.
 */
export type Quantity =
  | { readonly kind: "calculated"; readonly value: number; readonly basis: string; readonly inputs: readonly InputKey[] }
  | {
      readonly kind: "partial";
      readonly value: number;
      readonly basis: string;
      readonly inputs: readonly InputKey[];
      readonly missing: readonly InputKey[];
    }
  | { readonly kind: "missing"; readonly label: StatusLabel; readonly required: readonly InputKey[] };

export type NumericQuantity = Extract<Quantity, { value: number }>;

export function calculated(value: number, basis: string, inputs: readonly InputKey[] = []): Quantity {
  return { kind: "calculated", value, basis, inputs };
}

export function partial(
  value: number,
  basis: string,
  inputs: readonly InputKey[],
  missing: readonly InputKey[],
): Quantity {
  return missing.length === 0 ? calculated(value, basis, inputs) : { kind: "partial", value, basis, inputs, missing };
}

export function missing(label: StatusLabel, required: readonly InputKey[] = []): Quantity {
  return { kind: "missing", label, required: unique(required) };
}

export function hasValue(q: Quantity): q is NumericQuantity {
  return q.kind !== "missing";
}

/** Value or null — for charts and sums that must skip missing quantities. */
export function valueOrNull(q: Quantity): number | null {
  return hasValue(q) ? q.value : null;
}

/** Inputs still missing for this quantity (empty when fully calculated). */
export function missingInputs(q: Quantity): readonly InputKey[] {
  if (q.kind === "missing") return q.required;
  if (q.kind === "partial") return q.missing;
  return [];
}

/**
 * Scale a quantity, keeping its status. Used for sensitivities and sign flips.
 */
export function scale(q: Quantity, factor: number, basis: string): Quantity {
  return q.kind === "missing" ? q : { ...q, value: q.value * factor, basis };
}

export function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}
