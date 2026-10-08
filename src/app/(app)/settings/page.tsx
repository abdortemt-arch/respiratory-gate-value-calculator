import type { Metadata } from "next";
import { can, canEditInputSource, ROLE_LABELS } from "@/domain/access";
import { definitionsInGroup, type InputKey } from "@/domain/inputs/catalog";
import { WORKBOOK_DEFAULT_SCENARIO } from "@/domain/scenario";
import { PageHeader } from "@/components/layout/app-shell";
import { InputField } from "@/components/inputs/input-field";
import { ScenarioAdmin } from "@/components/settings/scenario-admin";
import { OrganizationNameForm, SensitivitiesForm } from "@/components/settings/small-forms";
import { UserAdmin, type ManagedUser } from "@/components/settings/user-admin";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { loadWorkspace } from "@/server/data/workspace";
import { createSupabaseAdminClient, isAdminClientConfigured } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { updateInput } from "../inputs/actions";
import { approveScenario, archiveScenario, setDefaultScenario } from "../scenario-actions";
import { createUser, resetUserPassword, setUserActive, updateOrganizationName, updateSensitivities, updateUserRole } from "./actions";

export const metadata: Metadata = { title: "Settings" };

async function loadUsers(organizationId: string, selfProfileId: string): Promise<ManagedUser[]> {
  const supabase = await createSupabaseServerClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, role, active")
    .eq("organization_id", organizationId)
    .order("full_name");
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
  }));
}

export default async function SettingsPage() {
  const user = await requireUser();
  const ws = await loadWorkspace(user);
  const isAdmin = can(user.role, "manage_users");
  const users = isAdmin ? await loadUsers(user.organizationId, user.profileId) : [];
  const defaultScenario = ws.scenarios.find((s) => s.isDefault);

  return (
    <>
      <PageHeader title="Settings" description="Your account, scenarios, Respiratory Gate model assumptions and user access." />
      <nav aria-label="Settings sections" className="no-print mb-6 flex flex-wrap gap-2 text-sm">
        {[
          ["account", "Your account"],
          ["scenarios", "Scenarios"],
          ["assumptions", "Model assumptions"],
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

        <Card id="scenarios" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Scenarios</CardTitle>
            <CardDescription>
              Named selections of occupancy, package price and savings level. Save new ones from any dashboard. The default
              scenario sets the starting selection and the official sensitivities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScenarioAdmin
              scenarios={ws.scenarios}
              canApprove={can(user.role, "approve_scenarios")}
              approve={approveScenario}
              makeDefault={setDefaultScenario}
              archive={archiveScenario}
            />
          </CardContent>
        </Card>

        <Card id="assumptions" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Model assumptions</CardTitle>
            <CardDescription>
              Respiratory Gate assumptions (blue cells in the workbook). Only Admins can change them; every change is audited.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Savings sensitivities (default scenario)</h3>
              <p className="text-xs text-muted">Applied to each lever&apos;s baseline. Sensitivities, not forecasts.</p>
              <SensitivitiesForm
                sensitivities={defaultScenario?.settings.sensitivities ?? WORKBOOK_DEFAULT_SCENARIO.sensitivities}
                editable={can(user.role, "edit_assumptions") && Boolean(defaultScenario)}
                save={updateSensitivities}
              />
            </div>
            <div className="divide-y divide-line border-t border-line">
              {definitionsInGroup("model_assumptions").map((def) => {
                const key = def.key as InputKey;
                const meta = ws.meta[key];
                return (
                  <InputField
                    key={key}
                    inputKey={key}
                    value={ws.values[key]}
                    text={ws.texts[key] ?? null}
                    editable={Boolean(meta) && canEditInputSource(user.role, def.source)}
                    updatedAt={meta?.updatedAt ?? null}
                    updatedByName={meta?.updatedByName ?? null}
                    auditHref={can(user.role, "view_audit") ? `/audit?key=${key}` : undefined}
                    save={updateInput}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>

        {isAdmin ? (
          <>
            <Card id="users" className="scroll-mt-20">
              <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>
                  Admin: full access. Hospital Manager / Finance: edit hospital inputs, save scenarios, view audit. Viewer:
                  read-only dashboards and reports. Physician and patient roles are reserved and have no access.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isAdminClientConfigured() ? (
                  <UserAdmin
                    users={users}
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
