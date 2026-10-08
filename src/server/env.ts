import "server-only";

/**
 * Supabase configuration from environment variables (see .env.example).
 * Accepts both the classic key names and the newer publishable/secret names.
 */
export interface SupabasePublicEnv {
  readonly url: string;
  readonly anonKey: string;
}

/**
 * Read by dynamic key so the build never inlines NEXT_PUBLIC_* values: the
 * runtime environment (Vercel, .env.local) is always what counts.
 */
export function readEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return null;
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
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
  return readEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}
