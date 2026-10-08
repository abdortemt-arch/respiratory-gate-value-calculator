"use server";

import { requestOrigin } from "@/server/auth/redirects";
import { createSupabaseServerClient } from "@/server/supabase/server";

export interface ForgotState {
  readonly sent?: boolean;
  readonly error?: string;
}

export async function requestPasswordReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "Enter the email address of your account." };
  const supabase = await createSupabaseServerClient();
  const origin = await requestOrigin();
  // The response is identical whether or not the account exists.
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm?next=/account/set-password` });
  return { sent: true };
}
