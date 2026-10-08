import { describe, expect, it } from "vitest";
import { WORKBOOK_DEFAULT_SCENARIO } from "@/domain/scenario";
import { isModified, parseScenarioParams, resolveScenario, SCENARIO_PARAM_KEYS, scenarioQuery, type SavedScenario } from "./scenario-params";

const saved = (id: string, isDefault: boolean, occupancyRate = 0.8): SavedScenario => ({
  id,
  name: id,
  isDefault,
  status: "draft",
  approvedAt: null,
  approvedByName: null,
  createdByName: null,
  updatedAt: "2026-10-08T00:00:00Z",
  settings: { ...WORKBOOK_DEFAULT_SCENARIO, occupancyRate },
});

const DEFAULT = saved("11111111-1111-4111-8111-111111111111", true);
const BOARD = saved("22222222-2222-4222-8222-222222222222", false, 0.7);

describe("scenario URL params", () => {
  it("ignores invalid values", () => {
    expect(parseScenarioParams({ occ: "80", price: "-1", level: "max", scenario: "x" })).toEqual({
      scenarioId: undefined,
      occupancyRate: undefined,
      packagePrice: undefined,
      savingsLevel: undefined,
    });
  });

  it("starts from the default scenario and applies overrides", () => {
    const r = resolveScenario(parseScenarioParams({ price: "1200", level: "high" }), [DEFAULT, BOARD]);
    expect(r.base?.id).toBe(DEFAULT.id);
    expect(r.settings).toMatchObject({ occupancyRate: 0.8, packagePrice: 1200, savingsLevel: "high" });
  });

  it("round-trips a selection through the query string", () => {
    const r = resolveScenario({ scenarioId: BOARD.id, packagePrice: 900 }, [DEFAULT, BOARD]);
    const q = scenarioQuery(r.settings, r.base);
    expect(q).toBe(`?scenario=${BOARD.id}&price=900`);
    expect(resolveScenario(parseScenarioParams(new URLSearchParams(q)), [DEFAULT, BOARD]).settings).toEqual(r.settings);
    expect(isModified(r.settings, r.base)).toBe(true);
  });

  it("falls back to the workbook default when no scenarios exist", () => {
    expect(resolveScenario({}, []).settings).toEqual(WORKBOOK_DEFAULT_SCENARIO);
  });
});

describe("scenario parameter keys", () => {
  it("lists exactly the keys scenarioQuery writes", () => {
    const q = new URLSearchParams(scenarioQuery({ ...BOARD.settings, packagePrice: 1, occupancyRate: 0.5, savingsLevel: "low" }, BOARD));
    expect([...q.keys()].sort()).toEqual([...SCENARIO_PARAM_KEYS].sort());
  });
});
