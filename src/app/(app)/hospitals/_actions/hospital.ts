"use server";

import { revalidatePath } from "next/cache";
import { HOSPITAL_TYPES, isOneOf } from "@/domain/hospital";
import { authorize } from "@/server/auth/session";
import { authorizeHospital, isUuid } from "@/server/hospitals/access";
import { dbError, fail, parseAmount, refreshHospital, text, type ActionResult } from "@/server/hospitals/action-utils";
import { createSupabaseServerClient } from "@/server/supabase/server";

const CODE = /^[A-Z0-9][A-Z0-9_-]{0,19}$/;

interface HospitalFields {
  name: string;
  code: string;
  hospital_type: string | null;
  total_beds: number | null;
  location: string | null;
  notes: string | null;
}

function hospitalFields(form: FormData): { values: HospitalFields } | { error: string } {
  const name = text(form, "name", 160);
  const code = (text(form, "code", 40) ?? "").toUpperCase();
  const type = text(form, "hospitalType");
  const beds = parseAmount(form.get("totalBeds"));
  if (!name || name.length < 2) return { error: "Enter the hospital name." };
  if (!CODE.test(code)) return { error: "Use a short code of letters, digits, - or _ (up to 20), e.g. HOSP-A." };
  if (type && !isOneOf(HOSPITAL_TYPES, type)) return { error: "Choose a hospital type." };
  if (Number.isNaN(beds) || (beds !== undefined && !Number.isInteger(beds))) return { error: "Total beds must be a whole number." };
  return {
    values: {
      name,
      code,
      hospital_type: type,
      total_beds: beds ?? null,
      location: text(form, "location", 200),
      notes: text(form, "notes", 2000),
    },
  };
}

/** Step 1 of onboarding (Admin). */
export async function createHospital(form: FormData): Promise<ActionResult> {
  const auth = await authorize("manage_hospitals");
  if (!auth.ok) return fail(auth.error);
  const parsed = hospitalFields(form);
  if ("error" in parsed) return fail(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hospitals")
    .insert({
      ...parsed.values,
      organization_id: auth.user.organizationId,
      // The form sends a hidden "off" fallback before the checkbox's "on".
      active: form.getAll("active").includes("on"),
    })
    .select("id")
    .single();
  if (error) return fail(dbError(error, "Could not create the hospital.", "A hospital with this name or code already exists."));
  revalidatePath("/", "layout");
  return { ok: true, id: data.id };
}

export async function updateHospital(hospitalId: string, form: FormData): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "manage_hospitals");
  if (!auth.ok) return fail(auth.error);
  const parsed = hospitalFields(form);
  if ("error" in parsed) return fail(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("hospitals").update(parsed.values).eq("id", hospitalId).select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not save the hospital.", "A hospital with this name or code already exists."));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Deactivate instead of delete: history stays available. */
export async function setHospitalActive(hospitalId: string, active: boolean): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "manage_hospitals");
  if (!auth.ok) return fail(auth.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("hospitals").update({ active }).eq("id", hospitalId).select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not change the hospital status."));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Attach the Elite / Workbook Value Model to a hospital (Admin). */
export async function enableWorkbookModel(hospitalId: string): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "manage_hospitals");
  if (!auth.ok) return fail(auth.error);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("enable_workbook_model", { p_hospital: hospitalId });
  if (error) return fail(dbError(error, "Could not enable the workbook model."));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addMember(hospitalId: string, form: FormData): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "manage_users");
  if (!auth.ok) return fail(auth.error);
  const userId = form.get("userId");
  const role = form.get("role") === "viewer" ? "viewer" : "manager";
  if (!isUuid(userId)) return fail("Choose a person.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("hospital_members").upsert({ hospital_id: hospitalId, user_id: userId, role, active: true }, { onConflict: "hospital_id,user_id" });
  if (error) return fail(dbError(error, "Could not give access."));
  refreshHospital(hospitalId);
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateMember(hospitalId: string, memberId: string, change: { role?: string; active?: boolean }): Promise<ActionResult> {
  const auth = await authorizeHospital(hospitalId, "manage_users");
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(memberId)) return fail("Unknown member.");
  const update: { role?: "manager" | "viewer"; active?: boolean } = {};
  if (change.role === "manager" || change.role === "viewer") update.role = change.role;
  if (typeof change.active === "boolean") update.active = change.active;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("hospital_members").update(update).eq("id", memberId).eq("hospital_id", hospitalId).select("id");
  if (error || !data?.length) return fail(dbError(error, "Could not change access."));
  refreshHospital(hospitalId);
  revalidatePath("/settings");
  return { ok: true };
}
