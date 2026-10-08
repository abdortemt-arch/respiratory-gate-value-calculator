"use server";

import { BILLING_UNITS, DEPARTMENT_CATEGORIES, SERVICE_CATEGORIES, firstDay, isOneOf } from "@/domain/hospital";
import { authorizeHospital, isUuid } from "@/server/hospitals/access";
import { dbError, fail, parseAmount, parseMonth, refreshHospital, text, type ActionResult } from "@/server/hospitals/action-utils";
import { createSupabaseServerClient } from "@/server/supabase/server";

// ── Departments ──────────────────────────────────────────────────────────────

function departmentFields(form: FormData) {
  const name = text(form, "name", 120);
  const category = text(form, "category") ?? "other";
  const beds = parseAmount(form.get("beds"));
  if (!name) return { error: "Enter the department name." } as const;
  if (!isOneOf(DEPARTMENT_CATEGORIES, category)) return { error: "Choose a department type." } as const;
  if (Number.isNaN(beds) || (beds !== undefined && !Number.isInteger(beds))) return { error: "Beds must be a whole number." } as const;
  return {
    values: {
      name,
      category,
      beds: beds ?? null,
      rt_coverage: form.get("rtCoverage") === "on",
      notes: text(form, "notes", 1000),
    },
  } as const;
}

export async function createDepartment(hospitalId: string, form: FormData): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  const parsed = departmentFields(form);
  if ("error" in parsed) return fail(parsed.error!);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hospital_departments")
    .insert({ ...parsed.values, hospital_id: hospitalId })
    .select("id")
    .single();
  if (error) return fail(dbError(error, "Could not add the department.", "A department with this name already exists."));
  refreshHospital(hospitalId);
  return { ok: true, id: data.id };
}

export async function updateDepartment(hospitalId: string, departmentId: string, form: FormData): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(departmentId)) return fail("Unknown department.");
  const parsed = departmentFields(form);
  if ("error" in parsed) return fail(parsed.error!);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hospital_departments")
    .update(parsed.values)
    .eq("id", departmentId)
    .eq("hospital_id", hospitalId)
    .select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not save the department.", "A department with this name already exists."));
  refreshHospital(hospitalId);
  return { ok: true };
}

/** Departments are deactivated, never deleted: their history stays reportable. */
export async function setDepartmentActive(hospitalId: string, departmentId: string, active: boolean): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(departmentId)) return fail("Unknown department.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hospital_departments")
    .update({ active })
    .eq("id", departmentId)
    .eq("hospital_id", hospitalId)
    .select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not change the department."));
  refreshHospital(hospitalId);
  return { ok: true };
}

// ── Services ─────────────────────────────────────────────────────────────────

async function syncAssignments(hospitalId: string, hospitalServiceId: string, departmentIds: readonly string[]): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data: departments }, { data: rows }] = await Promise.all([
    supabase.from("hospital_departments").select("id").eq("hospital_id", hospitalId),
    supabase.from("hospital_service_departments").select("id, department_id, active").eq("hospital_service_id", hospitalServiceId),
  ]);
  const valid = new Set((departments ?? []).map((d) => d.id));
  const wanted = new Set(departmentIds.filter((id) => valid.has(id)));
  const existing = new Map((rows ?? []).map((r) => [r.department_id, r]));
  const inserts = [...wanted].filter((id) => !existing.has(id)).map((department_id) => ({ hospital_id: hospitalId, hospital_service_id: hospitalServiceId, department_id }));
  if (inserts.length) {
    const { error } = await supabase.from("hospital_service_departments").insert(inserts);
    if (error) return dbError(error, "Could not assign the service to departments.");
  }
  for (const [departmentId, row] of existing) {
    const active = wanted.has(departmentId);
    if (row.active !== active) {
      const { error } = await supabase.from("hospital_service_departments").update({ active }).eq("id", row.id);
      if (error) return dbError(error, "Could not update the department assignment.");
    }
  }
  return null;
}

/**
 * Add a service to a hospital: from the organisation's library, or a new
 * custom service (which joins the library so hospitals can be compared).
 */
export async function addHospitalService(hospitalId: string, form: FormData): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  const supabase = await createSupabaseServerClient();
  let serviceId = form.get("serviceId");
  if (serviceId === "custom" || !serviceId) {
    const name = text(form, "customName", 120);
    const category = text(form, "customCategory") ?? "other";
    if (!name) return fail("Enter the name of the custom service.");
    if (!isOneOf(SERVICE_CATEGORIES, category)) return fail("Choose a service category.");
    const { data: existing } = await supabase
      .from("services")
      .select("id")
      .ilike("name", name.replace(/[\\%_]/g, (c) => `\\${c}`))
      .maybeSingle();
    if (existing) serviceId = existing.id;
    else {
      const { data, error } = await supabase
        .from("services")
        .insert({ organization_id: auth.ctx.user.organizationId, name, category, description: text(form, "customDescription", 1000) })
        .select("id")
        .single();
      if (error) return fail(dbError(error, "Could not create the service.", "A service with this name already exists."));
      serviceId = data.id;
    }
  }
  if (!isUuid(serviceId)) return fail("Choose a service.");

  const { data: current } = await supabase.from("hospital_services").select("id, active").eq("hospital_id", hospitalId).eq("service_id", serviceId).maybeSingle();
  let hospitalServiceId: string;
  if (current) {
    if (current.active) return fail("This hospital already provides that service.");
    const { error } = await supabase.from("hospital_services").update({ active: true }).eq("id", current.id);
    if (error) return fail(dbError(error, "Could not reactivate the service."));
    hospitalServiceId = current.id;
  } else {
    const { data, error } = await supabase
      .from("hospital_services")
      .insert({ organization_id: auth.ctx.user.organizationId, hospital_id: hospitalId, service_id: serviceId, notes: text(form, "notes", 1000) })
      .select("id")
      .single();
    if (error) return fail(dbError(error, "Could not add the service.", "This hospital already provides that service."));
    hospitalServiceId = data.id;
  }
  const departments = form.getAll("departmentIds").filter((v): v is string => typeof v === "string" && isUuid(v));
  if (departments.length) {
    const err = await syncAssignments(hospitalId, hospitalServiceId, departments);
    if (err) return fail(err);
  }
  refreshHospital(hospitalId);
  return { ok: true, id: hospitalServiceId };
}

/** Set exactly which departments provide a service (assignments are deactivated, not deleted). */
export async function setServiceDepartments(hospitalId: string, hospitalServiceId: string, departmentIds: string[]): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(hospitalServiceId) || !Array.isArray(departmentIds)) return fail("Unknown service.");
  const err = await syncAssignments(hospitalId, hospitalServiceId, departmentIds.filter(isUuid));
  if (err) return fail(err);
  refreshHospital(hospitalId);
  return { ok: true };
}

export async function setHospitalServiceActive(hospitalId: string, hospitalServiceId: string, active: boolean): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(hospitalServiceId)) return fail("Unknown service.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hospital_services")
    .update({ active })
    .eq("id", hospitalServiceId)
    .eq("hospital_id", hospitalId)
    .select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not change the service."));
  refreshHospital(hospitalId);
  return { ok: true };
}

// ── Prices (effective-dated versions) ───────────────────────────────────────

/** Record a new price from a month on. Earlier months keep their own prices. */
export async function addPriceVersion(hospitalId: string, form: FormData): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  const hospitalServiceId = form.get("hospitalServiceId");
  const amount = parseAmount(form.get("amount"));
  const unit = form.get("billingUnit");
  const month = parseMonth(form.get("effectiveFrom"));
  const currency = (text(form, "currency", 3) ?? auth.ctx.hospital.currency).toUpperCase();
  if (!isUuid(hospitalServiceId)) return fail("Choose a service.");
  if (amount === undefined || Number.isNaN(amount)) return fail("Enter the price as a number, e.g. 1500.");
  if (!isOneOf(BILLING_UNITS, unit)) return fail("Choose how the service is billed.");
  if (unit === "percentage" && amount > 100) return fail("A percentage cannot exceed 100.");
  if (!month) return fail("Choose the month the price takes effect.");
  if (!/^[A-Z]{3}$/.test(currency)) return fail("Use a three-letter currency code, e.g. EGP.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_price_versions")
    .insert({
      hospital_id: hospitalId,
      hospital_service_id: hospitalServiceId,
      amount,
      currency,
      billing_unit: unit,
      effective_from: firstDay(month),
      notes: text(form, "notes", 1000),
      change_reason: text(form, "changeReason", 500),
    })
    .select("id")
    .single();
  if (error) {
    return fail(
      dbError(error, "Could not save the price.", "This service already has a price starting that month. Void it first if it was entered by mistake."),
    );
  }
  refreshHospital(hospitalId);
  return { ok: true, id: data.id };
}

/** Void a price entered by mistake. The record stays visible in the history with its reason. */
export async function voidPriceVersion(hospitalId: string, versionId: string, reason: string): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "edit_hospital_config");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(versionId)) return fail("Unknown price.");
  const why = (reason ?? "").trim().slice(0, 500);
  if (why.length < 3) return fail("Give a reason for voiding this price.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_price_versions")
    .update({ voided: true, void_reason: why })
    .eq("id", versionId)
    .eq("hospital_id", hospitalId)
    .select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not void the price."));
  refreshHospital(hospitalId);
  return { ok: true };
}
