/**
 * Data completeness (formula map §10).
 * - model: hospital inputs that feed at least one calculation (34).
 * - all:   every requested hospital input, including informational ones (46).
 * RG model assumptions are excluded: they always carry a workbook default.
 */
import {
  INPUT_DEFINITIONS,
  type InputDefinition,
  type InputGroupId,
  type InputKey,
  type InputValues,
} from "../inputs/catalog";

export interface CompletenessCount {
  readonly entered: number;
  readonly total: number;
  readonly missing: readonly InputKey[];
}

export interface Completeness {
  readonly model: CompletenessCount;
  readonly all: CompletenessCount;
  readonly byGroup: Readonly<Partial<Record<InputGroupId, CompletenessCount>>>;
}

const HOSPITAL_INPUTS = INPUT_DEFINITIONS.filter((d) => d.source !== "rg_assumption");

function count(values: InputValues, defs: readonly InputDefinition[]): CompletenessCount {
  const missing = defs.filter((d) => values[d.key as InputKey] === null).map((d) => d.key as InputKey);
  return { entered: defs.length - missing.length, total: defs.length, missing };
}

export function completeness(values: InputValues): Completeness {
  const groups = [...new Set(HOSPITAL_INPUTS.map((d) => d.group))];
  return {
    model: count(
      values,
      HOSPITAL_INPUTS.filter((d) => d.usage === "model"),
    ),
    all: count(values, HOSPITAL_INPUTS),
    byGroup: Object.fromEntries(
      groups.map((g) => [
        g,
        count(
          values,
          HOSPITAL_INPUTS.filter((d) => d.group === g),
        ),
      ]),
    ),
  };
}

/** 0–1 share of entered inputs; 1 when there is nothing to enter. */
export function ratio(c: CompletenessCount): number {
  return c.total === 0 ? 1 : c.entered / c.total;
}
