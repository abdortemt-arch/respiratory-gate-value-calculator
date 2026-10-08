/**
 * RT service operating cost and ICU package contribution margin.
 * Workbook: Revenue!B45:B56.
 */
import { getInputDefinition, OPERATING_COST_KEYS, type InputKey, type InputValues } from "../inputs/catalog";
import { STATUS_LABELS } from "../copy/statusLabels";
import { formatEgp } from "../format";
import { hasValue, missing, missingInputs, partial, unique, type Quantity } from "./quantity";

export interface OperatingCostLine {
  readonly key: InputKey;
  readonly label: string;
  readonly value: number | null;
}

export function operatingCostLines(values: InputValues): OperatingCostLine[] {
  return OPERATING_COST_KEYS.map((key) => ({ key, label: getInputDefinition(key).label, value: values[key] }));
}

/**
 * Revenue!B55 = IF(COUNT(B45:B54)=0,"Elite data required",SUM(B45:B54)).
 * Blank lines are excluded from the sum, so a subset is reported as partial
 * ("Provisional — n of 10 lines"), never as a complete cost (formula map F4).
 */
export function totalOperatingCost(values: InputValues): Quantity {
  const lines = operatingCostLines(values);
  const entered = lines.filter((l) => l.value !== null);
  const absent = lines.filter((l) => l.value === null).map((l) => l.key);
  if (entered.length === 0) return missing(STATUS_LABELS.dataRequired, absent);
  const value = entered.reduce((sum, l) => sum + (l.value as number), 0);
  return partial(
    value,
    `Sum of ${entered.length} of ${lines.length} operating cost lines = ${formatEgp(value)}`,
    entered.map((l) => l.key),
    absent,
  );
}

/**
 * Revenue!B56 = IF(ISNUMBER(B55), B44-B55, "Elite data required").
 * ICU package gross minus RT operating cost. Distinct from the net
 * service-line value (formula map F12).
 */
export function contributionMargin(icuPackageAnnual: Quantity, operatingCost: Quantity): Quantity {
  if (!hasValue(operatingCost)) return missing(STATUS_LABELS.dataRequired, operatingCost.required);
  if (!hasValue(icuPackageAnnual)) return missing(STATUS_LABELS.dataRequired, icuPackageAnnual.required);
  const value = icuPackageAnnual.value - operatingCost.value;
  return partial(
    value,
    `ICU package gross ${formatEgp(icuPackageAnnual.value)} − RT operating cost ${formatEgp(operatingCost.value)}`,
    unique([...icuPackageAnnual.inputs, ...operatingCost.inputs]),
    unique([...missingInputs(icuPackageAnnual), ...missingInputs(operatingCost)]),
  );
}
