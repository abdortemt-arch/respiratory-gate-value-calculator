/**
 * Hospital financial value bridge (EGP / year). Workbook: Value Bridge!A10:D26.
 *
 * Gross revenue − RT operating cost + cost avoided = net respiratory
 * service-line value. Steps without data are excluded and listed. The net value
 * is shown only once operating cost is entered — gross revenue alone is not
 * value (Rule 1).
 */
import type { InputKey } from "../inputs/catalog";
import { BRIDGE_STEP_STATUS, STATUS_LABELS, type BridgeStepStatus } from "../copy/statusLabels";
import { formatEgp } from "../format";
import { hasValue, missing, missingInputs, partial, unique, type Quantity } from "./quantity";

/** Workbook Value Bridge column B; drives the SUMIF totals. */
export type BridgeStepType = "revenue" | "cost" | "cost_avoidance";

export type BridgeStepId =
  | "icu_package"
  | "pft"
  | "education"
  | "future_programs"
  | "billing_leakage"
  | "operating_cost"
  | "ventilator_resources"
  | "niv_hfnc_utilization"
  | "oxygen_stewardship"
  | "consumable_standardization"
  | "equipment_utilization"
  | "staffing_outsourcing";

export interface BridgeStepInput {
  readonly id: BridgeStepId;
  readonly label: string;
  readonly type: BridgeStepType;
  /** Positive magnitude; `type` gives the direction (cost is subtracted). */
  readonly amount: Quantity;
}

export interface BridgeStep extends BridgeStepInput {
  readonly status: BridgeStepStatus;
}

export interface BridgeTotal {
  /** Sum of the quantified steps of this type (workbook C23:C25). */
  readonly value: number;
  /** Steps of this type that are not yet quantified and therefore excluded. */
  readonly excluded: readonly BridgeStepId[];
}

export interface ValueBridge {
  readonly steps: readonly BridgeStep[];
  readonly grossRevenue: BridgeTotal;
  readonly costAvoidance: BridgeTotal;
  readonly operatingCost: BridgeTotal;
  /** Value Bridge!C26 — "To be quantified" until operating cost is entered. */
  readonly net: Quantity;
}

function total(steps: readonly BridgeStep[], type: BridgeStepType): BridgeTotal {
  const ofType = steps.filter((s) => s.type === type);
  return {
    value: ofType.reduce((sum, s) => sum + (hasValue(s.amount) ? s.amount.value : 0), 0),
    excluded: ofType.filter((s) => !hasValue(s.amount)).map((s) => s.id),
  };
}

export function buildValueBridge(stepInputs: readonly BridgeStepInput[]): ValueBridge {
  const steps: BridgeStep[] = stepInputs.map((s) => ({
    ...s,
    status: hasValue(s.amount) ? BRIDGE_STEP_STATUS.calculated : BRIDGE_STEP_STATUS.excluded,
  }));

  const grossRevenue = total(steps, "revenue");
  const costAvoidance = total(steps, "cost_avoidance");
  const operatingCost = total(steps, "cost");

  const costStep = steps.find((s) => s.type === "cost");
  if (!costStep) throw new Error("Value bridge requires an operating cost step");

  let net: Quantity;
  if (!hasValue(costStep.amount)) {
    net = missing(STATUS_LABELS.toBeQuantified, costStep.amount.required);
  } else {
    const value = grossRevenue.value + costAvoidance.value - operatingCost.value;
    const included = steps.filter((s) => hasValue(s.amount));
    const inputs: InputKey[] = unique(included.flatMap((s) => (hasValue(s.amount) ? s.amount.inputs : [])));
    // Partial when the operating cost (or any included step) excludes blank components.
    const absent = unique(included.flatMap((s) => missingInputs(s.amount)));
    net = partial(
      value,
      `Gross revenue ${formatEgp(grossRevenue.value)} + cost avoidance ${formatEgp(costAvoidance.value)} − ` +
        `RT operating cost ${formatEgp(operatingCost.value)}`,
      inputs,
      absent,
    );
  }

  return { steps, grossRevenue, costAvoidance, operatingCost, net };
}
