/**
 * Input catalog: the canonical definition of every hospital input and every
 * global Respiratory Gate model assumption. Mirrors `docs/excel-formula-map.md`
 * §3 and §5. Database seed rows are generated from this file.
 */

export type InputGroupId =
  | "icu_activity"
  | "unit_costs"
  | "annual_spend"
  | "usage"
  | "equipment"
  | "billing"
  | "other_revenue"
  | "operating_cost"
  | "model_assumptions";

/** Workbook legend: yellow = hospital data, blue = RG assumption. */
export type SourceType = "hospital_data" | "verified_public" | "rg_assumption";

/** Determines parsing, validation and display. Percentages are stored as fractions. */
export type ValueKind = "count" | "decimal" | "currency" | "percent";

/** `model` inputs feed a calculation; `informational` inputs are collected only. */
export type InputUsage = "model" | "informational";

export interface InputDefinition {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly group: InputGroupId;
  readonly owner: string;
  readonly note?: string;
  readonly source: SourceType;
  readonly kind: ValueKind;
  readonly usage: InputUsage;
  /** Reference cell in data/Elite_RT_Value_Calculator.xlsx. */
  readonly workbookCell: string;
  /** Seed value. `null` = not yet provided. Never invent hospital data here. */
  readonly defaultValue: number | null;
  /** Inclusive bounds on the stored value (fractions for percentages). */
  readonly min?: number;
  readonly max?: number;
  /** Strict lower bound, e.g. prices and occupancy must be > 0. */
  readonly exclusiveMin?: boolean;
  /** Prompt for the optional text qualifier stored in `text_value`. */
  readonly textQualifier?: string;
}

type HospitalDef = Omit<InputDefinition, "source" | "defaultValue"> &
  Partial<Pick<InputDefinition, "source" | "defaultValue">>;
type AssumptionDef = Omit<InputDefinition, "source" | "owner" | "usage" | "group">;

/** Yellow cell: hospital data, `null` until provided. Generic so keys stay literal types. */
function hospital<const K extends string>(def: HospitalDef & { key: K }): InputDefinition & { key: K } {
  return { source: "hospital_data", defaultValue: null, ...def };
}

/** Blue cell: Respiratory Gate assumption with a workbook default. */
function assumption<const K extends string>(def: AssumptionDef & { key: K }): InputDefinition & { key: K } {
  return { source: "rg_assumption", owner: "Respiratory Gate", usage: "model", group: "model_assumptions", ...def };
}

export const INPUT_DEFINITIONS = [
  // ── ICU ACTIVITY ────────────────────────────────────────────────────────
  hospital({
    key: "icu_beds",
    label: "ICU beds",
    unit: "beds",
    group: "icu_activity",
    owner: "Verified",
    note: "Elite official ICU page (elitehospital.org, 6 Oct 2026)",
    source: "verified_public",
    defaultValue: 50,
    kind: "count",
    usage: "model",
    workbookCell: "Inputs!C6",
    min: 1,
  }),
  hospital({
    key: "icu_occupancy_rate_actual",
    label: "ICU occupancy rate",
    unit: "%",
    group: "icu_activity",
    owner: "ICU / Admissions",
    note: "Annual average occupancy",
    kind: "percent",
    usage: "informational",
    workbookCell: "Inputs!C7",
  }),
  hospital({
    key: "ventilated_patient_days",
    label: "Ventilated patient-days",
    unit: "patient-days / yr",
    group: "icu_activity",
    owner: "ICU",
    note: "Invasive mechanical ventilation days, all ICUs",
    kind: "count",
    usage: "model",
    workbookCell: "Inputs!C8",
  }),
  hospital({
    key: "avg_ventilator_days_per_patient",
    label: "Average ventilator days per patient",
    unit: "days",
    group: "icu_activity",
    owner: "ICU",
    note: "Mean duration of invasive ventilation",
    kind: "decimal",
    usage: "informational",
    workbookCell: "Inputs!C9",
  }),
  hospital({
    key: "niv_patient_days",
    label: "NIV patient-days",
    unit: "patient-days / yr",
    group: "icu_activity",
    owner: "ICU",
    note: "NIV / CPAP / BiPAP days",
    kind: "count",
    usage: "model",
    workbookCell: "Inputs!C10",
  }),
  hospital({
    key: "hfnc_patient_days",
    label: "HFNC patient-days",
    unit: "patient-days / yr",
    group: "icu_activity",
    owner: "ICU",
    note: "High-flow nasal cannula days",
    kind: "count",
    usage: "model",
    workbookCell: "Inputs!C11",
  }),
  hospital({
    key: "oxygen_consumption",
    label: "Oxygen consumption",
    unit: "m³ or units / yr",
    group: "icu_activity",
    owner: "Supply chain",
    note: "As purchased (state unit in note)",
    kind: "decimal",
    usage: "informational",
    workbookCell: "Inputs!C12",
    textQualifier: "Unit (e.g. m³, cylinders)",
  }),

  // ── UNIT COSTS ──────────────────────────────────────────────────────────
  hospital({
    key: "cost_per_ventilator_day",
    label: "Cost per ventilator-day",
    unit: "EGP",
    group: "unit_costs",
    owner: "Finance",
    note: "Consumables + device + direct resources per ventilated day",
    kind: "currency",
    usage: "model",
    workbookCell: "Inputs!C14",
  }),
  hospital({
    key: "cost_per_niv_day",
    label: "Cost per NIV day",
    unit: "EGP",
    group: "unit_costs",
    owner: "Finance",
    note: "Interfaces, circuits, device cost per NIV day",
    kind: "currency",
    usage: "model",
    workbookCell: "Inputs!C15",
  }),
  hospital({
    key: "cost_per_hfnc_day",
    label: "Cost per HFNC day",
    unit: "EGP",
    group: "unit_costs",
    owner: "Finance",
    note: "Circuits, humidification, device cost per HFNC day",
    kind: "currency",
    usage: "model",
    workbookCell: "Inputs!C16",
  }),

  // ── ANNUAL SPEND ────────────────────────────────────────────────────────
  hospital({
    key: "oxygen_spend",
    label: "Oxygen spend",
    unit: "EGP / yr",
    group: "annual_spend",
    owner: "Finance",
    note: "Total medical oxygen purchasing",
    kind: "currency",
    usage: "model",
    workbookCell: "Inputs!C18",
  }),
  hospital({
    key: "respiratory_consumable_spend",
    label: "Respiratory consumable expenditure",
    unit: "EGP / yr",
    group: "annual_spend",
    owner: "Finance",
    note: "Circuits, HME/HMEF, filters, closed suction, nebulizer kits, interfaces, HFNC circuits, humidification",
    kind: "currency",
    usage: "model",
    workbookCell: "Inputs!C19",
  }),
  hospital({
    key: "equipment_rental_spend",
    label: "Respiratory equipment rental",
    unit: "EGP / yr",
    group: "annual_spend",
    owner: "Biomedical",
    note: "If applicable",
    kind: "currency",
    usage: "model",
    workbookCell: "Inputs!C20",
  }),
  hospital({
    key: "equipment_maintenance_spend",
    label: "Respiratory equipment maintenance",
    unit: "EGP / yr",
    group: "annual_spend",
    owner: "Biomedical",
    note: "Service contracts and repairs",
    kind: "currency",
    usage: "model",
    workbookCell: "Inputs!C21",
  }),
  hospital({
    key: "planned_equipment_purchases",
    label: "Planned respiratory equipment purchases",
    unit: "EGP / yr",
    group: "annual_spend",
    owner: "Biomedical",
    note: "Capital budget for ventilators, NIV, HFNC, humidifiers, transport ventilators",
    kind: "currency",
    usage: "model",
    workbookCell: "Inputs!C22",
  }),
  hospital({
    key: "respiratory_staffing_spend",
    label: "Current respiratory staffing expenditure",
    unit: "EGP / yr",
    group: "annual_spend",
    owner: "HR / Finance",
    note: "Staff currently delivering respiratory tasks",
    kind: "currency",
    usage: "informational",
    workbookCell: "Inputs!C23",
  }),
  hospital({
    key: "respiratory_overtime_spend",
    label: "Overtime expenditure (respiratory-related)",
    unit: "EGP / yr",
    group: "annual_spend",
    owner: "HR / Finance",
    kind: "currency",
    usage: "model",
    workbookCell: "Inputs!C24",
  }),
  hospital({
    key: "pft_outsourcing_spend",
    label: "PFT outsourcing",
    unit: "EGP / yr",
    group: "annual_spend",
    owner: "Finance",
    note: "If applicable",
    kind: "currency",
    usage: "model",
    workbookCell: "Inputs!C25",
  }),
  hospital({
    key: "external_respiratory_services_spend",
    label: "External respiratory service expenditure",
    unit: "EGP / yr",
    group: "annual_spend",
    owner: "Finance",
    note: "If applicable",
    kind: "currency",
    usage: "model",
    workbookCell: "Inputs!C26",
  }),

  // ── USAGE ───────────────────────────────────────────────────────────────
  hospital({
    key: "ventilator_circuits_used",
    label: "Ventilator circuit usage",
    unit: "units / yr",
    group: "usage",
    owner: "Supply chain",
    kind: "count",
    usage: "informational",
    workbookCell: "Inputs!C28",
  }),
  hospital({
    key: "filters_used",
    label: "Filter usage",
    unit: "units / yr",
    group: "usage",
    owner: "Supply chain",
    kind: "count",
    usage: "informational",
    workbookCell: "Inputs!C29",
  }),
  hospital({
    key: "closed_suction_used",
    label: "Closed suction usage",
    unit: "units / yr",
    group: "usage",
    owner: "Supply chain",
    kind: "count",
    usage: "informational",
    workbookCell: "Inputs!C30",
  }),
  hospital({
    key: "hfnc_circuits_used",
    label: "HFNC circuit usage",
    unit: "units / yr",
    group: "usage",
    owner: "Supply chain",
    kind: "count",
    usage: "informational",
    workbookCell: "Inputs!C31",
  }),
  hospital({
    key: "niv_interfaces_used",
    label: "NIV interface usage",
    unit: "units / yr",
    group: "usage",
    owner: "Supply chain",
    kind: "count",
    usage: "informational",
    workbookCell: "Inputs!C32",
  }),

  // ── EQUIPMENT ───────────────────────────────────────────────────────────
  hospital({
    key: "respiratory_equipment_inventory",
    label: "Respiratory equipment inventory",
    unit: "devices",
    group: "equipment",
    owner: "Biomedical",
    note: "Ventilators, NIV, HFNC, humidifiers, nebulizers, transport ventilators",
    kind: "count",
    usage: "informational",
    workbookCell: "Inputs!C33",
  }),
  hospital({
    key: "respiratory_equipment_utilization_rate",
    label: "Respiratory equipment utilization rate",
    unit: "%",
    group: "equipment",
    owner: "Biomedical",
    note: "Average in-use time ÷ available time",
    kind: "percent",
    usage: "informational",
    workbookCell: "Inputs!C34",
  }),

  // ── BILLING ─────────────────────────────────────────────────────────────
  hospital({
    key: "billable_respiratory_activities",
    label: "Current billable respiratory activities",
    unit: "activities / yr",
    group: "billing",
    owner: "Finance / Billing",
    note: "Activities billed today",
    kind: "count",
    usage: "informational",
    workbookCell: "Inputs!C36",
  }),
  hospital({
    key: "unbilled_eligible_respiratory_activities",
    label: "Unbilled eligible respiratory activities",
    unit: "activities / yr",
    group: "billing",
    owner: "Finance / Billing",
    note: "Performed but not captured (from audit)",
    kind: "count",
    usage: "model",
    workbookCell: "Inputs!C37",
  }),
  hospital({
    key: "avg_tariff_per_respiratory_activity",
    label: "Average tariff per respiratory activity",
    unit: "EGP",
    group: "billing",
    owner: "Finance / Billing",
    kind: "currency",
    usage: "model",
    workbookCell: "Inputs!C38",
  }),
  hospital({
    key: "collection_rate",
    label: "Actual collection rate",
    unit: "%",
    group: "billing",
    owner: "Finance",
    note: "Collected ÷ billed",
    kind: "percent",
    usage: "model",
    workbookCell: "Inputs!C39",
  }),

  // ── OTHER REVENUE STREAMS (Revenue sheet, yellow) ───────────────────────
  hospital({
    key: "pft_annual_tests",
    label: "Pulmonary Function Testing — tests per year",
    unit: "tests / yr",
    group: "other_revenue",
    owner: "Finance",
    note: "Tests a year × hospital PFT tariff. Leave blank until priced.",
    kind: "count",
    usage: "model",
    workbookCell: "Revenue!B39",
  }),
  hospital({
    key: "pft_price_per_test",
    label: "Pulmonary Function Testing — price per test",
    unit: "EGP",
    group: "other_revenue",
    owner: "Finance",
    note: "Hospital PFT tariff",
    kind: "currency",
    usage: "model",
    workbookCell: "Revenue!C39",
  }),
  hospital({
    key: "education_annual_participants",
    label: "Education Center — participants per year",
    unit: "participants / yr",
    group: "other_revenue",
    owner: "Finance",
    note: "Participants × course fee. Leave blank until priced.",
    kind: "count",
    usage: "model",
    workbookCell: "Revenue!B40",
  }),
  hospital({
    key: "education_fee_per_participant",
    label: "Education Center — course fee",
    unit: "EGP",
    group: "other_revenue",
    owner: "Finance",
    kind: "currency",
    usage: "model",
    workbookCell: "Revenue!C40",
  }),
  hospital({
    key: "future_programs_annual_enrolled",
    label: "Future clinical programs — enrolled per year",
    unit: "enrolments / yr",
    group: "other_revenue",
    owner: "Finance",
    note: "Aggregate count only. Enrolled patients × program fee. Leave blank until priced.",
    kind: "count",
    usage: "model",
    workbookCell: "Revenue!B41",
  }),
  hospital({
    key: "future_programs_fee",
    label: "Future clinical programs — program fee",
    unit: "EGP",
    group: "other_revenue",
    owner: "Finance",
    kind: "currency",
    usage: "model",
    workbookCell: "Revenue!C41",
  }),

  // ── RT OPERATING COST (Revenue sheet, yellow) ───────────────────────────
  ...(
    [
      ["opcost_rt_salaries", "RT salaries", "Revenue!B45"],
      ["opcost_supervisor_salaries", "Supervisor / lead salaries", "Revenue!B46"],
      ["opcost_clinical_education", "Clinical education", "Revenue!B47"],
      ["opcost_consumables_incremental", "Consumables (incremental)", "Revenue!B48"],
      ["opcost_equipment_depreciation", "Equipment depreciation", "Revenue!B49"],
      ["opcost_maintenance", "Maintenance", "Revenue!B50"],
      ["opcost_documentation_technology", "Documentation / technology", "Revenue!B51"],
      ["opcost_training", "Training", "Revenue!B52"],
      ["opcost_admin_overhead", "Admin / management overhead", "Revenue!B53"],
      ["opcost_supply_chain_logistics", "Supply chain / logistics", "Revenue!B54"],
    ] as const
  ).map(([key, label, workbookCell]) =>
    hospital({
      key,
      label,
      unit: "EGP / yr",
      group: "operating_cost",
      owner: "Finance",
      note: "Annual cost of running the RT service. Enter 0 if not applicable.",
      kind: "currency",
      usage: "model",
      workbookCell,
    }),
  ),

  // ── RESPIRATORY GATE MODEL ASSUMPTIONS (blue) ───────────────────────────
  assumption({
    key: "days_per_month",
    label: "Days per month",
    unit: "days",
    note: "Assumption: 30-day month (monthly view only)",
    kind: "count",
    workbookCell: "Revenue!B5",
    defaultValue: 30,
    min: 28,
    max: 31,
  }),
  assumption({
    key: "days_per_year",
    label: "Days per year",
    unit: "days",
    note: "Assumption: 365-day year",
    kind: "count",
    workbookCell: "Revenue!B6",
    defaultValue: 365,
    min: 360,
    max: 366,
  }),
  ...([0.6, 0.7, 0.8, 0.9] as const).map((value, i) =>
    assumption({
      key: `occupancy_scenario_${i + 1}` as `occupancy_scenario_${1 | 2 | 3 | 4}`,
      label: `Occupancy scenario ${i + 1}`,
      unit: "%",
      note: "Occupancy grid on the Revenue screen",
      kind: "percent",
      workbookCell: `Revenue!A${11 + i}`,
      defaultValue: value,
      min: 0,
      max: 1,
      exclusiveMin: true,
    }),
  ),
  ...([800, 1000, 1200] as const).map((value, i) =>
    assumption({
      key: `price_scenario_${i + 1}` as `price_scenario_${1 | 2 | 3}`,
      label: `Package price scenario ${i + 1}`,
      unit: "EGP / patient-day",
      note: "Commercial assumption per occupied ICU respiratory patient-day",
      kind: "currency",
      workbookCell: `Revenue!${"CDE"[i]}9`,
      defaultValue: value,
      min: 0,
      exclusiveMin: true,
    }),
  ),
] as const satisfies readonly InputDefinition[];

export type InputKey = (typeof INPUT_DEFINITIONS)[number]["key"];

/** Every catalog value; `null` = not yet provided (never 0 by default). */
export type InputValues = Record<InputKey, number | null>;

export const INPUT_KEYS: readonly InputKey[] = INPUT_DEFINITIONS.map((d) => d.key as InputKey);

const BY_KEY = new Map<string, InputDefinition>(INPUT_DEFINITIONS.map((d) => [d.key, d]));

export function getInputDefinition(key: InputKey): InputDefinition {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Unknown input key: ${key}`);
  return def;
}

export function isInputKey(key: string): key is InputKey {
  return BY_KEY.has(key);
}

export const OCCUPANCY_SCENARIO_KEYS = [
  "occupancy_scenario_1",
  "occupancy_scenario_2",
  "occupancy_scenario_3",
  "occupancy_scenario_4",
] as const satisfies readonly InputKey[];

export const PRICE_SCENARIO_KEYS = ["price_scenario_1", "price_scenario_2", "price_scenario_3"] as const satisfies readonly InputKey[];

export const OPERATING_COST_KEYS = [
  "opcost_rt_salaries",
  "opcost_supervisor_salaries",
  "opcost_clinical_education",
  "opcost_consumables_incremental",
  "opcost_equipment_depreciation",
  "opcost_maintenance",
  "opcost_documentation_technology",
  "opcost_training",
  "opcost_admin_overhead",
  "opcost_supply_chain_logistics",
] as const satisfies readonly InputKey[];

export interface InputGroup {
  readonly id: InputGroupId;
  readonly label: string;
  readonly description: string;
}

export const INPUT_GROUPS: readonly InputGroup[] = [
  { id: "icu_activity", label: "ICU Activity", description: "Beds, occupancy and respiratory support days." },
  { id: "unit_costs", label: "Unit Costs", description: "Direct cost per day of each respiratory support mode." },
  { id: "annual_spend", label: "Annual Spend", description: "Annual respiratory expenditure (EGP / year)." },
  { id: "usage", label: "Usage", description: "Annual consumable usage (units / year)." },
  { id: "equipment", label: "Equipment", description: "Respiratory equipment inventory and utilization." },
  { id: "billing", label: "Billing", description: "Captured and uncaptured billable respiratory activity." },
  {
    id: "other_revenue",
    label: "Other Revenue Streams",
    description: "PFT, Education Center and future programs. Leave blank until priced.",
  },
  {
    id: "operating_cost",
    label: "RT Operating Cost",
    description: "Annual cost of the respiratory therapy service. Required before any net value or margin is shown.",
  },
  {
    id: "model_assumptions",
    label: "Model Assumptions",
    description: "Respiratory Gate scenario grids and day counts (editable by Admin).",
  },
];

/** Hospital-data groups shown on the Inputs screen, in display order. */
export const HOSPITAL_INPUT_GROUPS: readonly InputGroupId[] = INPUT_GROUPS.map((g) => g.id).filter(
  (id) => id !== "model_assumptions",
);

export function definitionsInGroup(group: InputGroupId): readonly InputDefinition[] {
  return INPUT_DEFINITIONS.filter((d) => d.group === group);
}

/** Catalog defaults: RG assumptions and the verified ICU bed count; all hospital data `null`. */
export function defaultInputValues(): InputValues {
  return Object.fromEntries(INPUT_DEFINITIONS.map((d) => [d.key, d.defaultValue])) as InputValues;
}
