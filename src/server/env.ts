import "server-only";

/**
 * Supabase configuration from environment variables (see .env.example).
 * Accepts both the classic key names and the newer publishable/secret names.
 */
export interface SupabasePublicEnv {
  readonly url: string;
  readonly anonKey: string;
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export function requireSupabasePublicEnv(): SupabasePublicEnv {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new ConfigurationError(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return env;
}

/** Server-only admin key. Needed only for creating users (Settings → Users). */
export function getServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? null;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}
