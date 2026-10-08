import { describe, expect, it } from "vitest";
import { formatEgp, formatEgpCompact, formatNumber, formatPercent } from "./format";

describe("format", () => {
  it("formats EGP in full and compact form", () => {
    expect(formatEgp(14_600_000)).toBe("EGP 14,600,000");
    expect(formatEgp(-1_140_000)).toBe("−EGP 1,140,000");
    expect(formatEgpCompact(14_600_000)).toBe("EGP 14.6M");
    expect(formatEgpCompact(1_041_250)).toBe("EGP 1.04M");
    expect(formatEgpCompact(850_000)).toBe("EGP 850K");
    expect(formatEgpCompact(1_000)).toBe("EGP 1,000");
  });

  it("formats percentages and numbers", () => {
    expect(formatPercent(0.8)).toBe("80%");
    expect(formatPercent(0.625)).toBe("62.5%");
    expect(formatNumber(24.75)).toBe("24.75");
    expect(formatNumber(4200)).toBe("4,200");
  });
});
