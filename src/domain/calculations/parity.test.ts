/**
 * Workbook parity: replays every scenario in tests/fixtures/workbook-parity.json
 * (LibreOffice-recalculated workbook results) through calculateModel and
 * compares all 132 formula cells.
 *
 * The engine result is projected back onto workbook cells, including the
 * workbook's own text statuses. The only deliberate deviation (D1: blank ICU
 * beds) is projected the way the workbook computes it and asserted separately.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  defaultInputValues,
  INPUT_DEFINITIONS,
  OCCUPANCY_SCENARIO_KEYS,
  PRICE_SCENARIO_KEYS,
  type InputKey,
  type InputValues,
} from "../inputs/catalog";
import { WORKBOOK_DEFAULT_SCENARIO, type SavingsLevel, type ScenarioSettings } from "../scenario";
import { calculateModel, type ModelResult } from "./index";
import { hasValue, type Quantity } from "./quantity";

type CellValue = number | string;

interface FixtureScenario {
  id: string;
  description: string;
  cells: Record<string, number | string | null>;
  expected: Record<string, CellValue>;
}

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../tests/fixtures/workbook-parity.json", import.meta.url)), "utf8"),
) as { workbookSha256: string; scenarios: FixtureScenario[] };

const CELL_TO_KEY = new Map<string, InputKey>(INPUT_DEFINITIONS.map((d) => [d.workbookCell, d.key as InputKey]));

/** Apply the fixture's changed cells on top of the workbook as delivered. */
function loadScenario(cells: FixtureScenario["cells"]): { values: InputValues; scenario: ScenarioSettings } {
  const values = defaultInputValues();
  const sensitivities = { ...WORKBOOK_DEFAULT_SCENARIO.sensitivities };
  let { occupancyRate, packagePrice, savingsLevel } = WORKBOOK_DEFAULT_SCENARIO;

  for (const [cell, value] of Object.entries(cells)) {
    const key = CELL_TO_KEY.get(cell);
    if (key) {
      values[key] = value as number | null;
      continue;
    }
    switch (cell) {
      case "Savings Scenarios!D5":
        sensitivities.low = value as number;
        break;
      case "Savings Scenarios!E5":
        sensitivities.mid = value as number;
        break;
      case "Savings Scenarios!F5":
        sensitivities.high = value as number;
        break;
      case "Value Bridge!C4":
        occupancyRate = value as number;
        break;
      case "Value Bridge!C5":
        packagePrice = value as number;
        break;
      case "Value Bridge!C6":
        savingsLevel = String(value).toLowerCase() as SavingsLevel;
        break;
      default:
        throw new Error(`Fixture changes unmapped cell ${cell}`);
    }
  }
  return { values, scenario: { occupancyRate, packagePrice, savingsLevel, sensitivities } };
}

const orText = (q: Quantity, text: string): CellValue => (hasValue(q) ? q.value : text);

/**
 * Render the engine result in workbook terms. D1: where the engine reports
 * "Data required" because ICU beds is blank, the workbook computes with 0.
 */
function projectToWorkbook(result: ModelResult, values: InputValues): Record<string, CellValue> {
  const out: Record<string, CellValue> = {};
  const bedsBlank = values.icu_beds === null;

  // Savings Scenarios
  const columns: [string, SavingsLevel][] = [
    ["D", "low"],
    ["E", "mid"],
    ["F", "high"],
  ];
  result.savings.levers.forEach((lever, i) => {
    const row = 8 + i;
    out[`Savings Scenarios!C${row}`] = orText(lever.baseline, "");
    for (const [col, level] of columns) out[`Savings Scenarios!${col}${row}`] = orText(lever.savings[level], "Baseline required");
  });
  out["Savings Scenarios!C14"] = orText(result.savings.totals.baseline, "Baseline required");
  for (const [col, level] of columns) {
    out[`Savings Scenarios!${col}14`] = orText(result.savings.totals.byLevel[level], "Baseline required");
  }

  // Revenue matrix (three blocks: daily, monthly, annual)
  const matrix = result.revenue.matrix;
  if (matrix.kind === "missing") expect(bedsBlank, "matrix may only be missing because of blank ICU beds (D1)").toBe(true);
  out["Revenue!B4"] = values.icu_beds ?? 0;
  const blocks = [
    { header: 17, first: 18, period: "daily" },
    { header: 24, first: 25, period: "monthly" },
    { header: 31, first: 32, period: "annual" },
  ] as const;
  for (const block of blocks) {
    PRICE_SCENARIO_KEYS.forEach((key, c) => (out[`Revenue!${"CDE"[c]}${block.header}`] = values[key] ?? 0));
    OCCUPANCY_SCENARIO_KEYS.forEach((key, r) => {
      const row = block.first + r;
      out[`Revenue!A${row}`] = values[key] ?? 0;
      if (matrix.kind === "ready") {
        const data = matrix.rows[r];
        out[`Revenue!B${row}`] = data.occupiedBeds;
        data[block.period].forEach((v, c) => (out[`Revenue!${"CDE"[c]}${row}`] = v));
      } else {
        out[`Revenue!B${row}`] = 0;
        PRICE_SCENARIO_KEYS.forEach((_, c) => (out[`Revenue!${"CDE"[c]}${row}`] = 0));
      }
    });
  }

  // Other streams, contribution margin
  result.revenue.otherStreams.forEach(({ gross }, i) => (out[`Revenue!D${39 + i}`] = orText(gross, "Scenario pending")));
  const icuAnnual = result.revenue.icuPackage.annual;
  if (!hasValue(icuAnnual)) expect(bedsBlank, "ICU package may only be missing because of blank ICU beds (D1)").toBe(true);
  const icuWorkbook = hasValue(icuAnnual) ? icuAnnual.value : 0;
  out["Revenue!B44"] = icuWorkbook;
  const opTotal = result.operatingCost.total;
  out["Revenue!B55"] = orText(opTotal, "Elite data required");
  out["Revenue!B56"] = hasValue(opTotal) ? icuWorkbook - opTotal.value : "Elite data required";

  // Value Bridge
  const stepRow: Record<string, number> = {
    icu_package: 10,
    pft: 11,
    education: 12,
    future_programs: 13,
    billing_leakage: 14,
    operating_cost: 15,
    ventilator_resources: 16,
    niv_hfnc_utilization: 17,
    oxygen_stewardship: 18,
    consumable_standardization: 19,
    equipment_utilization: 20,
    staffing_outsourcing: 21,
  };
  for (const step of result.bridge.steps) {
    const row = stepRow[step.id];
    let value: CellValue;
    if (step.id === "icu_package") value = icuWorkbook;
    else if (step.type === "cost") value = hasValue(step.amount) ? -step.amount.value : "Elite data required";
    else value = orText(step.amount, step.amount.kind === "missing" ? step.amount.label : "");
    out[`Value Bridge!C${row}`] = value;
    out[`Value Bridge!D${row}`] = typeof value === "number" ? "Calculated" : "Not yet quantified — excluded";
  }
  out["Value Bridge!C23"] = result.bridge.grossRevenue.value;
  out["Value Bridge!C24"] = result.bridge.costAvoidance.value;
  out["Value Bridge!C25"] = -result.bridge.operatingCost.value;
  out["Value Bridge!C26"] = orText(result.bridge.net, "To be quantified");
  return out;
}

function close(actual: CellValue, expected: CellValue): boolean {
  if (typeof expected === "number" && typeof actual === "number") {
    return Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected));
  }
  return actual === expected;
}

describe("workbook parity", () => {
  it("covers the expected number of scenarios and formula cells", () => {
    expect(fixture.scenarios.length).toBeGreaterThanOrEqual(10);
    for (const s of fixture.scenarios) expect(Object.keys(s.expected)).toHaveLength(132);
  });

  describe.each(fixture.scenarios.map((s) => [s.id, s] as const))("%s", (_id, scenario) => {
    const { values, scenario: settings } = loadScenario(scenario.cells);
    const result = calculateModel(values, settings);
    const projected = projectToWorkbook(result, values);

    it("projects onto exactly the workbook's formula cells", () => {
      expect(Object.keys(projected).sort()).toEqual(Object.keys(scenario.expected).sort());
    });

    it("matches every formula cell", () => {
      const mismatches = Object.entries(scenario.expected)
        .filter(([cell, expected]) => !close(projected[cell], expected))
        .map(([cell, expected]) => `${cell}: workbook ${JSON.stringify(expected)}, engine ${JSON.stringify(projected[cell])}`);
      expect(mismatches).toEqual([]);
    });
  });
});

describe("deliberate deviation D1: blank ICU beds", () => {
  const scenario = fixture.scenarios.find((s) => s.id === "icu-beds-blank");
  if (!scenario) throw new Error("fixture icu-beds-blank missing");
  const { values, scenario: settings } = loadScenario(scenario.cells);
  const result = calculateModel(values, settings);

  it("the workbook reports a calculated zero", () => {
    expect(scenario.expected["Value Bridge!C10"]).toBe(0);
    expect(scenario.expected["Value Bridge!D10"]).toBe("Calculated");
  });

  it("the engine reports Data required instead of a fake zero", () => {
    const annual = result.revenue.icuPackage.annual;
    expect(annual).toEqual({ kind: "missing", label: "Data required", required: ["icu_beds"] });
    expect(result.revenue.matrix.kind).toBe("missing");
    expect(result.bridge.grossRevenue.excluded).toContain("icu_package");
  });
});
