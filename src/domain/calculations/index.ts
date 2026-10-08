/**
 * calculateModel: the single, pure entry point used by every screen, the
 * executive report and the parity tests.
 */
import type { InputKey, InputValues } from "../inputs/catalog";
import type { ScenarioSettings } from "../scenario";
import { completeness, type Completeness } from "./completeness";
import { contributionMargin, operatingCostLines, totalOperatingCost, type OperatingCostLine } from "./operatingCost";
import type { Quantity } from "./quantity";
import {
  billingLeakageRecovery,
  icuPackageGross,
  occupancyPriceMatrix,
  otherStreamGross,
  OTHER_STREAMS,
  type OtherStreamDefinition,
  type RevenueMatrix,
  type RevenuePeriod,
} from "./revenue";
import { calculateLevers, savingsTotals, type LeverResult, type SavingsTotals } from "./savings";
import { plausibilityWarnings, type PlausibilityWarning } from "./validation";
import { buildValueBridge, type BridgeStepInput, type ValueBridge } from "./valueBridge";

export interface ModelResult {
  readonly scenario: ScenarioSettings;
  readonly revenue: {
    readonly matrix: RevenueMatrix;
    readonly icuPackage: Readonly<Record<RevenuePeriod, Quantity>>;
    readonly otherStreams: readonly { readonly stream: OtherStreamDefinition; readonly gross: Quantity }[];
    readonly billingLeakage: Quantity;
  };
  readonly savings: {
    readonly levers: readonly LeverResult[];
    readonly totals: SavingsTotals;
  };
  readonly operatingCost: {
    readonly lines: readonly OperatingCostLine[];
    readonly total: Quantity;
    readonly contributionMargin: Quantity;
  };
  readonly bridge: ValueBridge;
  readonly completeness: Completeness;
  readonly warnings: readonly PlausibilityWarning[];
}

export function calculateModel(
  values: InputValues,
  scenario: ScenarioSettings,
  texts: Partial<Record<InputKey, string | null>> = {},
): ModelResult {
  const icuPackage = {
    daily: icuPackageGross(values, scenario, "daily"),
    monthly: icuPackageGross(values, scenario, "monthly"),
    annual: icuPackageGross(values, scenario, "annual"),
  };
  const otherStreams = OTHER_STREAMS.map((stream) => ({ stream, gross: otherStreamGross(values, stream) }));
  const billingLeakage = billingLeakageRecovery(values);

  const levers = calculateLevers(values, scenario.sensitivities);
  const totals = savingsTotals(levers);

  const opTotal = totalOperatingCost(values);
  const margin = contributionMargin(icuPackage.annual, opTotal);

  const steps: BridgeStepInput[] = [
    { id: "icu_package", label: "ICU package revenue (gross)", type: "revenue", amount: icuPackage.annual },
    ...otherStreams.map(({ stream, gross }) => ({
      id: stream.id,
      label: stream.bridgeLabel,
      type: "revenue" as const,
      amount: gross,
    })),
    { id: "billing_leakage", label: "Billing leakage recovery", type: "revenue", amount: billingLeakage },
    { id: "operating_cost", label: "RT service operating cost", type: "cost", amount: opTotal },
    ...levers.map(({ lever, savings }) => ({
      id: lever.id,
      label: lever.label,
      type: "cost_avoidance" as const,
      amount: savings[scenario.savingsLevel],
    })),
  ];

  return {
    scenario,
    revenue: { matrix: occupancyPriceMatrix(values), icuPackage, otherStreams, billingLeakage },
    savings: { levers, totals },
    operatingCost: { lines: operatingCostLines(values), total: opTotal, contributionMargin: margin },
    bridge: buildValueBridge(steps),
    completeness: completeness(values),
    warnings: plausibilityWarnings(values, texts),
  };
}

export type { Quantity } from "./quantity";
