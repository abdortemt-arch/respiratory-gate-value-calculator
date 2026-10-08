import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { can, hospitalRole, type Permission, type StaffRole } from "@/domain/access";
import { authorize, requireUser, type SessionUser } from "../auth/session";
import { createSupabaseServerClient } from "../supabase/server";
import { listHospitals, mapHospital, type HospitalSummaryRow } from "./repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export interface HospitalContext {
  readonly user: SessionUser;
  readonly hospital: HospitalSummaryRow;
  /** The user's role in this hospital. */
  readonly role: StaffRole;
  /** Managers cannot change an inactive hospital (the database enforces the same). */
  readonly canWrite: boolean;
}

/** The hospital and the caller's role in it, or null when it is not visible. Memoised per request. */
export const loadHospitalContext = cache(async (user: SessionUser, hospitalId: string): Promise<HospitalContext | null> => {
  if (!isUuid(hospitalId)) return null;
  const supabase = await createSupabaseServerClient();
  const [hospital, membership] = await Promise.all([
    supabase.from("hospitals").select("*").eq("id", hospitalId).maybeSingle(),
    supabase.from("hospital_members").select("role, active").eq("hospital_id", hospitalId).eq("user_id", user.userId).maybeSingle(),
  ]);
  if (hospital.error) throw hospital.error;
  if (!hospital.data) return null;
  const m = membership.data;
  const role = hospitalRole(user.role, m && (m.role === "manager" || m.role === "viewer") ? { role: m.role, active: m.active } : null);
  if (!role) return null;
  const h = mapHospital(hospital.data);
  return { user, hospital: h, role, canWrite: role === "admin" || (role === "manager" && h.active) };
});

/** Whether the caller may do `permission` in this hospital. */
export function canInHospital(ctx: HospitalContext, permission: Permission): boolean {
  if (!can(ctx.role, permission)) return false;
  const writes: readonly Permission[] = [
    "edit_hospital_inputs",
    "edit_hospital_config",
    "enter_period_data",
    "finalize_periods",
    "save_scenarios",
  ];
  return writes.includes(permission) ? ctx.canWrite : true;
}

/** For pages: 404 for hospitals the user cannot see; back to the hospital for missing permissions. */
export async function requireHospital(hospitalId: string, permission: Permission = "view_dashboards"): Promise<HospitalContext> {
  const user = await requireUser();
  const ctx = await loadHospitalContext(user, hospitalId);
  if (!ctx) notFound();
  if (!canInHospital(ctx, permission)) redirect(`/hospitals/${hospitalId}?denied=1`);
  return ctx;
}

export type HospitalAuthorized = { readonly ok: true; readonly ctx: HospitalContext } | { readonly ok: false; readonly error: string };

/** For Server Actions: re-check the session and the caller's role in the hospital. */
export async function authorizeHospital(hospitalId: unknown, permission: Permission): Promise<HospitalAuthorized> {
  const auth = await authorize("view_dashboards");
  if (!auth.ok) return auth;
  if (!isUuid(hospitalId)) return { ok: false, error: "Unknown hospital." };
  const ctx = await loadHospitalContext(auth.user, hospitalId);
  if (!ctx) return { ok: false, error: "Unknown hospital." };
  if (!canInHospital(ctx, permission)) {
    return {
      ok: false,
      error: ctx.canWrite || ctx.role === "viewer" ? "Your role does not allow this change." : "This hospital is inactive. Ask an Admin to reactivate it.",
    };
  }
  return { ok: true, ctx };
}

/** Hospitals visible to the caller (RLS applies). Memoised per request. */
export const loadVisibleHospitals = cache(async (): Promise<HospitalSummaryRow[]> => {
  const supabase = await createSupabaseServerClient();
  return listHospitals(supabase);
});

/** The hospital that opens by default for the Workbook Value Model. */
export async function defaultWorkbookHospital(): Promise<HospitalSummaryRow | null> {
  const hospitals = await loadVisibleHospitals();
  const enabled = hospitals.filter((h) => h.workbookModelEnabled);
  return enabled.find((h) => h.active) ?? enabled[0] ?? null;
}

export interface HospitalWithRole extends HospitalSummaryRow {
  readonly role: StaffRole;
}

/** Visible hospitals with the caller's role in each (for navigation and the portfolio). Memoised per request. */
export const loadHospitalsWithRoles = cache(async (user: SessionUser): Promise<HospitalWithRole[]> => {
  const hospitals = await loadVisibleHospitals();
  if (user.role === "admin") return hospitals.map((h) => ({ ...h, role: "admin" as const }));
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("hospital_members").select("hospital_id, role, active").eq("user_id", user.userId);
  const byHospital = new Map((data ?? []).map((m) => [m.hospital_id, m]));
  return hospitals.flatMap((h) => {
    const m = byHospital.get(h.id);
    const role = hospitalRole(user.role, m && (m.role === "manager" || m.role === "viewer") ? { role: m.role, active: m.active } : null);
    return role ? [{ ...h, role }] : [];
  });
});
