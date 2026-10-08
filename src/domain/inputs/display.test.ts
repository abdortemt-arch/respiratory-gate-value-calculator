import { describe, expect, it } from "vitest";
import { getInputDefinition } from "./catalog";
import { formatInputValue, missingLabel, toEditableText } from "./display";
import { parseInputText } from "../calculations/validation";

describe("input display", () => {
  it("labels blank inputs by what they block", () => {
    expect(missingLabel(getInputDefinition("oxygen_spend"))).toBe("Baseline required");
    expect(missingLabel(getInputDefinition("collection_rate"))).toBe("Baseline required");
    expect(missingLabel(getInputDefinition("opcost_rt_salaries"))).toBe("Data required");
    expect(missingLabel(getInputDefinition("filters_used"))).toBe("Not provided");
  });

  it("never renders unknown as zero", () => {
    expect(formatInputValue(getInputDefinition("oxygen_spend"), null)).toBe("Baseline required");
    expect(formatInputValue(getInputDefinition("oxygen_spend"), 0)).toBe("EGP 0");
  });

  it("round-trips percentages through the edit box", () => {
    const def = getInputDefinition("collection_rate");
    expect(toEditableText(def, 0.85)).toBe("85");
    expect(parseInputText(def, toEditableText(def, 0.07))).toEqual({ ok: true, value: 0.07 });
    expect(formatInputValue(def, 0.85)).toBe("85%");
  });
});
