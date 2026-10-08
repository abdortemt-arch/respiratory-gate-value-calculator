import { describe, expect, it } from "vitest";
import { aggregate } from "./aggregate";
import { compareSummaries } from "./compare";
import { quarterMonths, ytdMonths } from "./month";
import { calculatePeriod, type FinancialSummary } from "./period";
import type { CostItemConfig, CostVersion, HospitalConfig, PeriodInput, PriceVersion } from "./types";
import { explainVariance } from "./variance";
import { timeline, versionFor } from "./versions";

// ── synthetic test hospitals (not real data) ─────────────────────────────────
const NIV = "svc-niv"; // library service id shared by all hospitals
const HFNC = "svc-hfnc";

const price = (id: string, hospitalServiceId: string, amount: number, effectiveFrom: string, extra: Partial<PriceVersion> = {}): PriceVersion => ({
  id,
  hospitalServiceId,
  amount,
  currency: "EGP",
  billingUnit: "per_case",
  effectiveFrom,
  notes: null,
  voided: false,
  ...extra,
});

function hospitalA(extraPrices: PriceVersion[] = []): HospitalConfig {
  return {
    id: "hosp-a",
    name: "Hospital A",
    code: "HA",
    totalBeds: 200,
    currency: "EGP",
    departments: [
      { id: "a-aicu", name: "AICU", category: "adult_icu", beds: 12, rtCoverage: true, active: true },
      { id: "a-picu", name: "PICU", category: "picu", beds: 8, rtCoverage: true, active: true },
    ],
    services: [
      { id: "a-niv", serviceId: NIV, name: "NIV", category: "ventilation", active: true, departmentIds: ["a-aicu", "a-picu"] },
      { id: "a-hfnc", serviceId: HFNC, name: "HFNC", category: "oxygen_therapy", active: true, departmentIds: ["a-aicu"] },
    ],
    priceVersions: [
      price("p1", "a-niv", 1500, "2026-01"),
      price("p2", "a-niv", 1800, "2026-02"),
      price("p3", "a-niv", 1600, "2026-03"),
      ...extraPrices,
    ],
    costItems: [],
    costVersions: [],
  };
}

const period = (month: string, nivAicu: number | null, nivPicu: number | null, extra: Partial<PeriodInput> = {}): PeriodInput => ({
  id: `per-${month}`,
  month,
  status: "draft",
  activity: [
    { hospitalServiceId: "a-niv", departmentId: "a-aicu", quantity: nivAicu },
    { hospitalServiceId: "a-niv", departmentId: "a-picu", quantity: nivPicu },
  ],
  stats: [],
  costEntries: [],
  savings: [],
  ...extra,
});

const niv = (s: FinancialSummary) => s.services.find((x) => x.serviceId === NIV)!;

describe("acceptance: effective-dated NIV pricing for Hospital A", () => {
  const jan = period("2026-01", 60, 40); // 100 cases
  const feb = period("2026-02", 50, 50); // 100 cases
  const mar = period("2026-03", 70, 50); // 120 cases

  it("January: 100 × EGP 1,500 = EGP 150,000", () => {
    const r = niv(calculatePeriod(hospitalA(), jan));
    expect(r).toMatchObject({ price: 1500, priceEffectiveFrom: "2026-01", volume: 100 });
    expect(r.revenue.value).toBe(150_000);
  });

  it("February: 100 × EGP 1,800 = EGP 180,000", () => {
    expect(niv(calculatePeriod(hospitalA(), feb)).revenue.value).toBe(180_000);
  });

  it("March: 120 × EGP 1,600 = EGP 192,000", () => {
    expect(niv(calculatePeriod(hospitalA(), mar)).revenue.value).toBe(192_000);
  });

  it("changing the current price later never changes January–March", () => {
    const changed = hospitalA([price("p4", "a-niv", 2000, "2026-10")]);
    expect(niv(calculatePeriod(changed, jan)).revenue.value).toBe(150_000);
    expect(niv(calculatePeriod(changed, feb)).revenue.value).toBe(180_000);
    expect(niv(calculatePeriod(changed, mar)).revenue.value).toBe(192_000);
    // ...while a later month uses the new price.
    expect(niv(calculatePeriod(changed, period("2026-10", 10, 10))).revenue.value).toBe(40_000);
  });

  it("a voided (corrected) version is ignored and history stays derivable", () => {
    const corrected = hospitalA([price("p2b", "a-niv", 9999, "2026-02", { voided: true, voidReason: "typo" })]);
    expect(niv(calculatePeriod(corrected, feb)).revenue.value).toBe(180_000);
  });

  it("Hospital B can price NIV differently in the same period", () => {
    const b: HospitalConfig = {
      ...hospitalA(),
      id: "hosp-b",
      name: "Hospital B",
      code: "HB",
      departments: [{ id: "b-icu", name: "ICU", category: "adult_icu", beds: 20, rtCoverage: true, active: true }],
      services: [{ id: "b-niv", serviceId: NIV, name: "NIV", category: "ventilation", active: true, departmentIds: ["b-icu"] }],
      priceVersions: [price("pb1", "b-niv", 2400, "2026-01")],
    };
    const bJan: PeriodInput = { ...jan, id: "b-jan", activity: [{ hospitalServiceId: "b-niv", departmentId: "b-icu", quantity: 100 }] };
    const ra = calculatePeriod(hospitalA(), jan);
    const rb = calculatePeriod(b, bJan);
    expect(niv(ra).price).toBe(1500);
    expect(niv(rb).price).toBe(2400);
    expect(niv(rb).revenue.value).toBe(240_000);
    const variance = explainVariance(ra, rb);
    expect(variance.drivers.find((d) => d.kind === "service_price")).toMatchObject({ subject: "NIV", effect: 90_000 });
  });

  it("explains February → March: +20 cases and a lower price", () => {
    const v = explainVariance(calculatePeriod(hospitalA(), feb), calculatePeriod(hospitalA(), mar));
    expect(v.drivers).toEqual([
      expect.objectContaining({ kind: "service_volume", subject: "NIV", effect: 36_000, from: 100, to: 120 }),
      expect.objectContaining({ kind: "service_price", subject: "NIV", effect: -24_000, from: 1800, to: 1600 }),
    ]);
    const sum = v.drivers.reduce((s, d) => s + d.effect, 0);
    expect(sum).toBe(12_000); // = 192,000 − 180,000
  });

  it("Q1 sums each month at its own price (average realised price shown)", () => {
    const config = hospitalA();
    const months = [jan, feb, mar].map((p) => calculatePeriod(config, p));
    const q1 = aggregate(config, "Q1 2026", quarterMonths(2026, 1), months);
    expect(niv(q1).revenue.value).toBe(522_000);
    expect(niv(q1).volume).toBe(320);
    expect(niv(q1).price).toBeCloseTo(1631.25, 6);
    const ytd = aggregate(config, "YTD Mar 2026", ytdMonths("2026-03"), months);
    expect(ytd.revenue.value).toBe(522_000);
  });

  it("department split follows the activity entered per department", () => {
    const r = calculatePeriod(hospitalA(), jan);
    expect(r.departments.find((d) => d.name === "AICU")).toMatchObject({ volume: 60, revenue: 90_000 });
    expect(r.departments.find((d) => d.name === "PICU")).toMatchObject({ volume: 40, revenue: 60_000 });
  });
});

describe("price timeline", () => {
  it("derives effective periods without storing end dates", () => {
    const t = timeline(hospitalA([price("p4", "a-niv", 2000, "2026-10")]).priceVersions);
    expect(t.map((e) => [e.version.amount, e.from, e.to])).toEqual([
      [2000, "2026-10", null],
      [1600, "2026-03", "2026-09"],
      [1800, "2026-02", "2026-02"],
      [1500, "2026-01", "2026-01"],
    ]);
  });

  it("returns no price before the first version", () => {
    expect(versionFor(hospitalA().priceVersions, "2025-12")).toBeNull();
  });
});

describe("missing data is never zero", () => {
  it("a department without volume makes the service partial", () => {
    const r = calculatePeriod(hospitalA(), period("2026-01", 60, null));
    expect(niv(r).revenue).toMatchObject({ value: 90_000, status: "partial" });
    expect(niv(r).revenue.issues[0].message).toContain("PICU");
  });

  it("no volume at all leaves revenue missing, not zero", () => {
    const r = calculatePeriod(hospitalA(), period("2026-01", null, null));
    expect(niv(r).revenue).toMatchObject({ value: null, status: "missing" });
  });

  it("volume without an effective price is flagged", () => {
    const r = calculatePeriod(hospitalA(), period("2025-12", 5, 5));
    expect(niv(r).revenue.status).toBe("missing");
    expect(niv(r).revenue.issues.some((i) => i.code === "missing_price")).toBe(true);
  });

  it("net value is not shown until operating cost exists", () => {
    const r = calculatePeriod(hospitalA(), period("2026-01", 60, 40));
    expect(r.revenue.value).toBe(150_000);
    expect(r.net).toMatchObject({ value: null, status: "missing" });
  });
});

describe("costs follow their own effective-dated versions", () => {
  const items: CostItemConfig[] = [
    {
      id: "c-circuit",
      name: "Ventilator circuit",
      category: "consumable",
      basis: "per_unit",
      unitLabel: "circuit",
      hospitalServiceId: null,
      departmentId: null,
      equipmentId: null,
      isRtStaff: false,
      active: true,
      endedFrom: null,
    },
    {
      id: "c-rt",
      name: "Respiratory therapist",
      category: "staffing",
      basis: "per_unit",
      unitLabel: "FTE",
      hospitalServiceId: null,
      departmentId: null,
      equipmentId: null,
      isRtStaff: true,
      active: true,
      endedFrom: null,
    },
    {
      id: "c-maint",
      name: "Ventilator maintenance contract",
      category: "maintenance",
      basis: "monthly",
      unitLabel: "month",
      hospitalServiceId: null,
      departmentId: null,
      equipmentId: null,
      isRtStaff: false,
      active: false,
      endedFrom: "2026-03",
    },
    {
      id: "c-niv-mask",
      name: "NIV mask",
      category: "consumable",
      basis: "per_service_unit",
      unitLabel: "mask",
      hospitalServiceId: "a-niv",
      departmentId: null,
      equipmentId: null,
      isRtStaff: false,
      active: true,
      endedFrom: null,
    },
  ];
  const cv = (id: string, costItemId: string, amount: number, effectiveFrom: string): CostVersion => ({
    id,
    costItemId,
    amount,
    effectiveFrom,
    notes: null,
    voided: false,
  });
  const config: HospitalConfig = {
    ...hospitalA(),
    costItems: items,
    costVersions: [
      cv("v1", "c-circuit", 450, "2026-01"),
      cv("v2", "c-circuit", 520, "2026-02"),
      cv("v3", "c-circuit", 480, "2026-03"),
      cv("v4", "c-rt", 25_000, "2026-01"),
      cv("v5", "c-maint", 10_000, "2026-01"),
      cv("v6", "c-niv-mask", 100, "2026-02"),
    ],
  };
  const withCosts = (month: string, circuits: number) =>
    period(month, 50, 50, {
      costEntries: [
        { costItemId: "c-circuit", quantity: circuits },
        { costItemId: "c-rt", quantity: 4 },
      ],
      stats: [{ departmentId: null, patients: 80, admissions: null, occupiedBedDays: 4650, ventilatorDays: 300 }],
    });

  it("January keeps the EGP 450 circuit cost after later changes", () => {
    const jan = calculatePeriod(config, withCosts("2026-01", 100));
    expect(jan.costLines.find((c) => c.costItemId === "c-circuit")).toMatchObject({ unitCost: 450, quantity: 100 });
    expect(jan.costLines.find((c) => c.costItemId === "c-circuit")!.amount.value).toBe(45_000);
    const feb = calculatePeriod(config, withCosts("2026-02", 100));
    expect(feb.costLines.find((c) => c.costItemId === "c-circuit")!.amount.value).toBe(52_000);
    const mar = calculatePeriod(config, withCosts("2026-03", 100));
    expect(mar.costLines.find((c) => c.costItemId === "c-circuit")!.amount.value).toBe(48_000);
  });

  it("an item only applies once its first version starts, and stops when it ended", () => {
    const jan = calculatePeriod(config, withCosts("2026-01", 100));
    expect(jan.costLines.some((c) => c.costItemId === "c-niv-mask")).toBe(false);
    expect(jan.costLines.some((c) => c.costItemId === "c-maint")).toBe(true);
    const mar = calculatePeriod(config, withCosts("2026-03", 100));
    expect(mar.costLines.some((c) => c.costItemId === "c-maint")).toBe(false);
  });

  it("per-service-unit costs use the service's volume and roll into its contribution", () => {
    const feb = calculatePeriod(config, withCosts("2026-02", 100));
    expect(feb.costLines.find((c) => c.costItemId === "c-niv-mask")!.amount.value).toBe(10_000);
    expect(niv(feb)).toMatchObject({ directCost: 10_000, contribution: 170_000 });
  });

  it("totals, staffing cost, net value and KPIs", () => {
    const jan = calculatePeriod(config, withCosts("2026-01", 100));
    // circuits 45,000 + staffing 4 × 25,000 + maintenance 10,000
    expect(jan.costs).toMatchObject({ value: 155_000, status: "complete" });
    expect(jan.costsByCategory.staffing).toBe(100_000);
    expect(jan.net.value).toBe(150_000 - 155_000);
    expect(jan.kpis.rtFte).toBe(4);
    expect(jan.kpis.revenuePerRt).toBe(37_500);
    expect(jan.kpis.costPerPatient).toBeCloseTo(155_000 / 80, 6);
    expect(jan.kpis.costPerVentilatorDay).toBeCloseTo(155_000 / 300, 6);
    expect(jan.kpis.revenuePerOccupiedBed).toBeCloseTo(150_000 / (4650 / 31), 6);
    expect(jan.kpis.occupancy).toBeCloseTo(4650 / 31 / 200, 6);
  });

  it("a per-unit cost without a quantity makes costs partial", () => {
    const jan = calculatePeriod(config, period("2026-01", 50, 50, { costEntries: [{ costItemId: "c-rt", quantity: 4 }] }));
    expect(jan.costs.status).toBe("partial");
    expect(jan.costs.issues.some((i) => i.code === "missing_cost_quantity")).toBe(true);
  });

  it("explains a cost increase as quantity and unit-cost effects", () => {
    const jan = calculatePeriod(config, withCosts("2026-01", 100));
    const feb = calculatePeriod(config, withCosts("2026-02", 110));
    const v = explainVariance(jan, feb);
    const circuit = v.drivers.filter((d) => d.subject === "Ventilator circuit");
    // quantity: (110 − 100) × 450 = 4,500 more cost; rate: (520 − 450) × 110 = 7,700 more cost
    expect(circuit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "cost_quantity", effect: -4_500 }),
        expect.objectContaining({ kind: "cost_rate", effect: -7_700 }),
      ]),
    );
  });
});

describe("billing units", () => {
  const base = hospitalA();
  it("a fixed monthly contract earns its amount regardless of volume", () => {
    const config = { ...base, priceVersions: [price("f1", "a-niv", 50_000, "2026-01", { billingUnit: "fixed_contract" })] };
    expect(niv(calculatePeriod(config, period("2026-01", 1, 1))).revenue.value).toBe(50_000);
  });

  it("a percentage applies to the billed base amount", () => {
    const config = { ...base, priceVersions: [price("pc", "a-niv", 10, "2026-01", { billingUnit: "percentage" })] };
    expect(niv(calculatePeriod(config, period("2026-01", 100_000, 50_000))).revenue.value).toBe(15_000);
  });
});

describe("comparisons", () => {
  it("compares two months with change and growth", () => {
    const jan = calculatePeriod(hospitalA(), period("2026-01", 60, 40));
    const mar = calculatePeriod(hospitalA(), period("2026-03", 70, 50));
    const rows = compareSummaries(jan, mar);
    expect(rows.find((r) => r.key === "revenue")).toMatchObject({ a: 150_000, b: 192_000, change: 42_000 });
    expect(rows.find((r) => r.key === "revenue")!.changePct).toBeCloseTo(0.28, 6);
    expect(rows.find((r) => r.key === "volume")).toMatchObject({ a: 100, b: 120 });
  });
});
