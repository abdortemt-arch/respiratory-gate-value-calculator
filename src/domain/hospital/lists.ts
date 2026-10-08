/**
 * Controlled vocabularies for hospital configuration. Names of departments,
 * services and cost items are free text; these categories exist for analytics.
 */

export const HOSPITAL_TYPES = {
  general: "General hospital",
  teaching: "Teaching / university",
  specialty: "Specialty hospital",
  private: "Private hospital",
  public: "Public hospital",
  military: "Military hospital",
  other: "Other",
} as const;
export type HospitalType = keyof typeof HOSPITAL_TYPES;

export const DEPARTMENT_CATEGORIES = {
  adult_icu: "Adult ICU",
  picu: "PICU",
  nicu: "NICU",
  ccu: "CCU",
  burn_icu: "Burn ICU",
  emergency: "Emergency",
  step_down: "Step-down / HDU",
  ward: "Ward",
  operating_room: "Operating room",
  other: "Other",
} as const;
export type DepartmentCategory = keyof typeof DEPARTMENT_CATEGORIES;

export const SERVICE_CATEGORIES = {
  ventilation: "Ventilation",
  oxygen_therapy: "Oxygen therapy",
  airway: "Airway management",
  aerosol: "Aerosol therapy",
  diagnostics: "Diagnostics",
  therapy: "Therapy & rehabilitation",
  transport: "Transport",
  sleep: "Sleep medicine",
  other: "Other",
} as const;
export type ServiceCategory = keyof typeof SERVICE_CATEGORIES;

/**
 * How a service is billed. Volume-based units multiply the month's quantity by
 * the effective price; a fixed contract earns its amount each month; a
 * percentage applies to a billed base amount entered for the month.
 */
export const BILLING_UNITS = {
  per_procedure: { label: "Per procedure", volume: "procedures" },
  per_patient: { label: "Per patient", volume: "patients" },
  per_session: { label: "Per session", volume: "sessions" },
  per_day: { label: "Per day", volume: "days" },
  per_ventilator_day: { label: "Per ventilator day", volume: "ventilator days" },
  per_hour: { label: "Per hour", volume: "hours" },
  per_case: { label: "Per case", volume: "cases" },
  monthly_package: { label: "Monthly package", volume: "packages" },
  fixed_contract: { label: "Fixed monthly contract", volume: "units (not billed)" },
  percentage: { label: "Percentage of billed base", volume: "EGP billed base" },
  custom: { label: "Custom unit", volume: "units" },
} as const;
export type BillingUnit = keyof typeof BILLING_UNITS;

export const COST_CATEGORIES = {
  staffing: "Staffing",
  consumable: "Consumables",
  equipment: "Equipment",
  maintenance: "Maintenance",
  contract: "Contracts",
  service_cost: "Service costs",
  package_cost: "Package costs",
  other_recurring: "Other recurring",
} as const;
export type CostCategory = keyof typeof COST_CATEGORIES;

/**
 * How a cost item becomes a monthly amount:
 * - per_unit: unit cost × quantity entered for the month (consumables used, FTEs employed)
 * - monthly: fixed amount every month the item is active (contracts, rentals)
 * - per_service_unit: unit cost × the linked service's volume that month
 */
export const COST_BASES = {
  per_unit: "Per unit used (quantity entered monthly)",
  monthly: "Fixed monthly amount",
  per_service_unit: "Per unit of a linked service's volume",
} as const;
export type CostBasis = keyof typeof COST_BASES;

export const EQUIPMENT_CATEGORIES = {
  ventilator: "Ventilator",
  niv_device: "NIV device",
  hfnc_device: "HFNC device",
  transport_ventilator: "Transport ventilator",
  humidifier: "Humidifier",
  monitor: "Monitor",
  blood_gas_analyzer: "Blood gas analyzer",
  pft_equipment: "PFT equipment",
  other: "Other",
} as const;
export type EquipmentCategory = keyof typeof EQUIPMENT_CATEGORIES;

export const OWNERSHIP_TYPES = {
  owned: "Owned",
  rented: "Rented",
  leased: "Leased",
  consigned: "Consigned / vendor-placed",
} as const;
export type OwnershipType = keyof typeof OWNERSHIP_TYPES;

export const SAVINGS_CATEGORIES = {
  ventilator_resources: "Ventilator resources",
  niv_hfnc_utilization: "NIV / HFNC utilization",
  oxygen_stewardship: "Oxygen stewardship",
  consumable_standardization: "Consumable standardization",
  equipment_utilization: "Equipment utilization",
  staffing_outsourcing: "Staffing & outsourcing",
  other: "Other",
} as const;
export type SavingsCategory = keyof typeof SAVINGS_CATEGORIES;

export const PERIOD_STATUSES = {
  draft: "Draft",
  in_review: "In review",
  finalized: "Finalized",
  locked: "Locked",
} as const;
export type PeriodStatus = keyof typeof PERIOD_STATUSES;

export function isOneOf<T extends Record<string, unknown>>(list: T, value: unknown): value is keyof T {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(list, value);
}
