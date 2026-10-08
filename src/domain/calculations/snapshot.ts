/**
 * Frozen record of an approved scenario: the inputs, settings and headline
 * results at approval time, so approved figures cannot drift silently.
 */
import type { InputValues } from "../inputs/catalog";
import type { ScenarioSettings } from "../scenario";
import type { ModelResult } from "./index";
import type { Quantity } from "./quantity";

export interface SnapshotFigure {
  readonly kind: Quantity["kind"];
  readonly value: number | null;
  readonly label: string | null;
}

export interface ScenarioSnapshot {
  readonly version: 1;
  readonly capturedAt: string;
  readonly settings: ScenarioSettings;
  readonly inputs: InputValues;
  readonly figures: {
    readonly icuPackageAnnual: SnapshotFigure;
    readonly billingLeakage: SnapshotFigure;
    readonly savingsSelected: SnapshotFigure;
    readonly operatingCost: SnapshotFigure;
    readonly contributionMargin: SnapshotFigure;
    readonly netServiceLineValue: SnapshotFigure;
    readonly grossRevenue: number;
    readonly costAvoidance: number;
  };
  readonly modelInputsEntered: { readonly entered: number; readonly total: number };
}

function figure(q: Quantity): SnapshotFigure {
  return q.kind === "missing" ? { kind: q.kind, value: null, label: q.label } : { kind: q.kind, value: q.value, label: null };
}

export function buildScenarioSnapshot(
  inputs: InputValues,
  settings: ScenarioSettings,
  model: ModelResult,
  capturedAt: string,
): ScenarioSnapshot {
  return {
    version: 1,
    capturedAt,
    settings,
    inputs,
    figures: {
      icuPackageAnnual: figure(model.revenue.icuPackage.annual),
      billingLeakage: figure(model.revenue.billingLeakage),
      savingsSelected: figure(model.savings.totals.byLevel[settings.savingsLevel]),
      operatingCost: figure(model.operatingCost.total),
      contributionMargin: figure(model.operatingCost.contributionMargin),
      netServiceLineValue: figure(model.bridge.net),
      grossRevenue: model.bridge.grossRevenue.value,
      costAvoidance: model.bridge.costAvoidance.value,
    },
    modelInputsEntered: { entered: model.completeness.model.entered, total: model.completeness.model.total },
  };
}
