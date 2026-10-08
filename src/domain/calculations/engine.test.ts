import { describe, expect, it } from "vitest";
import { defaultInputValues, type InputValues } from "../inputs/catalog";
import { WORKBOOK_DEFAULT_SCENARIO, type ScenarioSettings } from "../scenario";
import { calculateModel } from "./index";
import { hasValue } from "./quantity";

const base = (overrides: Partial<InputValues> = {}): InputValues => ({ ...defaultInputValues(), ...overrides });
const scenario = (overrides: Partial<ScenarioSettings> = {}): ScenarioSettings => ({
  ...WORKBOOK_DEFAULT_SCENARIO,
  ...overrides,
});

describe("ICU package revenue", () => {
  it("reproduces the workbook check: 50 beds × 80% × EGP 1,000 × 365 = EGP 14.6M", () => {
    const q = calculateModel(base(), scenario()).revenue.icuPackage.annual;
    expect(q).toMatchObject({
      kind: "calculated",
      value: 14_600_000,
      basis: "50 beds × 80% occupancy × EGP 1,000 × 365 days",
    });
  });

  it("gives daily and 30-day monthly views (monthly × 12 ≠ annual, by design)", () => {
    const { daily, monthly, annual } = calculateModel(base(), scenario()).revenue.icuPackage;
    expect(hasValue(daily) && daily.value).toBe(40_000);
    expect(hasValue(monthly) && monthly.value).toBe(1_200_000);
    expect(hasValue(monthly) && hasValue(annual) && monthly.value * 12).not.toBe(hasValue(annual) && annual.value);
  });

  it("keeps fractional occupied beds unrounded", () => {
    const matrix = calculateModel(base({ icu_beds: 45, occupancy_scenario_1: 0.55 }), scenario()).revenue.matrix;
    expect(matrix.kind === "ready" && matrix.rows[0].occupiedBeds).toBeCloseTo(24.75, 12);
  });
});

describe("savings levers", () => {
  it("as delivered, every lever needs a baseline and the total is not quantified", () => {
    const { levers, totals } = calculateModel(base(), scenario()).savings;
    for (const l of levers) expect(l.baseline.kind).toBe("missing");
    expect(totals.byLevel.mid).toMatchObject({ kind: "missing", label: "Baseline required" });
  });

  it("names the required input for a missing lever", () => {
    const oxygen = calculateModel(base(), scenario()).savings.levers.find((l) => l.lever.id === "oxygen_stewardship");
    expect(oxygen?.savings.mid).toEqual({ kind: "missing", label: "Baseline required", required: ["oxygen_spend"] });
  });

  it("flags NIV/HFNC as partial when one pair is incomplete", () => {
    const values = base({ niv_patient_days: 1800, cost_per_niv_day: 900, hfnc_patient_days: 1500 });
    const lever = calculateModel(values, scenario()).savings.levers.find((l) => l.lever.id === "niv_hfnc_utilization");
    expect(lever?.baseline).toMatchObject({ kind: "partial", value: 1_620_000, missing: ["cost_per_hfnc_day"] });
    expect(lever?.savings.high).toMatchObject({ kind: "partial", value: 243_000 });
  });

  it("treats explicit zeros as data, not as missing", () => {
    const values = base({ ventilated_patient_days: 0, cost_per_ventilator_day: 2500, oxygen_spend: 0 });
    const levers = calculateModel(values, scenario()).savings.levers;
    expect(levers[0].savings.mid).toMatchObject({ kind: "calculated", value: 0 });
    expect(levers[2].savings.mid).toMatchObject({ kind: "calculated", value: 0 });
  });

  it("sums only quantified levers and marks the total partial", () => {
    const values = base({ oxygen_spend: 3_000_000, respiratory_consumable_spend: 4_500_000 });
    const total = calculateModel(values, scenario()).savings.totals.byLevel.mid;
    expect(total.kind).toBe("partial");
    expect(hasValue(total) && total.value).toBeCloseTo(750_000, 6);
    expect(hasValue(total) && total.basis).toContain("2 of 6 levers, undeduplicated");
  });
});

describe("operating cost, margin and net value", () => {
  it("does not show a net value until operating cost is entered", () => {
    const bridge = calculateModel(base(), scenario()).bridge;
    expect(bridge.net).toMatchObject({ kind: "missing", label: "To be quantified" });
    expect(bridge.grossRevenue.value).toBe(14_600_000);
  });

  it("reports a provisional (partial) net value when only some cost lines are entered", () => {
    const result = calculateModel(base({ opcost_rt_salaries: 4_800_000 }), scenario());
    expect(result.operatingCost.total).toMatchObject({ kind: "partial", value: 4_800_000 });
    expect(result.operatingCost.total.kind === "partial" && result.operatingCost.total.missing).toHaveLength(9);
    expect(result.bridge.net).toMatchObject({ kind: "partial", value: 9_800_000 });
    expect(result.operatingCost.contributionMargin).toMatchObject({ kind: "partial", value: 9_800_000 });
  });

  it("calculates a complete net value when all ten cost lines are entered (zeros allowed)", () => {
    const opcost = {
      opcost_rt_salaries: 4_800_000,
      opcost_supervisor_salaries: 1_200_000,
      opcost_clinical_education: 300_000,
      opcost_consumables_incremental: 900_000,
      opcost_equipment_depreciation: 1_100_000,
      opcost_maintenance: 400_000,
      opcost_documentation_technology: 250_000,
      opcost_training: 200_000,
      opcost_admin_overhead: 600_000,
      opcost_supply_chain_logistics: 0,
    };
    const result = calculateModel(base({ ...opcost, oxygen_spend: 3_000_000 }), scenario());
    expect(result.operatingCost.total).toMatchObject({ kind: "calculated", value: 9_750_000 });
    expect(result.bridge.net).toMatchObject({ kind: "calculated", value: 14_600_000 + 300_000 - 9_750_000 });
    expect(result.operatingCost.contributionMargin).toMatchObject({ kind: "calculated", value: 4_850_000 });
  });

  it("counts billing leakage recovery as revenue, not savings", () => {
    const values = base({
      unbilled_eligible_respiratory_activities: 3500,
      avg_tariff_per_respiratory_activity: 350,
      collection_rate: 0.85,
    });
    const bridge = calculateModel(values, scenario()).bridge;
    const step = bridge.steps.find((s) => s.id === "billing_leakage");
    expect(step?.type).toBe("revenue");
    expect(bridge.grossRevenue.value).toBeCloseTo(14_600_000 + 1_041_250, 6);
    expect(bridge.costAvoidance.value).toBe(0);
  });

  it("uses the selected savings level in the bridge", () => {
    const values = base({ oxygen_spend: 1_000_000 });
    expect(calculateModel(values, scenario({ savingsLevel: "low" })).bridge.costAvoidance.value).toBeCloseTo(50_000, 6);
    expect(calculateModel(values, scenario({ savingsLevel: "high" })).bridge.costAvoidance.value).toBeCloseTo(150_000, 6);
  });

  it("lists excluded steps instead of counting them as zero", () => {
    const bridge = calculateModel(base(), scenario()).bridge;
    expect(bridge.grossRevenue.excluded).toEqual(["pft", "education", "future_programs", "billing_leakage"]);
    expect(bridge.steps.find((s) => s.id === "pft")?.status).toBe("Not yet quantified — excluded");
  });
});

describe("other revenue streams", () => {
  it("stay 'Scenario pending' until both volume and price are entered", () => {
    const streams = calculateModel(base({ pft_annual_tests: 1200 }), scenario()).revenue.otherStreams;
    expect(streams[0].gross).toEqual({ kind: "missing", label: "Scenario pending", required: ["pft_price_per_test"] });
  });
});

describe("completeness", () => {
  it("as delivered: 1 of 34 model inputs and 1 of 46 requested inputs", () => {
    const c = calculateModel(base(), scenario()).completeness;
    expect(c.model).toMatchObject({ entered: 1, total: 34 });
    expect(c.all).toMatchObject({ entered: 1, total: 46 });
    expect(c.byGroup.operating_cost).toMatchObject({ entered: 0, total: 10 });
  });
});
