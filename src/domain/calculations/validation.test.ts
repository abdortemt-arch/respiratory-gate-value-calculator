import { describe, expect, it } from "vitest";
import { defaultInputValues, getInputDefinition } from "../inputs/catalog";
import { WORKBOOK_DEFAULT_SCENARIO } from "../scenario";
import { parseInputText, plausibilityWarnings, validateScenario, validateValue } from "./validation";

const def = getInputDefinition;

describe("parseInputText", () => {
  it("treats empty hospital inputs as unknown (null), never 0", () => {
    expect(parseInputText(def("oxygen_spend"), "  ")).toEqual({ ok: true, value: null });
  });

  it("refuses to blank a Respiratory Gate assumption", () => {
    expect(parseInputText(def("days_per_year"), "")).toMatchObject({ ok: false });
  });

  it("accepts grouping, EGP prefix and decimals for currency", () => {
    expect(parseInputText(def("oxygen_spend"), "EGP 1,200,000.50")).toEqual({ ok: true, value: 1_200_000.5 });
  });

  it("stores percentages as fractions", () => {
    expect(parseInputText(def("collection_rate"), "85")).toEqual({ ok: true, value: 0.85 });
    expect(parseInputText(def("collection_rate"), "85%")).toEqual({ ok: true, value: 0.85 });
    expect(parseInputText(def("collection_rate"), "7")).toEqual({ ok: true, value: 0.07 });
  });

  it("rejects text, negatives, fractions of counts and percentages over 100", () => {
    expect(parseInputText(def("oxygen_spend"), "n/a").ok).toBe(false);
    expect(parseInputText(def("oxygen_spend"), "-5").ok).toBe(false);
    expect(parseInputText(def("ventilated_patient_days"), "4.5").ok).toBe(false);
    expect(parseInputText(def("collection_rate"), "120").ok).toBe(false);
    expect(parseInputText(def("oxygen_spend"), "1.234").ok).toBe(false);
  });

  it("enforces assumption bounds", () => {
    expect(parseInputText(def("days_per_month"), "35").ok).toBe(false);
    expect(parseInputText(def("price_scenario_1"), "0").ok).toBe(false);
    expect(parseInputText(def("occupancy_scenario_1"), "0").ok).toBe(false);
    expect(parseInputText(def("icu_beds"), "0").ok).toBe(false);
  });
});

describe("validateValue", () => {
  it("accepts null for hospital data and valid numbers", () => {
    expect(validateValue(def("cost_per_niv_day"), null)).toBeNull();
    expect(validateValue(def("cost_per_niv_day"), 900)).toBeNull();
  });
});

describe("plausibilityWarnings", () => {
  it("flags ventilated days above available ICU bed-days", () => {
    const values = { ...defaultInputValues(), ventilated_patient_days: 20_000 };
    expect(plausibilityWarnings(values)[0].keys).toContain("ventilated_patient_days");
  });

  it("asks for the oxygen consumption unit", () => {
    const values = { ...defaultInputValues(), oxygen_consumption: 250_000 };
    expect(plausibilityWarnings(values)).toHaveLength(1);
    expect(plausibilityWarnings(values, { oxygen_consumption: "m³" })).toHaveLength(0);
  });
});

describe("validateScenario", () => {
  it("accepts the workbook default", () => {
    expect(validateScenario(WORKBOOK_DEFAULT_SCENARIO)).toEqual([]);
  });

  it("rejects occupancy above 100% and non-positive prices", () => {
    expect(validateScenario({ ...WORKBOOK_DEFAULT_SCENARIO, occupancyRate: 80 })).toHaveLength(1);
    expect(validateScenario({ ...WORKBOOK_DEFAULT_SCENARIO, packagePrice: 0 })).toHaveLength(1);
  });
});
