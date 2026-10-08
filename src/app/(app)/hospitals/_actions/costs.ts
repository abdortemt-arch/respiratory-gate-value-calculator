"use server";

import { COST_BASES, COST_CATEGORIES, EQUIPMENT_CATEGORIES, OWNERSHIP_TYPES, firstDay, isOneOf } from "@/domain/hospital";
import { authorizeHospital, isUuid } from "@/server/hospitals/access";
import { dbError, fail, parseAmount, parseMonth, refreshHospital, text, type ActionResult } from "@/server/hospitals/action-utils";
import { createSupabaseServerClient } from "@/server/supabase/server";

const optionalId = (v: FormDataEntryValue | null): string | null => (typeof v === "string" && isUuid(v) ? v : null);

/**
 * Create a cost item, optionally with its first cost version.
 * Staffing items are costed per FTE per month; the FTE count is entered monthly.
 */
export async function createCostItem(hospitalId: string, form: FormData): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  const name = text(form, "name", 160);
  const category = form.get("category");
  const basis = form.get("basis");
  const unitLabel = text(form, "unitLabel", 40) ?? (category === "staffing" ? "FTE" : basis === "monthly" ? "month" : "unit");
  const hospitalServiceId = optionalId(form.get("hospitalServiceId"));
  if (!name) return fail("Enter the cost item name.");
  if (!isOneOf(COST_CATEGORIES, category)) return fail("Choose a cost category.");
  if (!isOneOf(COST_BASES, basis)) return fail("Choose how the cost is calculated.");
  if (basis === "per_service_unit" && !hospitalServiceId) return fail("Choose the service whose volume drives this cost.");
  const amount = parseAmount(form.get("amount"));
  const month = parseMonth(form.get("effectiveFrom"));
  if (Number.isNaN(amount)) return fail("Enter the cost as a number.");
  if (amount !== undefined && !month) return fail("Choose the month the cost takes effect.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cost_items")
    .insert({
      hospital_id: hospitalId,
      name,
      category,
      basis,
      unit_label: unitLabel,
      hospital_service_id: hospitalServiceId,
      department_id: optionalId(form.get("departmentId")),
      equipment_id: optionalId(form.get("equipmentId")),
      is_rt_staff: category === "staffing" && form.get("isRtStaff") === "on",
      notes: text(form, "notes", 1000),
    })
    .select("id")
    .single();
  if (error) return fail(dbError(error, "Could not add the cost item.", "A cost item with this name already exists."));
  if (amount !== undefined && month) {
    const v = await supabase
      .from("cost_versions")
      .insert({ hospital_id: hospitalId, cost_item_id: data.id, amount, effective_from: firstDay(month), change_reason: text(form, "changeReason", 500) });
    if (v.error) {
      refreshHospital(hospitalId);
      return fail(`The item was added, but its cost was not: ${dbError(v.error, "could not save the cost.")}`);
    }
  }
  refreshHospital(hospitalId);
  return { ok: true, id: data.id };
}

export async function updateCostItem(hospitalId: string, costItemId: string, form: FormData): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(costItemId)) return fail("Unknown cost item.");
  const name = text(form, "name", 160);
  if (!name) return fail("Enter the cost item name.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cost_items")
    .update({ name, notes: text(form, "notes", 1000), department_id: optionalId(form.get("departmentId")) })
    .eq("id", costItemId)
    .eq("hospital_id", hospitalId)
    .select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not save the cost item.", "A cost item with this name already exists."));
  refreshHospital(hospitalId);
  return { ok: true };
}

/** Stop a cost from a month on (kept for history), or resume it. */
export async function setCostItemActive(hospitalId: string, costItemId: string, active: boolean, endedFrom?: string): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(costItemId)) return fail("Unknown cost item.");
  const month = active ? null : parseMonth(endedFrom);
  if (!active && !month) return fail("Choose the first month the cost no longer applies.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cost_items")
    .update({ active, ended_from: month ? firstDay(month) : null })
    .eq("id", costItemId)
    .eq("hospital_id", hospitalId)
    .select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not change the cost item."));
  refreshHospital(hospitalId);
  return { ok: true };
}

/** A new unit cost, monthly amount or cost per FTE from a month on. Earlier months keep theirs. */
export async function addCostVersion(hospitalId: string, form: FormData): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  const costItemId = form.get("costItemId");
  const amount = parseAmount(form.get("amount"));
  const month = parseMonth(form.get("effectiveFrom"));
  if (!isUuid(costItemId)) return fail("Choose a cost item.");
  if (amount === undefined || Number.isNaN(amount)) return fail("Enter the cost as a number.");
  if (!month) return fail("Choose the month the cost takes effect.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cost_versions").insert({
    hospital_id: hospitalId,
    cost_item_id: costItemId,
    amount,
    effective_from: firstDay(month),
    notes: text(form, "notes", 1000),
    change_reason: text(form, "changeReason", 500),
  });
  if (error) return fail(dbError(error, "Could not save the cost.", "This item already has a cost starting that month. Void it first if it was a mistake."));
  refreshHospital(hospitalId);
  return { ok: true };
}

export async function voidCostVersion(hospitalId: string, versionId: string, reason: string): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(versionId)) return fail("Unknown cost.");
  const why = (reason ?? "").trim().slice(0, 500);
  if (why.length < 3) return fail("Give a reason for voiding this cost.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cost_versions")
    .update({ voided: true, void_reason: why })
    .eq("id", versionId)
    .eq("hospital_id", hospitalId)
    .select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not void the cost."));
  refreshHospital(hospitalId);
  return { ok: true };
}

// ── Equipment ────────────────────────────────────────────────────────────────

function equipmentFields(form: FormData) {
  const name = text(form, "name", 160);
  const category = form.get("category") ?? "other";
  const ownership = form.get("ownership") ?? "owned";
  const quantity = parseAmount(form.get("quantity"));
  if (!name) return { error: "Enter the equipment name." } as const;
  if (!isOneOf(EQUIPMENT_CATEGORIES, category)) return { error: "Choose an equipment type." } as const;
  if (!isOneOf(OWNERSHIP_TYPES, ownership)) return { error: "Choose the ownership." } as const;
  if (quantity === undefined || Number.isNaN(quantity) || !Number.isInteger(quantity)) return { error: "Quantity is a whole number." } as const;
  const acquired = text(form, "acquiredOn", 10);
  return {
    values: {
      name,
      category,
      ownership,
      quantity,
      department_id: optionalId(form.get("departmentId")),
      acquired_on: acquired && /^\d{4}-\d{2}-\d{2}$/.test(acquired) ? acquired : null,
      notes: text(form, "notes", 1000),
    },
  } as const;
}

export async function createEquipment(hospitalId: string, form: FormData): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  const parsed = equipmentFields(form);
  if ("error" in parsed) return fail(parsed.error!);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("equipment").insert({ ...parsed.values, hospital_id: hospitalId }).select("id").single();
  if (error) return fail(dbError(error, "Could not add the equipment."));
  refreshHospital(hospitalId);
  return { ok: true, id: data.id };
}

export async function updateEquipment(hospitalId: string, equipmentId: string, form: FormData): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(equipmentId)) return fail("Unknown equipment.");
  const parsed = equipmentFields(form);
  if ("error" in parsed) return fail(parsed.error!);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("equipment").update(parsed.values).eq("id", equipmentId).eq("hospital_id", hospitalId).select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not save the equipment."));
  refreshHospital(hospitalId);
  return { ok: true };
}

export async function setEquipmentActive(hospitalId: string, equipmentId: string, active: boolean): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(equipmentId)) return fail("Unknown equipment.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("equipment").update({ active }).eq("id", equipmentId).eq("hospital_id", hospitalId).select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not change the equipment."));
  refreshHospital(hospitalId);
  return { ok: true };
}
