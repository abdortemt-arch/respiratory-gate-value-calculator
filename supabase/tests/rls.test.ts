/**
 * Row-level security, column privileges and audit triggers, exercised through
 * the real Supabase Auth + Data API of a local stack.
 *
 *   pnpm test:db      # runs against `supabase start` (Docker)
 *
 * Skipped when TEST_SUPABASE_* variables are absent (e.g. plain `pnpm test`).
 * Each run creates its own organisation and users, so it never touches real data.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupOrganization } from "./helpers";

const url = process.env.TEST_SUPABASE_URL;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);

type Role = "admin" | "manager" | "viewer" | "referring_physician";

const run = randomUUID().slice(0, 8);
const orgId = randomUUID();
const hospitalId = randomUUID();
const password = `Test-${randomUUID()}`;
const users: Partial<Record<Role | "inactive", { id: string; client: SupabaseClient }>> = {};
let service: SupabaseClient;

const client = (role: Role | "inactive") => {
  const entry = users[role];
  if (!entry) throw new Error(`user ${role} not set up`);
  return entry.client;
};

async function inputId(key: string): Promise<string> {
  const { data, error } = await service.from("hospital_inputs").select("id").eq("hospital_id", hospitalId).eq("key", key).single();
  if (error) throw error;
  return data.id;
}

describe.skipIf(!enabled)("Supabase RLS and audit", () => {
  beforeAll(async () => {
    service = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });

    await service.from("organizations").insert({ id: orgId, name: `RLS test ${run}` }).throwOnError();
    await service
      .from("hospitals")
      .insert({ id: hospitalId, organization_id: orgId, name: `RLS hospital ${run}`, code: "RLS", workbook_model_enabled: true })
      .throwOnError();
    await service
      .from("hospital_inputs")
      .insert([
        { organization_id: orgId, hospital_id: hospitalId, key: "oxygen_spend", category: "annual_spend", label: "Oxygen spend", unit: "EGP / yr", source_type: "hospital_data" },
        { organization_id: orgId, hospital_id: hospitalId, key: "collection_rate", category: "billing", label: "Collection rate", unit: "%", source_type: "hospital_data" },
        { organization_id: orgId, hospital_id: hospitalId, key: "days_per_year", category: "model_assumptions", label: "Days per year", unit: "days", numeric_value: 365, source_type: "rg_assumption" },
      ])
      .throwOnError();

    for (const role of ["admin", "manager", "viewer", "referring_physician", "inactive"] as const) {
      const email = `${role.replace("_", "-")}-${run}@rls.test`;
      const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      await service
        .from("profiles")
        .insert({
          user_id: data.user.id,
          organization_id: orgId,
          full_name: `Test ${role}`,
          role: role === "inactive" ? "manager" : role,
          active: role !== "inactive",
        })
        .throwOnError();
      if (role === "manager" || role === "viewer" || role === "inactive") {
        await service
          .from("hospital_members")
          .insert({ hospital_id: hospitalId, user_id: data.user.id, role: role === "viewer" ? "viewer" : "manager" })
          .throwOnError();
      }
      const c = createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
      const signIn = await c.auth.signInWithPassword({ email, password });
      if (signIn.error) throw signIn.error;
      users[role] = { id: data.user.id, client: c };
    }
  });

  afterAll(async () => {
    if (!service) return;
    await cleanupOrganization(service, orgId, Object.values(users).flatMap((u) => (u ? [u.id] : [])));
  });

  it("anonymous requests see nothing", async () => {
    const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await anon.from("hospital_inputs").select("id");
    expect(error?.code === "42501" || (data ?? []).length === 0).toBe(true);
  });

  it("staff read their organisation's inputs; reserved and inactive roles read nothing", async () => {
    for (const role of ["admin", "manager", "viewer"] as const) {
      const { data } = await client(role).from("hospital_inputs").select("key").eq("organization_id", orgId);
      expect(data, role).toHaveLength(3);
    }
    for (const role of ["referring_physician", "inactive"] as const) {
      const { data } = await client(role).from("hospital_inputs").select("key");
      expect(data, role).toEqual([]);
      const orgs = await client(role).from("organizations").select("id");
      expect(orgs.data, role).toEqual([]);
    }
  });

  it("reserved roles can read only their own profile", async () => {
    const { data } = await client("referring_physician").from("profiles").select("full_name");
    expect(data).toEqual([{ full_name: "Test referring_physician" }]);
  });

  it("viewers cannot change inputs", async () => {
    const { data } = await client("viewer")
      .from("hospital_inputs")
      .update({ numeric_value: 1 })
      .eq("organization_id", orgId)
      .eq("key", "oxygen_spend")
      .select();
    expect(data ?? []).toEqual([]);
  });

  it("managers edit hospital data and the change is audited with old and new values", async () => {
    const { data, error } = await client("manager")
      .from("hospital_inputs")
      .update({ numeric_value: 3_000_000 })
      .eq("organization_id", orgId)
      .eq("key", "oxygen_spend")
      .select("numeric_value, updated_by");
    expect(error).toBeNull();
    expect(data).toEqual([{ numeric_value: 3_000_000, updated_by: users.manager!.id }]);

    const audit = await client("admin").from("audit_log").select("*").eq("organization_id", orgId).eq("field_name", "oxygen_spend");
    expect(audit.data).toHaveLength(1);
    expect(audit.data![0]).toMatchObject({
      entity_type: "hospital_input",
      old_value: null,
      new_value: "3000000",
      changed_by: users.manager!.id,
      actor_name: "Test manager",
      action: "update",
    });
  });

  it("managers cannot edit Respiratory Gate assumptions; admins can", async () => {
    const managerTry = await client("manager")
      .from("hospital_inputs")
      .update({ numeric_value: 360 })
      .eq("organization_id", orgId)
      .eq("key", "days_per_year")
      .select();
    expect(managerTry.data ?? []).toEqual([]);

    const adminTry = await client("admin")
      .from("hospital_inputs")
      .update({ numeric_value: 366 })
      .eq("organization_id", orgId)
      .eq("key", "days_per_year")
      .select("numeric_value");
    expect(adminTry.data).toEqual([{ numeric_value: 366 }]);
  });

  it("only values are editable: metadata columns are not granted", async () => {
    const { error } = await client("admin").from("hospital_inputs").update({ label: "Hacked" }).eq("id", await inputId("oxygen_spend"));
    expect(error?.code).toBe("42501");
  });

  it("database constraints reject negative values and percentages above 100%", async () => {
    const negative = await client("manager").from("hospital_inputs").update({ numeric_value: -1 }).eq("id", await inputId("oxygen_spend"));
    expect(negative.error?.code).toBe("23514");
    const percent = await client("manager").from("hospital_inputs").update({ numeric_value: 80 }).eq("id", await inputId("collection_rate"));
    expect(percent.error?.code).toBe("23514");
  });

  it("nobody can write the audit log directly; viewers cannot read it", async () => {
    const insert = await client("admin")
      .from("audit_log")
      .insert({ organization_id: orgId, entity_type: "hospital_input", entity_id: orgId, field_name: "x" });
    expect(insert.error?.code).toBe("42501");
    const read = await client("viewer").from("audit_log").select("id").eq("organization_id", orgId);
    expect(read.data).toEqual([]);
  });

  describe("scenarios", () => {
    let draftId: string;

    it("managers save drafts but cannot approve them", async () => {
      const created = await client("manager")
        .from("scenario_assumptions")
        .insert({ organization_id: orgId, hospital_id: hospitalId, scenario_name: "Manager draft", occupancy_rate: 0.7, package_price: 900, savings_level: "low" })
        .select("id, status, created_by")
        .single();
      expect(created.error).toBeNull();
      expect(created.data).toMatchObject({ status: "draft", created_by: users.manager!.id });
      draftId = created.data!.id;

      const approve = await client("manager").from("scenario_assumptions").update({ status: "approved" }).eq("id", draftId).select();
      expect(approve.error?.code === "42501" || (approve.data ?? []).length === 0).toBe(true);
    });

    it("admins approve; editing an approved scenario's numbers returns it to draft", async () => {
      const approved = await client("admin")
        .from("scenario_assumptions")
        .update({ status: "approved", approved_snapshot: { test: true } })
        .eq("id", draftId)
        .select("status, approved_by, approved_at")
        .single();
      expect(approved.data).toMatchObject({ status: "approved", approved_by: users.admin!.id });
      expect(approved.data!.approved_at).not.toBeNull();

      const edited = await client("admin")
        .from("scenario_assumptions")
        .update({ package_price: 950 })
        .eq("id", draftId)
        .select("status, approved_by, approved_snapshot")
        .single();
      expect(edited.data).toEqual({ status: "draft", approved_by: null, approved_snapshot: null });
    });

    it("set_default_scenario is admin-only and keeps a single default", async () => {
      const second = await client("admin")
        .from("scenario_assumptions")
        .insert({ organization_id: orgId, hospital_id: hospitalId, scenario_name: "Board case", occupancy_rate: 0.8, package_price: 1000 })
        .select("id")
        .single();

      const managerRpc = await client("manager").rpc("set_default_scenario", { scenario_id: draftId });
      expect(managerRpc.error?.code).toBe("42501");

      await client("admin").rpc("set_default_scenario", { scenario_id: draftId }).throwOnError();
      await client("admin").rpc("set_default_scenario", { scenario_id: second.data!.id }).throwOnError();
      const defaults = await service.from("scenario_assumptions").select("scenario_name").eq("organization_id", orgId).eq("is_default", true);
      expect(defaults.data).toEqual([{ scenario_name: "Board case" }]);
    });

    it("the default scenario cannot be deleted", async () => {
      const { data: def } = await service.from("scenario_assumptions").select("id").eq("organization_id", orgId).eq("is_default", true).single();
      const del = await client("admin").from("scenario_assumptions").delete().eq("id", def!.id).select();
      expect(del.data ?? []).toEqual([]);
    });

    it("scenario changes are audited", async () => {
      const { data } = await client("admin").from("audit_log").select("field_name, action").eq("entity_type", "scenario_assumption").eq("organization_id", orgId);
      const fields = (data ?? []).map((r) => `${r.action}:${r.field_name}`);
      expect(fields).toEqual(expect.arrayContaining(["insert:scenario_name", "update:status", "update:package_price", "update:is_default"]));
    });
  });

  describe("user management", () => {
    it("only admins change roles; changes are audited", async () => {
      const viewerProfile = await service.from("profiles").select("id").eq("user_id", users.viewer!.id).single();
      const byManager = await client("manager").from("profiles").update({ role: "admin" }).eq("id", viewerProfile.data!.id).select();
      expect(byManager.data ?? []).toEqual([]);

      const byAdmin = await client("admin").from("profiles").update({ role: "manager" }).eq("id", viewerProfile.data!.id).select("role");
      expect(byAdmin.data).toEqual([{ role: "manager" }]);
      await client("admin").from("profiles").update({ role: "viewer" }).eq("id", viewerProfile.data!.id).throwOnError();

      const audit = await client("admin").from("audit_log").select("old_value, new_value").eq("entity_id", viewerProfile.data!.id).eq("field_name", "role");
      expect(audit.data).toEqual(expect.arrayContaining([{ old_value: "viewer", new_value: "manager" }]));
    });

    it("the last active admin cannot be demoted or deactivated", async () => {
      const adminProfile = await service.from("profiles").select("id").eq("user_id", users.admin!.id).single();
      const demote = await client("admin").from("profiles").update({ role: "viewer" }).eq("id", adminProfile.data!.id);
      expect(demote.error?.message).toContain("At least one active Admin is required");
      const deactivate = await client("admin").from("profiles").update({ active: false }).eq("id", adminProfile.data!.id);
      expect(deactivate.error?.message).toContain("At least one active Admin is required");
    });
  });
});
