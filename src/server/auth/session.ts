import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { can, isStaffRole, type AppRole, type Permission, type StaffRole } from "@/domain/access";
import { createSupabaseServerClient } from "../supabase/server";

export interface SessionUser {
  readonly userId: string;
  readonly email: string;
  readonly profileId: string;
  readonly fullName: string;
  readonly role: StaffRole;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly mustChangePassword: boolean;
}

export type SessionState =
  | { readonly status: "signed_out" }
  | { readonly status: "no_access"; readonly reason: "no_profile" | "inactive" | "reserved_role"; readonly email: string }
  | { readonly status: "ok"; readonly user: SessionUser };

/** Data Access Layer entry point: verified JWT + profile, memoised per request. */
export const getSession = cache(async (): Promise<SessionState> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { status: "signed_out" };

  const email = typeof claims.email === "string" ? claims.email : "";
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, organization_id, organizations(name)")
    .eq("user_id", claims.sub)
    .maybeSingle();

  if (!profile) return { status: "no_access", reason: "no_profile", email };
  if (!profile.active) return { status: "no_access", reason: "inactive", email };
  const role = profile.role as AppRole;
  if (!isStaffRole(role)) return { status: "no_access", reason: "reserved_role", email };

  const appMetadata = (claims.app_metadata ?? {}) as Record<string, unknown>;
  return {
    status: "ok",
    user: {
      userId: claims.sub,
      email,
      profileId: profile.id,
      fullName: profile.full_name,
      role,
      organizationId: profile.organization_id,
      organizationName: profile.organizations?.name ?? "",
      mustChangePassword: appMetadata.must_change_password === true,
    },
  };
});

/** For pages: redirect anyone who may not use the internal platform. */
export async function requireUser(permission: Permission = "view_dashboards"): Promise<SessionUser> {
  const session = await getSession();
  if (session.status === "signed_out") redirect("/sign-in");
  if (session.status === "no_access") redirect("/no-access");
  if (session.user.mustChangePassword) redirect("/account/set-password");
  if (!can(session.user.role, permission)) redirect("/overview?denied=1");
  return session.user;
}

export type Authorized = { readonly ok: true; readonly user: SessionUser } | { readonly ok: false; readonly error: string };

/** For Server Actions: never trust the client; re-check the session and role. */
export async function authorize(permission: Permission): Promise<Authorized> {
  const session = await getSession();
  if (session.status !== "ok") return { ok: false, error: "Your session has ended. Sign in again." };
  if (session.user.mustChangePassword) return { ok: false, error: "Set a new password before making changes." };
  if (!can(session.user.role, permission)) return { ok: false, error: "Your role does not allow this change." };
  return { ok: true, user: session.user };
}
