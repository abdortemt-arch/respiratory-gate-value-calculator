/**
 * Scenario selection (workbook Value Bridge C4:C6) and savings sensitivities
 * (Savings Scenarios D5:F5).
 */

export const SAVINGS_LEVELS = ["low", "mid", "high"] as const;
export type SavingsLevel = (typeof SAVINGS_LEVELS)[number];

export const SAVINGS_LEVEL_LABELS: Record<SavingsLevel, string> = { low: "Low", mid: "Mid", high: "High" };

export type SavingsSensitivities = Record<SavingsLevel, number>;

export interface ScenarioSettings {
  /** Fraction, e.g. 0.8 */
  readonly occupancyRate: number;
  /** EGP per occupied ICU respiratory patient-day */
  readonly packagePrice: number;
  readonly savingsLevel: SavingsLevel;
  readonly sensitivities: SavingsSensitivities;
}

/** The workbook as delivered: 80% / EGP 1,000 / Mid, 5% / 10% / 15%. */
export const WORKBOOK_DEFAULT_SCENARIO: ScenarioSettings = {
  occupancyRate: 0.8,
  packagePrice: 1000,
  savingsLevel: "mid",
  sensitivities: { low: 0.05, mid: 0.1, high: 0.15 },
};

export function isSavingsLevel(value: unknown): value is SavingsLevel {
  return typeof value === "string" && (SAVINGS_LEVELS as readonly string[]).includes(value);
}
