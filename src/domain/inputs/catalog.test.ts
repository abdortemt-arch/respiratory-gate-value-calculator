import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defaultInputValues, INPUT_DEFINITIONS } from "./catalog";

const formulaMap = readFileSync(fileURLToPath(new URL("../../../docs/excel-formula-map.md", import.meta.url)), "utf8");

describe("input catalog", () => {
  it("has 46 hospital inputs and 9 Respiratory Gate assumptions", () => {
    expect(INPUT_DEFINITIONS.filter((d) => d.source !== "rg_assumption")).toHaveLength(46);
    expect(INPUT_DEFINITIONS.filter((d) => d.source === "rg_assumption")).toHaveLength(9);
  });

  it("uses unique keys and unique workbook cells", () => {
    expect(new Set(INPUT_DEFINITIONS.map((d) => d.key)).size).toBe(INPUT_DEFINITIONS.length);
    expect(new Set(INPUT_DEFINITIONS.map((d) => d.workbookCell)).size).toBe(INPUT_DEFINITIONS.length);
  });

  it("documents every key in docs/excel-formula-map.md", () => {
    const undocumented = INPUT_DEFINITIONS.filter((d) => {
      // Scenario grids are documented as ranges: `occupancy_scenario_1..4`, `price_scenario_1..3`.
      const documented = d.key.replace(/_scenario_\d$/, "_scenario_1..");
      return !formulaMap.includes(`\`${d.key}\``) && !formulaMap.includes(`\`${documented}`);
    });
    expect(undocumented.map((d) => d.key)).toEqual([]);
  });

  it("never seeds invented hospital data: only ICU beds (verified public source) has a value", () => {
    const seeded = INPUT_DEFINITIONS.filter((d) => d.source !== "rg_assumption" && d.defaultValue !== null);
    expect(seeded.map((d) => [d.key, d.source, d.defaultValue])).toEqual([["icu_beds", "verified_public", 50]]);
  });

  it("defaults reproduce the delivered workbook assumptions", () => {
    const v = defaultInputValues();
    expect([v.days_per_month, v.days_per_year]).toEqual([30, 365]);
    expect([v.occupancy_scenario_1, v.occupancy_scenario_2, v.occupancy_scenario_3, v.occupancy_scenario_4]).toEqual([
      0.6, 0.7, 0.8, 0.9,
    ]);
    expect([v.price_scenario_1, v.price_scenario_2, v.price_scenario_3]).toEqual([800, 1000, 1200]);
  });
});
