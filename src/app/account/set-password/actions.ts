"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { passwordProblem } from "@/server/auth/password-policy";
import { createSupabaseAdminClient, isAdminClientConfigured } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

export interface SetPasswordState {
  readonly error?: string;
}

export async function setPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const session = await getSession();
  if (session.status === "signed_out") redirect("/sign-in");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.code === "same_password" ? "Choose a password different from the current one." : error.message };
  }

  // Clear the "change temporary password" flag (app_metadata is admin-only).
  if (data.user.app_metadata?.must_change_password && isAdminClientConfigured()) {
    const admin = createSupabaseAdminClient();
    await admin.auth.admin.updateUserById(data.user.id, {
      app_metadata: { ...data.user.app_metadata, must_change_password: false },
    });
    await supabase.auth.refreshSession();
  }
  redirect("/hospitals");
}
