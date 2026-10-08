/**
 * User-facing status wording, preserved from the workbook (formula map F11).
 * The workbook's "Elite data required" is generalised to "Data required".
 */
export const STATUS_LABELS = {
  baselineRequired: "Baseline required",
  dataRequired: "Data required",
  scenarioPending: "Scenario pending",
  toBeQuantified: "To be quantified",
} as const;

export type StatusLabel = (typeof STATUS_LABELS)[keyof typeof STATUS_LABELS];

/** Value Bridge step status column (workbook D10:D21). */
export const BRIDGE_STEP_STATUS = {
  calculated: "Calculated",
  excluded: "Not yet quantified — excluded",
} as const;

export type BridgeStepStatus = (typeof BRIDGE_STEP_STATUS)[keyof typeof BRIDGE_STEP_STATUS];
