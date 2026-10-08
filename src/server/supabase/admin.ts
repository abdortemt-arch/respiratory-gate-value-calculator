import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ConfigurationError, getServiceRoleKey, requireSupabasePublicEnv } from "../env";
import type { Database } from "./database.types";

/**
 * Service-role client: bypasses RLS. Used only for Supabase Auth admin
 * operations (creating users, password flags). Never import from client code.
 */
export function createSupabaseAdminClient() {
  const { url } = requireSupabasePublicEnv();
  const key = getServiceRoleKey();
  if (!key) {
    throw new ConfigurationError("SUPABASE_SERVICE_ROLE_KEY is not set: user management is unavailable.");
  }
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function isAdminClientConfigured(): boolean {
  return getServiceRoleKey() !== null;
}
