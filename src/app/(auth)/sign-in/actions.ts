"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/server/auth/redirects";
import { createSupabaseServerClient } from "@/server/supabase/server";

export interface SignInState {
  readonly error?: string;
  readonly email?: string;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Same message for unknown email and wrong password: no account enumeration.
    return { error: error.status === 429 ? "Too many attempts. Wait a minute and try again." : "Incorrect email or password.", email };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
