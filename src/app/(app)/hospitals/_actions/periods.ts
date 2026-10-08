"use server";

import { calculatePeriod, firstDay, isOneOf, PERIOD_STATUSES, SAVINGS_CATEGORIES, type PeriodStatus } from "@/domain/hospital";
import { authorizeHospital, isUuid } from "@/server/hospitals/access";
import { dbError, fail, parseAmount, parseMonth, refreshHospital, text, type ActionResult } from "@/server/hospitals/action-utils";
import { loadHospitalDetail, loadPeriods } from "@/server/hospitals/repository";
import { createSupabaseServerClient } from "@/server/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function periodOf(supabase: Supabase, hospitalId: string, periodId: string) {
  if (!isUuid(periodId)) return null;
  const { data } = await supabase.from("operating_periods").select("id, status, period_month").eq("id", periodId).eq("hospital_id", hospitalId).maybeSingle();
  return data;
}

/** Closed periods accept only Admin corrections with a reason (the database enforces the same). */
function correctionCheck(status: string, role: string, reason: string | null): string | null {
  if (status !== "finalized" && status !== "locked") return null;
  if (role !== "admin") return `This period is ${PERIOD_STATUSES[status as PeriodStatus].toLowerCase()}. Only an Admin can correct it.`;
  if (!reason || reason.trim().length < 3) return "Give a reason for this correction.";
  return null;
}

const cleanReason = (r: unknown) => (typeof r === "string" && r.trim() ? r.trim().slice(0, 500) : null);

export async function createPeriod(hospitalId: string, month: string): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "enter_period_data");
  if (!auth.ok) return fail(auth.error);
  const m = parseMonth(month);
  if (!m) return fail("Choose a month.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("operating_periods").insert({ hospital_id: hospitalId, period_month: firstDay(m) }).select("id").single();
  if (error) return fail(dbError(error, "Could not create the period.", "This month already has a period."));
  refreshHospital(hospitalId);
  return { ok: true, id: data.id };
}

export interface ActivityChange {
  readonly hospitalServiceId: string;
  readonly departmentId: string | null;
  /** Blank = not entered. */
  readonly quantity: string;
}

/** Save the month's service volumes (only the changed cells are sent). */
export async function saveActivity(hospitalId: string, periodId: string, changes: ActivityChange[], reason?: string): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "enter_period_data");
  if (!auth.ok) return fail(auth.error);
  const supabase = await createSupabaseServerClient();
  const period = await periodOf(supabase, hospitalId, periodId);
  if (!period) return fail("Unknown period.");
  const why = cleanReason(reason);
  const blocked = correctionCheck(period.status, auth.ctx.role, why);
  if (blocked) return fail(blocked);
  if (!Array.isArray(changes) || changes.length > 500) return fail("Nothing to save.");

  const { data: existing } = await supabase.from("service_activity").select("id, hospital_service_id, department_id").eq("period_id", periodId);
  const slot = (s: string, d: string | null) => `${s}:${d ?? ""}`;
  const rows = new Map((existing ?? []).map((r) => [slot(r.hospital_service_id, r.department_id), r.id]));
  for (const c of changes) {
    if (!isUuid(c.hospitalServiceId) || (c.departmentId !== null && !isUuid(c.departmentId))) return fail("Unknown service or department.");
    const q = parseAmount(c.quantity);
    if (Number.isNaN(q)) return fail("Volumes must be zero or positive numbers.");
    const quantity = q ?? null;
    const id = rows.get(slot(c.hospitalServiceId, c.departmentId));
    const { error } = id
      ? await supabase.from("service_activity").update({ quantity, change_reason: why }).eq("id", id)
      : await supabase
          .from("service_activity")
          .insert({ hospital_id: hospitalId, period_id: periodId, hospital_service_id: c.hospitalServiceId, department_id: c.departmentId, quantity, change_reason: why });
    if (error) return fail(dbError(error, "Could not save the volumes."));
  }
  refreshHospital(hospitalId);
  return { ok: true };
}

export interface StatsChange {
  readonly departmentId: string | null;
  readonly patients: string;
  readonly admissions: string;
  readonly occupiedBedDays: string;
  readonly ventilatorDays: string;
}

export async function saveStats(hospitalId: string, periodId: string, changes: StatsChange[], reason?: string): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "enter_period_data");
  if (!auth.ok) return fail(auth.error);
  const supabase = await createSupabaseServerClient();
  const period = await periodOf(supabase, hospitalId, periodId);
  if (!period) return fail("Unknown period.");
  const why = cleanReason(reason);
  const blocked = correctionCheck(period.status, auth.ctx.role, why);
  if (blocked) return fail(blocked);

  const { data: existing } = await supabase.from("period_stats").select("id, department_id").eq("period_id", periodId);
  const rows = new Map((existing ?? []).map((r) => [r.department_id ?? "", r.id]));
  for (const c of changes ?? []) {
    if (c.departmentId !== null && !isUuid(c.departmentId)) return fail("Unknown department.");
    const values = [c.patients, c.admissions, c.occupiedBedDays, c.ventilatorDays].map(parseAmount);
    if (values.some((v) => Number.isNaN(v))) return fail("Statistics must be zero or positive numbers.");
    const [patients, admissions, occupied, vent] = values;
    if ((patients !== undefined && !Number.isInteger(patients)) || (admissions !== undefined && !Number.isInteger(admissions))) {
      return fail("Patients and admissions are whole numbers.");
    }
    const record = {
      patients: patients ?? null,
      admissions: admissions ?? null,
      occupied_bed_days: occupied ?? null,
      ventilator_days: vent ?? null,
      change_reason: why,
    };
    const id = rows.get(c.departmentId ?? "");
    const { error } = id
      ? await supabase.from("period_stats").update(record).eq("id", id)
      : await supabase.from("period_stats").insert({ ...record, hospital_id: hospitalId, period_id: periodId, department_id: c.departmentId });
    if (error) return fail(dbError(error, "Could not save the statistics."));
  }
  refreshHospital(hospitalId);
  return { ok: true };
}

export interface CostQuantityChange {
  readonly costItemId: string;
  readonly quantity: string;
}

/** Quantities for per-unit cost items (consumables used, FTEs employed). */
export async function saveCostQuantities(hospitalId: string, periodId: string, changes: CostQuantityChange[], reason?: string): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "enter_period_data");
  if (!auth.ok) return fail(auth.error);
  const supabase = await createSupabaseServerClient();
  const period = await periodOf(supabase, hospitalId, periodId);
  if (!period) return fail("Unknown period.");
  const why = cleanReason(reason);
  const blocked = correctionCheck(period.status, auth.ctx.role, why);
  if (blocked) return fail(blocked);

  const { data: existing } = await supabase.from("period_cost_entries").select("id, cost_item_id").eq("period_id", periodId);
  const rows = new Map((existing ?? []).map((r) => [r.cost_item_id, r.id]));
  for (const c of changes ?? []) {
    if (!isUuid(c.costItemId)) return fail("Unknown cost item.");
    const q = parseAmount(c.quantity);
    if (Number.isNaN(q)) return fail("Quantities must be zero or positive numbers.");
    const id = rows.get(c.costItemId);
    const { error } = id
      ? await supabase.from("period_cost_entries").update({ quantity: q ?? null, change_reason: why }).eq("id", id)
      : await supabase
          .from("period_cost_entries")
          .insert({ hospital_id: hospitalId, period_id: periodId, cost_item_id: c.costItemId, quantity: q ?? null, change_reason: why });
    if (error) return fail(dbError(error, "Could not save the quantities."));
  }
  refreshHospital(hospitalId);
  return { ok: true };
}

/** Documented (realised) cost avoidance for the month. */
export async function addSavings(hospitalId: string, periodId: string, form: FormData): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "enter_period_data");
  if (!auth.ok) return fail(auth.error);
  const supabase = await createSupabaseServerClient();
  const period = await periodOf(supabase, hospitalId, periodId);
  if (!period) return fail("Unknown period.");
  const why = cleanReason(form.get("changeReason"));
  const blocked = correctionCheck(period.status, auth.ctx.role, why);
  if (blocked) return fail(blocked);
  const category = form.get("category");
  const description = text(form, "description", 300);
  const amount = parseAmount(form.get("amount"));
  if (!isOneOf(SAVINGS_CATEGORIES, category)) return fail("Choose a savings category.");
  if (!description || description.length < 2) return fail("Describe the documented saving.");
  if (amount === undefined || Number.isNaN(amount)) return fail("Enter the amount saved.");
  const { error } = await supabase
    .from("period_savings")
    .insert({ hospital_id: hospitalId, period_id: periodId, category, description, amount, change_reason: why });
  if (error) return fail(dbError(error, "Could not add the saving."));
  refreshHospital(hospitalId);
  return { ok: true };
}

/** Remove a saving recorded by mistake (draft or in-review periods only). */
export async function removeSavings(hospitalId: string, savingsId: string): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "enter_period_data");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(savingsId)) return fail("Unknown saving.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("period_savings").delete().eq("id", savingsId).eq("hospital_id", hospitalId).select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not remove the saving."));
  refreshHospital(hospitalId);
  return { ok: true };
}

export async function updatePeriodNotes(hospitalId: string, periodId: string, notes: string): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "enter_period_data");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(periodId)) return fail("Unknown period.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operating_periods")
    .update({ notes: notes.trim().slice(0, 2000) || null })
    .eq("id", periodId)
    .eq("hospital_id", hospitalId)
    .select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not save the notes."));
  refreshHospital(hospitalId);
  return { ok: true };
}

/**
 * Move a period through Draft → In review → Finalized → Locked. Finalizing
 * stores the calculated results as a snapshot; locking, unlocking and
 * reopening are Admin-only, and unlocking or reopening needs a reason.
 */
export async function setPeriodStatus(hospitalId: string, periodId: string, status: string, reason?: string): Promise<ActionResult> {
  const needed = status === "locked" ? "lock_periods" : "finalize_periods";
  const auth = await authorizeHospital(hospitalId, needed);
  if (!auth.ok) return fail(auth.error);
  if (!isOneOf(PERIOD_STATUSES, status)) return fail("Unknown status.");
  const supabase = await createSupabaseServerClient();
  const period = await periodOf(supabase, hospitalId, periodId);
  if (!period) return fail("Unknown period.");

  let snapshot: Record<string, unknown> | null = null;
  if (status === "finalized" || status === "locked") {
    const [detail, periods] = await Promise.all([
      loadHospitalDetail(supabase, hospitalId),
      loadPeriods(supabase, hospitalId, [period.period_month.slice(0, 7)]),
    ]);
    if (detail && periods[0]) {
      const s = calculatePeriod(detail.config, periods[0].input);
      snapshot = {
        calculatedAt: new Date().toISOString(),
        revenue: s.revenue.value,
        costs: s.costs.value,
        savings: s.savings.value,
        net: s.net.value,
        status: { revenue: s.revenue.status, costs: s.costs.status, net: s.net.status },
        services: s.services.map((x) => ({ id: x.hospitalServiceId, name: x.name, volume: x.volume, price: x.price, billingUnit: x.billingUnit, revenue: x.revenue.value })),
        costLines: s.costLines.map((c) => ({ id: c.costItemId, name: c.name, quantity: c.quantity, unitCost: c.unitCost, amount: c.amount.value })),
      };
    }
  }
  const { error } = await supabase.rpc("set_period_status", {
    p_period: periodId,
    p_status: status,
    p_reason: cleanReason(reason) ?? undefined,
    p_snapshot: snapshot ? JSON.parse(JSON.stringify(snapshot)) : undefined,
  });
  if (error) return fail(dbError(error, "Could not change the period status."));
  refreshHospital(hospitalId);
  return { ok: true };
}
