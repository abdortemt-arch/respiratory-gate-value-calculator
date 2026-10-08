/**
 * Hospital configuration (what a hospital IS) and monthly operating data (what
 * HAPPENED in a month). Plain data, mapped from the database by src/server.
 */
import type { Month } from "./month";
import type {
  BillingUnit,
  CostBasis,
  CostCategory,
  DepartmentCategory,
  PeriodStatus,
  SavingsCategory,
  ServiceCategory,
} from "./lists";

export interface DepartmentConfig {
  readonly id: string;
  readonly name: string;
  readonly category: DepartmentCategory;
  readonly beds: number | null;
  readonly rtCoverage: boolean;
  readonly active: boolean;
}

export interface HospitalServiceConfig {
  /** hospital_services.id */
  readonly id: string;
  /** services.id in the organisation's service library (same id across hospitals). */
  readonly serviceId: string;
  readonly name: string;
  readonly category: ServiceCategory;
  readonly active: boolean;
  /** Departments where this service is provided (active assignments). */
  readonly departmentIds: readonly string[];
}

/** Immutable, effective-dated price of a hospital service. */
export interface PriceVersion {
  readonly id: string;
  readonly hospitalServiceId: string;
  readonly amount: number;
  readonly currency: string;
  readonly billingUnit: BillingUnit;
  readonly effectiveFrom: Month;
  readonly notes: string | null;
  readonly voided: boolean;
  readonly voidReason?: string | null;
  readonly createdAt?: string;
  readonly createdByName?: string | null;
}

export interface CostItemConfig {
  readonly id: string;
  readonly name: string;
  readonly category: CostCategory;
  readonly basis: CostBasis;
  /** e.g. "circuit", "FTE", "month" */
  readonly unitLabel: string;
  readonly hospitalServiceId: string | null;
  readonly departmentId: string | null;
  readonly equipmentId: string | null;
  /** Staffing lines that count as respiratory therapists (for revenue per RT). */
  readonly isRtStaff: boolean;
  readonly active: boolean;
  /** First month the item no longer applies (set when deactivated). */
  readonly endedFrom: Month | null;
}

/** Immutable, effective-dated cost (unit cost, monthly amount or monthly cost per FTE). */
export interface CostVersion {
  readonly id: string;
  readonly costItemId: string;
  readonly amount: number;
  readonly effectiveFrom: Month;
  readonly notes: string | null;
  readonly voided: boolean;
  readonly voidReason?: string | null;
  readonly createdAt?: string;
  readonly createdByName?: string | null;
}

export interface HospitalConfig {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly totalBeds: number | null;
  readonly currency: string;
  readonly departments: readonly DepartmentConfig[];
  readonly services: readonly HospitalServiceConfig[];
  readonly priceVersions: readonly PriceVersion[];
  readonly costItems: readonly CostItemConfig[];
  readonly costVersions: readonly CostVersion[];
}

export interface ActivityEntry {
  readonly hospitalServiceId: string;
  /** null = recorded for the whole hospital (service not split by department). */
  readonly departmentId: string | null;
  /** null = not entered; 0 = none happened. */
  readonly quantity: number | null;
}

export interface StatsEntry {
  readonly departmentId: string | null;
  readonly patients: number | null;
  readonly admissions: number | null;
  readonly occupiedBedDays: number | null;
  readonly ventilatorDays: number | null;
}

export interface CostEntry {
  readonly costItemId: string;
  readonly quantity: number | null;
}

export interface SavingsEntry {
  readonly id: string;
  readonly category: SavingsCategory;
  readonly description: string;
  readonly amount: number;
}

export interface PeriodInput {
  readonly id: string;
  readonly month: Month;
  readonly status: PeriodStatus;
  readonly activity: readonly ActivityEntry[];
  readonly stats: readonly StatsEntry[];
  readonly costEntries: readonly CostEntry[];
  readonly savings: readonly SavingsEntry[];
}
