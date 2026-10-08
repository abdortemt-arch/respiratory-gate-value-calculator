import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabasePublicEnv } from "../env";
import type { Database } from "./database.types";

/**
 * Supabase client acting as the signed-in user (RLS applies). Create one per
 * request; never share across requests.
 */
export async function createSupabaseServerClient() {
  // Read cookies first: this marks every session-dependent route as dynamic, so
  // builds succeed (and /setup is shown) even before Supabase is configured.
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabasePublicEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy
          // refreshes the session on every request, so this is safe to ignore.
        }
      },
    },
  });
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
