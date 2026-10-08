/**
 * Reads hospital configuration and operating periods from Supabase and maps
 * them to the domain types the calculation engine uses. Every query runs with
 * the caller's client, so row-level security decides what is visible.
 *
 * No "server-only" import: the database tests exercise these functions
 * directly against a local Supabase stack.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isOneOf,
  monthOf,
  BILLING_UNITS,
  COST_BASES,
  COST_CATEGORIES,
  DEPARTMENT_CATEGORIES,
  HOSPITAL_TYPES,
  PERIOD_STATUSES,
  SAVINGS_CATEGORIES,
  SERVICE_CATEGORIES,
  type CostItemConfig,
  type CostVersion,
  type DepartmentConfig,
  type HospitalConfig,
  type HospitalServiceConfig,
  type HospitalType,
  type Month,
  type PeriodInput,
  type PeriodStatus,
  type PriceVersion,
  type ServiceCategory,
} from "@/domain/hospital";
import type { Database } from "../supabase/database.types";

export type Db = SupabaseClient<Database>;

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const pick = <T extends Record<string, unknown>>(list: T, value: unknown, fallback: keyof T): keyof T =>
  isOneOf(list, value) ? value : fallback;

export interface HospitalSummaryRow {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly type: HospitalType | null;
  readonly totalBeds: number | null;
  readonly location: string | null;
  readonly notes: string | null;
  readonly currency: string;
  readonly active: boolean;
  readonly workbookModelEnabled: boolean;
  readonly createdAt: string;
}

export interface DepartmentDetail extends DepartmentConfig {
  readonly notes: string | null;
  readonly sortOrder: number;
}

export interface HospitalServiceDetail extends HospitalServiceConfig {
  readonly code: string | null;
  readonly description: string | null;
  readonly notes: string | null;
  /** All assignments, including inactive ones (id = hospital_service_departments.id). */
  readonly assignments: readonly { id: string; departmentId: string; active: boolean }[];
}

export interface EquipmentDetail {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly departmentId: string | null;
  readonly quantity: number;
  readonly ownership: string;
  readonly acquiredOn: string | null;
  readonly notes: string | null;
  readonly active: boolean;
}

export interface CostItemDetail extends CostItemConfig {
  readonly notes: string | null;
}

export interface HospitalDetail {
  readonly hospital: HospitalSummaryRow;
  readonly config: HospitalConfig;
  readonly departments: readonly DepartmentDetail[];
  readonly services: readonly HospitalServiceDetail[];
  readonly equipment: readonly EquipmentDetail[];
  readonly costItems: readonly CostItemDetail[];
}

export interface PeriodRecord {
  readonly input: PeriodInput;
  readonly notes: string | null;
  readonly finalizedAt: string | null;
  readonly finalizedBy: string | null;
  readonly lockedAt: string | null;
  readonly lockedBy: string | null;
  readonly createdAt: string;
  /** Results stored when the month was finalized (for later verification). */
  readonly snapshot: { readonly revenue?: number | null; readonly costs?: number | null; readonly net?: number | null } | null;
  /** Raw row ids, so the UI can update existing entries. */
  readonly activityIds: Readonly<Record<string, string>>;
}

type HospitalRow = Database["public"]["Tables"]["hospitals"]["Row"];

export function mapHospital(row: HospitalRow): HospitalSummaryRow {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    type: row.hospital_type && isOneOf(HOSPITAL_TYPES, row.hospital_type) ? row.hospital_type : null,
    totalBeds: row.total_beds,
    location: row.location,
    notes: row.notes,
    currency: row.currency,
    active: row.active,
    workbookModelEnabled: row.workbook_model_enabled,
    createdAt: row.created_at,
  };
}

/** Hospitals the caller can see, active first, then by name. */
export async function listHospitals(db: Db): Promise<HospitalSummaryRow[]> {
  const { data, error } = await db.from("hospitals").select("*").order("active", { ascending: false }).order("name");
  if (error) throw error;
  return data.map(mapHospital);
}

/** Display names for audit stamps (created_by → name). */
export async function loadPeople(db: Db): Promise<Record<string, string>> {
  const { data } = await db.from("profiles").select("user_id, full_name");
  return Object.fromEntries((data ?? []).map((p) => [p.user_id, p.full_name]));
}

/** Full configuration of one hospital, or null when it does not exist or is not visible. */
export async function loadHospitalDetail(db: Db, hospitalId: string, people: Record<string, string> = {}): Promise<HospitalDetail | null> {
  const hospital = await db.from("hospitals").select("*").eq("id", hospitalId).maybeSingle();
  if (hospital.error) throw hospital.error;
  if (!hospital.data) return null;

  const [departments, services, assignments, prices, equipment, costItems, costVersions] = await Promise.all([
    db.from("hospital_departments").select("*").eq("hospital_id", hospitalId).order("sort_order").order("name"),
    db
      .from("hospital_services")
      .select("id, service_id, active, notes, services(name, code, category, description)")
      .eq("hospital_id", hospitalId),
    db.from("hospital_service_departments").select("id, hospital_service_id, department_id, active").eq("hospital_id", hospitalId),
    db.from("service_price_versions").select("*").eq("hospital_id", hospitalId).order("effective_from"),
    db.from("equipment").select("*").eq("hospital_id", hospitalId).order("name"),
    db.from("cost_items").select("*").eq("hospital_id", hospitalId).order("name"),
    db.from("cost_versions").select("*").eq("hospital_id", hospitalId).order("effective_from"),
  ]);
  for (const r of [departments, services, assignments, prices, equipment, costItems, costVersions]) if (r.error) throw r.error;

  const nameOf = (id: string | null) => (id ? (people[id] ?? "Former user") : null);

  const deptDetails: DepartmentDetail[] = departments.data!.map((d) => ({
    id: d.id,
    name: d.name,
    category: pick(DEPARTMENT_CATEGORIES, d.category, "other"),
    beds: d.beds,
    rtCoverage: d.rt_coverage,
    active: d.active,
    notes: d.notes,
    sortOrder: d.sort_order,
  }));

  const serviceDetails: HospitalServiceDetail[] = services
    .data!.map((s) => {
      const lib = s.services;
      const rows = assignments.data!.filter((a) => a.hospital_service_id === s.id);
      return {
        id: s.id,
        serviceId: s.service_id,
        name: lib?.name ?? "Service",
        code: lib?.code ?? null,
        description: lib?.description ?? null,
        category: pick(SERVICE_CATEGORIES, lib?.category, "other"),
        active: s.active,
        notes: s.notes,
        departmentIds: rows.filter((a) => a.active).map((a) => a.department_id),
        assignments: rows.map((a) => ({ id: a.id, departmentId: a.department_id, active: a.active })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const priceVersions: PriceVersion[] = prices.data!.map((p) => ({
    id: p.id,
    hospitalServiceId: p.hospital_service_id,
    amount: Number(p.amount),
    currency: p.currency,
    billingUnit: pick(BILLING_UNITS, p.billing_unit, "custom"),
    effectiveFrom: monthOf(p.effective_from),
    notes: p.notes,
    changeReason: p.change_reason,
    voided: p.voided,
    voidReason: p.void_reason,
    voidedAt: p.voided_at,
    voidedByName: nameOf(p.voided_by),
    createdAt: p.created_at,
    createdByName: nameOf(p.created_by),
  }));

  const costItemDetails: CostItemDetail[] = costItems.data!.map((c) => ({
    id: c.id,
    name: c.name,
    category: pick(COST_CATEGORIES, c.category, "other_recurring"),
    basis: pick(COST_BASES, c.basis, "monthly"),
    unitLabel: c.unit_label,
    hospitalServiceId: c.hospital_service_id,
    departmentId: c.department_id,
    equipmentId: c.equipment_id,
    isRtStaff: c.is_rt_staff,
    active: c.active,
    endedFrom: c.ended_from ? monthOf(c.ended_from) : null,
    notes: c.notes,
  }));

  const costVersionList: CostVersion[] = costVersions.data!.map((v) => ({
    id: v.id,
    costItemId: v.cost_item_id,
    amount: Number(v.amount),
    effectiveFrom: monthOf(v.effective_from),
    notes: v.notes,
    changeReason: v.change_reason,
    voided: v.voided,
    voidReason: v.void_reason,
    voidedAt: v.voided_at,
    voidedByName: nameOf(v.voided_by),
    createdAt: v.created_at,
    createdByName: nameOf(v.created_by),
  }));

  const h = mapHospital(hospital.data);
  return {
    hospital: h,
    config: {
      id: h.id,
      name: h.name,
      code: h.code,
      totalBeds: h.totalBeds,
      currency: h.currency,
      departments: deptDetails,
      services: serviceDetails,
      priceVersions,
      costItems: costItemDetails,
      costVersions: costVersionList,
    },
    departments: deptDetails,
    services: serviceDetails,
    equipment: equipment.data!.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      departmentId: e.department_id,
      quantity: e.quantity,
      ownership: e.ownership,
      acquiredOn: e.acquired_on,
      notes: e.notes,
      active: e.active,
    })),
    costItems: costItemDetails,
  };
}

/**
 * Operating periods with their monthly data. `months` limits the result (e.g.
 * a year or a comparison range); omit it for every period.
 */
export async function loadPeriods(db: Db, hospitalId: string, months?: readonly Month[]): Promise<PeriodRecord[]> {
  let query = db.from("operating_periods").select("*").eq("hospital_id", hospitalId).order("period_month");
  if (months) {
    if (months.length === 0) return [];
    query = query.in(
      "period_month",
      months.map((m) => `${m}-01`),
    );
  }
  const periods = await query;
  if (periods.error) throw periods.error;
  if (periods.data.length === 0) return [];
  const ids = periods.data.map((p) => p.id);

  const [activity, stats, costs, savings] = await Promise.all([
    db.from("service_activity").select("*").in("period_id", ids),
    db.from("period_stats").select("*").in("period_id", ids),
    db.from("period_cost_entries").select("*").in("period_id", ids),
    db.from("period_savings").select("*").in("period_id", ids).order("created_at"),
  ]);
  for (const r of [activity, stats, costs, savings]) if (r.error) throw r.error;

  return periods.data.map((p) => {
    const a = activity.data!.filter((x) => x.period_id === p.id);
    return {
      input: {
        id: p.id,
        month: monthOf(p.period_month),
        status: pick(PERIOD_STATUSES, p.status, "draft") as PeriodStatus,
        activity: a.map((x) => ({ hospitalServiceId: x.hospital_service_id, departmentId: x.department_id, quantity: num(x.quantity) })),
        stats: stats
          .data!.filter((x) => x.period_id === p.id)
          .map((x) => ({
            departmentId: x.department_id,
            patients: x.patients,
            admissions: x.admissions,
            occupiedBedDays: num(x.occupied_bed_days),
            ventilatorDays: num(x.ventilator_days),
          })),
        costEntries: costs.data!.filter((x) => x.period_id === p.id).map((x) => ({ costItemId: x.cost_item_id, quantity: num(x.quantity) })),
        savings: savings
          .data!.filter((x) => x.period_id === p.id)
          .map((x) => ({
            id: x.id,
            category: pick(SAVINGS_CATEGORIES, x.category, "other"),
            description: x.description,
            amount: Number(x.amount),
          })),
      },
      notes: p.notes,
      finalizedAt: p.finalized_at,
      finalizedBy: p.finalized_by,
      lockedAt: p.locked_at,
      lockedBy: p.locked_by,
      createdAt: p.created_at,
      snapshot: p.finalized_snapshot && typeof p.finalized_snapshot === "object" && !Array.isArray(p.finalized_snapshot) ? (p.finalized_snapshot as PeriodRecord["snapshot"]) : null,
      activityIds: Object.fromEntries(a.map((x) => [`${x.hospital_service_id}:${x.department_id ?? ""}`, x.id])),
    };
  });
}

export interface LibraryServiceRow {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly category: ServiceCategory;
  readonly description: string | null;
  readonly active: boolean;
}

/** The organisation's respiratory service library. */
export async function loadServiceLibrary(db: Db): Promise<LibraryServiceRow[]> {
  const { data, error } = await db.from("services").select("id, name, code, category, description, active").order("name");
  if (error) throw error;
  return data.map((s) => ({ ...s, category: pick(SERVICE_CATEGORIES, s.category, "other") as ServiceCategory }));
}
