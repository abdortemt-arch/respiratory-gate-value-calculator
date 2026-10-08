"use server";

import { revalidatePath } from "next/cache";
import { isStaffRole, type AppRole } from "@/domain/access";
import { parseInputText } from "@/domain/calculations/validation";
import { requestOrigin } from "@/server/auth/redirects";
import { authorize } from "@/server/auth/session";
import { temporaryPassword } from "@/server/auth/temporary-password";
import { createSupabaseAdminClient, isAdminClientConfigured } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

export interface ActionResult {
  readonly ok: boolean;
  readonly error?: string;
  /** Shown once to the Admin; never stored or logged. */
  readonly temporaryPassword?: string;
}

const UUID = /^[0-9a-f-]{36}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function dbError(message: string | undefined, fallback: string): string {
  return message?.includes("At least one active Admin") ? "At least one active Admin is required." : fallback;
}

/** Create a user with a temporary password (default) or an email invitation. */
export async function createUser(formData: FormData): Promise<ActionResult> {
  const auth = await authorize("manage_users");
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!isAdminClientConfigured()) return { ok: false, error: "Set SUPABASE_SERVICE_ROLE_KEY on the server to manage users." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "viewer") as AppRole;
  const method = formData.get("method") === "invite" ? "invite" : "temporary_password";
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (fullName.length < 2 || fullName.length > 120) return { ok: false, error: "Enter the person's full name." };
  if (!isStaffRole(role)) return { ok: false, error: "Choose Admin, Hospital Manager / Finance or Viewer." };

  const admin = createSupabaseAdminClient();
  let userId: string;
  let password: string | undefined;
  if (method === "invite") {
    const origin = await requestOrigin();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=/account/set-password`,
      data: { full_name: fullName },
    });
    if (error) return { ok: false, error: `Could not send the invitation: ${error.message}` };
    userId = data.user.id;
  } else {
    password = temporaryPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { must_change_password: true },
      user_metadata: { full_name: fullName },
    });
    if (error) {
      return { ok: false, error: error.code === "email_exists" ? "An account with this email already exists." : error.message };
    }
    userId = data.user.id;
  }

  // Insert the profile as the Admin (RLS-checked, audited with their name).
  const supabase = await createSupabaseServerClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ user_id: userId, organization_id: auth.user.organizationId, full_name: fullName, role });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "Could not create the profile." };
  }
  revalidatePath("/settings");
  return { ok: true, temporaryPassword: password };
}

export async function updateUserRole(profileId: string, role: string): Promise<ActionResult> {
  const auth = await authorize("manage_users");
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!UUID.test(profileId) || !isStaffRole(role as AppRole)) return { ok: false, error: "Invalid request." };
  if (profileId === auth.user.profileId) return { ok: false, error: "You cannot change your own role." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: role as AppRole })
    .eq("id", profileId)
    .eq("organization_id", auth.user.organizationId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: dbError(error?.message, "Could not change the role.") };
  revalidatePath("/settings");
  return { ok: true };
}

export async function setUserActive(profileId: string, active: boolean): Promise<ActionResult> {
  const auth = await authorize("manage_users");
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!UUID.test(profileId)) return { ok: false, error: "Invalid request." };
  if (profileId === auth.user.profileId) return { ok: false, error: "You cannot deactivate your own account." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", profileId)
    .eq("organization_id", auth.user.organizationId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: dbError(error?.message, "Could not change access.") };
  revalidatePath("/settings");
  return { ok: true };
}

/** Issue a new temporary password; the user must replace it at next sign-in. */
export async function resetUserPassword(profileId: string): Promise<ActionResult> {
  const auth = await authorize("manage_users");
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!isAdminClientConfigured()) return { ok: false, error: "Set SUPABASE_SERVICE_ROLE_KEY on the server to manage users." };
  if (!UUID.test(profileId)) return { ok: false, error: "Invalid request." };
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .eq("organization_id", auth.user.organizationId)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Unknown user." };

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(profile.user_id);
  const password = temporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(profile.user_id, {
    password,
    app_metadata: { ...(existing?.user?.app_metadata ?? {}), must_change_password: true },
  });
  if (error) return { ok: false, error: "Could not reset the password." };
  return { ok: true, temporaryPassword: password };
}

export async function updateOrganizationName(name: string): Promise<ActionResult> {
  const auth = await authorize("manage_organization");
  if (!auth.ok) return { ok: false, error: auth.error };
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 120) return { ok: false, error: "Use a name of 2–120 characters." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({ name: trimmed })
    .eq("id", auth.user.organizationId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Could not rename the organisation." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Low / Mid / High savings sensitivities of the default scenario (Admin). Entered as percent. */
export async function updateSensitivities(low: string, mid: string, high: string): Promise<ActionResult> {
  const auth = await authorize("edit_assumptions");
  if (!auth.ok) return { ok: false, error: auth.error };
  const percentDef = {
    key: "sensitivity",
    label: "Sensitivity",
    unit: "%",
    group: "model_assumptions",
    owner: "Respiratory Gate",
    source: "rg_assumption",
    kind: "percent",
    usage: "model",
    workbookCell: "Savings Scenarios!D5:F5",
    defaultValue: null,
  } as const;
  const parsed = [low, mid, high].map((v) => parseInputText(percentDef, v));
  const bad = parsed.find((p) => !p.ok);
  if (bad && !bad.ok) return { ok: false, error: bad.error };
  const [l, m, h] = parsed.map((p) => (p.ok ? (p.value as number) : 0));
  if (!(l <= m && m <= h)) return { ok: false, error: "Use Low ≤ Mid ≤ High." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scenario_assumptions")
    .update({ low_savings_pct: l, mid_savings_pct: m, high_savings_pct: h })
    .eq("organization_id", auth.user.organizationId)
    .eq("is_default", true)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Could not update the sensitivities." };
  revalidatePath("/", "layout");
  return { ok: true };
}
