import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/server/auth/redirects";
import { createSupabaseServerClient } from "@/server/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = ["invite", "recovery", "magiclink", "email", "signup", "email_change"];

/**
 * Landing URL for invite and password-reset emails. Supports all three link styles:
 * - `?token_hash=…&type=…` (custom email templates) — verified here.
 * - `?code=…` (PKCE, e.g. reset requested from this app) — exchanged here.
 * - `#access_token=…` (Supabase default templates) — the fragment never reaches the
 *   server, so we forward to a page that reads it in the browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/auth/confirm/session?error=${encodeURIComponent(reason)}`, request.url));

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return error ? fail(error.message) : NextResponse.redirect(new URL(next, request.url));
  }
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? fail("This link has expired or was opened in a different browser.") : NextResponse.redirect(new URL(next, request.url));
  }
  // Browsers carry the #fragment across this redirect.
  return NextResponse.redirect(new URL(`/auth/confirm/session?next=${encodeURIComponent(next)}`, request.url));
}
