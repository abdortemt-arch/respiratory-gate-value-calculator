import type { Metadata } from "next";
import { can, ROLE_LABELS } from "@/domain/access";
import { PageHeader } from "@/components/layout/app-shell";
import { ServiceLibrary, type LibraryRow } from "@/components/settings/service-library";
import { OrganizationNameForm } from "@/components/settings/small-forms";
import { UserAdmin, type ManagedUser } from "@/components/settings/user-admin";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { loadVisibleHospitals } from "@/server/hospitals/access";
import { createSupabaseAdminClient, isAdminClientConfigured } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import {
  createLibraryService,
  createUser,
  resetUserPassword,
  setLibraryServiceActive,
  setUserActive,
  updateLibraryService,
  updateOrganizationName,
  updateUserRole,
} from "./actions";
import { isOneOf, SERVICE_CATEGORIES } from "@/domain/hospital";

export const metadata: Metadata = { title: "Settings" };

async function loadUsers(organizationId: string, selfProfileId: string): Promise<ManagedUser[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: profiles }, { data: members }, { data: hospitals }] = await Promise.all([
    supabase.from("profiles").select("id, user_id, full_name, role, active").eq("organization_id", organizationId).order("full_name"),
    supabase.from("hospital_members").select("user_id, hospital_id, active"),
    supabase.from("hospitals").select("id, name"),
  ]);
  const hospitalName = new Map((hospitals ?? []).map((h) => [h.id, h.name]));
  const accounts = new Map<string, { email: string | null; lastSignInAt: string | null }>();
  if (isAdminClientConfigured()) {
    const { data } = await createSupabaseAdminClient().auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? []) accounts.set(u.id, { email: u.email ?? null, lastSignInAt: u.last_sign_in_at ?? null });
  }
  return (profiles ?? []).map((p) => ({
    profileId: p.id,
    fullName: p.full_name,
    email: accounts.get(p.user_id)?.email ?? null,
    role: p.role,
    active: p.active,
    lastSignInAt: accounts.get(p.user_id)?.lastSignInAt ?? null,
    isSelf: p.id === selfProfileId,
    hospitals: (members ?? [])
      .filter((m) => m.user_id === p.user_id && m.active)
      .map((m) => hospitalName.get(m.hospital_id) ?? "")
      .filter(Boolean)
      .sort(),
  }));
}

async function loadLibrary(): Promise<LibraryRow[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: services }, { data: provided }] = await Promise.all([
    supabase.from("services").select("id, name, code, category, description, active").order("name"),
    supabase.from("hospital_services").select("service_id, active"),
  ]);
  return (services ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    category: isOneOf(SERVICE_CATEGORIES, s.category) ? s.category : "other",
    description: s.description,
    active: s.active,
    hospitals: (provided ?? []).filter((p) => p.service_id === s.id && p.active).length,
  }));
}

export default async function SettingsPage() {
  const user = await requireUser();
  const isAdmin = can(user.role, "manage_users");
  const users = isAdmin ? await loadUsers(user.organizationId, user.profileId) : [];
  const hospitals = isAdmin ? (await loadVisibleHospitals()).filter((h) => h.active) : [];
  const library = user.role === "viewer" ? [] : await loadLibrary();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your account, users and organisation. Hospital details, members and workbook scenarios are set in each hospital's Settings."
      />
      <nav aria-label="Settings sections" className="no-print mb-6 flex flex-wrap gap-2 text-sm">
        {[
          ["account", "Your account"],
          ...(user.role !== "viewer" ? [["services", "Service library"]] : []),
          ...(isAdmin ? [["users", "Users"], ["organisation", "Organisation"]] : []),
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-line bg-card px-3 py-1 font-medium text-ink-soft hover:border-brand-blue">
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        <Card id="account" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Your account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Name</dt>
              <dd className="font-medium">{user.fullName}</dd>
              <dt className="text-muted">Email</dt>
              <dd>{user.email}</dd>
              <dt className="text-muted">Role</dt>
              <dd>{ROLE_LABELS[user.role]}</dd>
              <dt className="text-muted">Organisation</dt>
              <dd>{user.organizationName}</dd>
            </dl>
            <LinkButton href="/account/set-password" variant="secondary">
              Change password
            </LinkButton>
          </CardContent>
        </Card>

        {user.role !== "viewer" ? (
          <Card id="services" className="scroll-mt-20">
            <CardHeader>
              <CardTitle>Service library</CardTitle>
              <CardDescription>
                Respiratory therapy services shared by all hospitals, so the same service can be compared across hospitals. Each
                hospital chooses what it provides and sets its own prices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ServiceLibrary
                rows={library}
                canAdd={can(user.role, "edit_hospital_config")}
                canEdit={can(user.role, "manage_organization")}
                create={createLibraryService}
                update={updateLibraryService}
                setActive={setLibraryServiceActive}
              />
            </CardContent>
          </Card>
        ) : null}

        {isAdmin ? (
          <>
            <Card id="users" className="scroll-mt-20">
              <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>
                  Admin: full access to every hospital. Hospital Manager / Finance: edit configuration and monthly data of
                  the hospitals they are given, view their audit. Viewer: read-only dashboards and reports of their
                  hospitals. Physician and patient roles are reserved and have no access.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isAdminClientConfigured() ? (
                  <UserAdmin
                    users={users}
                    hospitals={hospitals.map((h) => ({ id: h.id, name: h.name }))}
                    createUser={createUser}
                    updateUserRole={updateUserRole}
                    setUserActive={setUserActive}
                    resetUserPassword={resetUserPassword}
                  />
                ) : (
                  <Alert tone="caution" title="User management needs the server key">
                    Set <code>SUPABASE_SERVICE_ROLE_KEY</code> in the server environment (Vercel → Settings → Environment
                    Variables) and redeploy.
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card id="organisation" className="scroll-mt-20">
              <CardHeader>
                <CardTitle>Organisation</CardTitle>
              </CardHeader>
              <CardContent>
                <OrganizationNameForm name={user.organizationName} save={updateOrganizationName} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
