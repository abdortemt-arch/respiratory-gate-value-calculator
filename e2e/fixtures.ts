import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { INPUT_DEFINITIONS } from "../src/domain/inputs/catalog";
import { WORKBOOK_DEFAULT_SCENARIO } from "../src/domain/scenario";

/**
 * Isolated test organisation with catalog rows, the workbook default scenario
 * and one user per role. Removed again by `teardown()`. Never touches real data.
 */
export interface TestWorld {
  readonly orgId: string;
  readonly orgName: string;
  readonly password: string;
  readonly emails: { admin: string; manager: string; viewer: string };
  readonly service: SupabaseClient;
  readonly userIds: string[];
}

export function serviceClient(): SupabaseClient {
  const url = process.env.TEST_SUPABASE_URL;
  const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Run via `pnpm test:e2e` (needs a local Supabase stack).");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function setupWorld(): Promise<TestWorld> {
  const service = serviceClient();
  const run = randomUUID().slice(0, 8);
  const orgId = randomUUID();
  const orgName = `E2E Hospital ${run}`;
  const password = `E2e-${randomUUID()}`;
  await service.from("organizations").insert({ id: orgId, name: orgName }).throwOnError();
  await service
    .from("hospital_inputs")
    .insert(
      INPUT_DEFINITIONS.map((d) => ({
        organization_id: orgId,
        key: d.key,
        category: d.group,
        label: d.label,
        unit: d.unit,
        numeric_value: d.defaultValue,
        data_owner: d.owner,
        note: d.note ?? null,
        source_type: d.source,
      })),
    )
    .throwOnError();
  const s = WORKBOOK_DEFAULT_SCENARIO;
  await service
    .from("scenario_assumptions")
    .insert({
      organization_id: orgId,
      scenario_name: "Workbook default",
      occupancy_rate: s.occupancyRate,
      package_price: s.packagePrice,
      savings_level: s.savingsLevel,
      low_savings_pct: s.sensitivities.low,
      mid_savings_pct: s.sensitivities.mid,
      high_savings_pct: s.sensitivities.high,
      is_default: true,
    })
    .throwOnError();

  const emails = { admin: `admin-${run}@e2e.test`, manager: `manager-${run}@e2e.test`, viewer: `viewer-${run}@e2e.test` };
  const userIds: string[] = [];
  for (const role of ["admin", "manager"] as const) {
    const { data, error } = await service.auth.admin.createUser({ email: emails[role], password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    await service
      .from("profiles")
      .insert({ user_id: data.user.id, organization_id: orgId, full_name: `E2E ${role}`, role })
      .throwOnError();
  }
  return { orgId, orgName, password, emails, service, userIds };
}

export async function teardown(world: TestWorld): Promise<void> {
  const { service, orgId } = world;
  const { data: profiles } = await service.from("profiles").select("user_id").eq("organization_id", orgId);
  for (const p of profiles ?? []) await service.auth.admin.deleteUser(p.user_id);
  await service.from("scenario_assumptions").delete().eq("organization_id", orgId);
  await service.from("audit_log").delete().eq("organization_id", orgId);
  await service.from("hospital_inputs").delete().eq("organization_id", orgId);
  await service.from("profiles").delete().eq("organization_id", orgId);
  await service.from("organizations").delete().eq("id", orgId);
}
