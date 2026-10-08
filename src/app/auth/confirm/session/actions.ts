"use server";

import { createSupabaseServerClient } from "@/server/supabase/server";

/** Turns tokens from an email link's URL fragment into a cookie session (verified by Supabase). */
export async function establishSession(accessToken: string, refreshToken: string): Promise<{ error?: string }> {
  if (!accessToken || !refreshToken) return { error: "This link is incomplete." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return error ? { error: "This link has expired. Ask your Admin for a new invitation or request a new reset link." } : {};
}
