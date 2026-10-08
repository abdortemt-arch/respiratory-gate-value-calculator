import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { INPUT_DEFINITIONS } from "../src/domain/inputs/catalog";
import { WORKBOOK_DEFAULT_SCENARIO } from "../src/domain/scenario";
import { cleanupOrganization } from "../supabase/tests/helpers";

/**
 * Isolated test organisation with one workbook hospital (catalog rows and the
 * workbook default scenario), an Admin and a Manager of that hospital. Removed
 * again by `teardown()`. Never touches real data.
 */
export interface TestWorld {
  readonly orgId: string;
  readonly orgName: string;
  readonly hospitalId: string;
  readonly hospitalName: string;
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
  const orgName = `E2E Org ${run}`;
  const hospitalId = randomUUID();
  const hospitalName = `E2E Hospital ${run}`;
  const password = `E2e-${randomUUID()}`;
  await service.from("organizations").insert({ id: orgId, name: orgName }).throwOnError();
  await service
    .from("hospitals")
    .insert({ id: hospitalId, organization_id: orgId, name: hospitalName, code: `E2E-${run.slice(0, 4).toUpperCase()}`, workbook_model_enabled: true })
    .throwOnError();
  await service
    .from("hospital_inputs")
    .insert(
      INPUT_DEFINITIONS.map((d) => ({
        organization_id: orgId,
        hospital_id: hospitalId,
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
      hospital_id: hospitalId,
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
    if (role === "manager") {
      await service.from("hospital_members").insert({ hospital_id: hospitalId, user_id: data.user.id, role: "manager" }).throwOnError();
    }
  }
  return { orgId, orgName, hospitalId, hospitalName, password, emails, service, userIds };
}

export async function teardown(world: TestWorld): Promise<void> {
  const { service, orgId } = world;
  const { data: profiles } = await service.from("profiles").select("user_id").eq("organization_id", orgId);
  await cleanupOrganization(service, orgId, (profiles ?? []).map((p) => p.user_id as string));
}

/** An empty organisation with one Admin, for the multi-hospital acceptance flow. */
export interface PlatformWorld {
  readonly orgId: string;
  readonly email: string;
  readonly password: string;
  readonly service: SupabaseClient;
}

export async function setupPlatformWorld(): Promise<PlatformWorld> {
  const service = serviceClient();
  const run = randomUUID().slice(0, 8);
  const orgId = randomUUID();
  const password = `E2e-${randomUUID()}`;
  const email = `platform-admin-${run}@e2e.test`;
  await service.from("organizations").insert({ id: orgId, name: `E2E Platform ${run}` }).throwOnError();
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await service.from("profiles").insert({ user_id: data.user.id, organization_id: orgId, full_name: "Amira Hassan", role: "admin" }).throwOnError();
  return { orgId, email, password, service };
}

export async function teardownPlatform(world: PlatformWorld): Promise<void> {
  const { data: profiles } = await world.service.from("profiles").select("user_id").eq("organization_id", world.orgId);
  await cleanupOrganization(world.service, world.orgId, (profiles ?? []).map((p) => p.user_id as string));
}
