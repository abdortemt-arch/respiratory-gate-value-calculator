/**
 * Multi-hospital platform: hospital-level RLS, effective-dated prices that never
 * overwrite history, period locking, audited historical corrections — and the
 * acceptance figures recalculated from what the database returns.
 *
 *   pnpm test:db      # runs against `supabase start` (Docker)
 *
 * Each run creates its own organisation, hospitals and users.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calculatePeriod, explainVariance } from "../../src/domain/hospital";
import { loadHospitalDetail, loadPeriods } from "../../src/server/hospitals/repository";
import type { Database } from "../../src/server/supabase/database.types";
import { cleanupOrganization } from "./helpers";

const url = process.env.TEST_SUPABASE_URL;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);

type Db = SupabaseClient<Database>;
type Person = "admin" | "managerA" | "viewerA" | "managerB" | "outsider" | "viewerProfile";

const run = randomUUID().slice(0, 8);
const orgId = randomUUID();
const password = `Test-${randomUUID()}`;
const users: Partial<Record<Person, { id: string; client: Db }>> = {};
let service: Db;

const as = (p: Person): Db => {
  const u = users[p];
  if (!u) throw new Error(`user ${p} not set up`);
  return u.client;
};

// Filled as the scenario unfolds.
const ids = {
  hospitalA: "",
  hospitalB: "",
  aicu: "",
  picu: "",
  bIcu: "",
  nivLibrary: "",
  hfncLibrary: "",
  nivA: "",
  hfncA: "",
  nivB: "",
  janA: "",
  febA: "",
  marA: "",
  janB: "",
  janPriceA: "",
};

async function libraryId(name: string): Promise<string> {
  const { data } = await service.from("services").select("id").eq("organization_id", orgId).eq("name", name).single().throwOnError();
  return data!.id;
}

async function period(db: Db, hospitalId: string, month: string): Promise<string> {
  const { data } = await db.from("operating_periods").insert({ hospital_id: hospitalId, period_month: `${month}-01` }).select("id").single().throwOnError();
  return data!.id;
}

describe.skipIf(!enabled)("Multi-hospital platform (Supabase)", () => {
  beforeAll(async () => {
    service = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    await service.from("organizations").insert({ id: orgId, name: `Hospitals test ${run}` }).throwOnError();

    const roles: Record<Person, "admin" | "manager" | "viewer"> = {
      admin: "admin",
      managerA: "manager",
      viewerA: "viewer",
      managerB: "manager",
      outsider: "manager",
      viewerProfile: "viewer",
    };
    for (const [person, role] of Object.entries(roles) as [Person, "admin" | "manager" | "viewer"][]) {
      const email = `${person.toLowerCase()}-${run}@hospitals.test`;
      const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      await service.from("profiles").insert({ user_id: data.user.id, organization_id: orgId, full_name: `Test ${person}`, role }).throwOnError();
      const c = createClient<Database>(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
      const signIn = await c.auth.signInWithPassword({ email, password });
      if (signIn.error) throw signIn.error;
      users[person] = { id: data.user.id, client: c };
    }
    ids.nivLibrary = await libraryId("NIV");
    ids.hfncLibrary = await libraryId("HFNC");
  });

  afterAll(async () => {
    if (!service) return;
    await cleanupOrganization(service as unknown as SupabaseClient, orgId, Object.values(users).flatMap((u) => (u ? [u.id] : [])));
  });

  it("a new organisation gets the default respiratory service library", async () => {
    const { data } = await as("managerA").from("services").select("name").eq("organization_id", orgId);
    expect((data ?? []).map((s) => s.name)).toEqual(
      expect.arrayContaining(["Invasive Mechanical Ventilation", "NIV", "CPAP", "HFNC", "Oxygen Therapy", "ABG", "PFT", "Weaning"]),
    );
    expect(data).toHaveLength(15);
  });

  describe("hospitals and access", () => {
    it("only organisation Admins create hospitals", async () => {
      const byManager = await as("managerA").from("hospitals").insert({ organization_id: orgId, name: "Sneaky", code: "SNEAKY" });
      expect(byManager.error?.code).toBe("42501");

      const a = await as("admin")
        .from("hospitals")
        .insert({ organization_id: orgId, name: "Hospital A", code: "hosp-a", hospital_type: "teaching", total_beds: 300 })
        .select("id, code, created_by")
        .single();
      expect(a.error).toBeNull();
      expect(a.data).toMatchObject({ code: "HOSP-A", created_by: users.admin!.id });
      ids.hospitalA = a.data!.id;

      const b = await as("admin").from("hospitals").insert({ organization_id: orgId, name: "Hospital B", code: "HOSP-B" }).select("id").single();
      ids.hospitalB = b.data!.id;

      const duplicate = await as("admin").from("hospitals").insert({ organization_id: orgId, name: "hospital a", code: "OTHER" });
      expect(duplicate.error?.code).toBe("23505");
    });

    it("members are added by Admins and must belong to the organisation", async () => {
      const add = (p: Person, hospital: string, role: "manager" | "viewer") =>
        as("admin").from("hospital_members").insert({ hospital_id: hospital, user_id: users[p]!.id, role });
      await add("managerA", ids.hospitalA, "manager").throwOnError();
      await add("viewerA", ids.hospitalA, "viewer").throwOnError();
      await add("managerB", ids.hospitalB, "manager").throwOnError();
      await add("viewerProfile", ids.hospitalA, "manager").throwOnError();

      const byManager = await as("managerA").from("hospital_members").insert({ hospital_id: ids.hospitalA, user_id: users.outsider!.id, role: "manager" });
      expect(byManager.error?.code).toBe("42501");
    });

    it("each user sees only the hospitals they belong to; Admins see all", async () => {
      const visible = async (p: Person) => ((await as(p).from("hospitals").select("name").order("name")).data ?? []).map((h) => h.name);
      expect(await visible("admin")).toEqual(["Hospital A", "Hospital B"]);
      expect(await visible("managerA")).toEqual(["Hospital A"]);
      expect(await visible("viewerA")).toEqual(["Hospital A"]);
      expect(await visible("managerB")).toEqual(["Hospital B"]);
      expect(await visible("outsider")).toEqual([]);
    });

    it("only Admins edit hospital details", async () => {
      const byManager = await as("managerA").from("hospitals").update({ total_beds: 1 }).eq("id", ids.hospitalA).select();
      expect(byManager.data ?? []).toEqual([]);
      const byAdmin = await as("admin").from("hospitals").update({ location: "Cairo" }).eq("id", ids.hospitalA).select("location");
      expect(byAdmin.data).toEqual([{ location: "Cairo" }]);
    });
  });

  describe("configuration", () => {
    it("managers configure departments in their own hospital only", async () => {
      const aicu = await as("managerA")
        .from("hospital_departments")
        .insert({ hospital_id: ids.hospitalA, name: "AICU", category: "adult_icu", beds: 20 })
        .select("id")
        .single();
      expect(aicu.error).toBeNull();
      ids.aicu = aicu.data!.id;
      const picu = await as("managerA")
        .from("hospital_departments")
        .insert({ hospital_id: ids.hospitalA, name: "PICU", category: "picu", beds: 8 })
        .select("id")
        .single();
      ids.picu = picu.data!.id;

      const intoOther = await as("managerB").from("hospital_departments").insert({ hospital_id: ids.hospitalA, name: "Mine", beds: 1 });
      expect(intoOther.error?.code).toBe("42501");
      const byViewer = await as("viewerA").from("hospital_departments").insert({ hospital_id: ids.hospitalA, name: "Viewer ICU" });
      expect(byViewer.error?.code).toBe("42501");
      // A Viewer profile stays read-only even with a manager membership.
      const byViewerProfile = await as("viewerProfile").from("hospital_departments").insert({ hospital_id: ids.hospitalA, name: "VP ICU" });
      expect(byViewerProfile.error?.code).toBe("42501");

      const bIcu = await as("managerB").from("hospital_departments").insert({ hospital_id: ids.hospitalB, name: "ICU", beds: 12 }).select("id").single();
      ids.bIcu = bIcu.data!.id;
    });

    it("services are assigned per hospital and per department", async () => {
      const assign = async (db: Db, hospital: string, service_id: string) =>
        (await db.from("hospital_services").insert({ organization_id: orgId, hospital_id: hospital, service_id }).select("id").single().throwOnError()).data!.id;
      ids.nivA = await assign(as("managerA"), ids.hospitalA, ids.nivLibrary);
      ids.hfncA = await assign(as("managerA"), ids.hospitalA, ids.hfncLibrary);
      ids.nivB = await assign(as("managerB"), ids.hospitalB, ids.nivLibrary);

      await as("managerA")
        .from("hospital_service_departments")
        .insert([
          { hospital_id: ids.hospitalA, hospital_service_id: ids.nivA, department_id: ids.aicu },
          { hospital_id: ids.hospitalA, hospital_service_id: ids.nivA, department_id: ids.picu },
          { hospital_id: ids.hospitalA, hospital_service_id: ids.hfncA, department_id: ids.picu },
        ])
        .throwOnError();
    });

    it("foreign keys stop configuration from crossing hospitals", async () => {
      // Hospital A's NIV in Hospital B's ICU (Admin sees both, so only the key can stop it).
      const cross = await as("admin")
        .from("hospital_service_departments")
        .insert({ hospital_id: ids.hospitalA, hospital_service_id: ids.nivA, department_id: ids.bIcu });
      expect(cross.error?.code).toBe("23503");
      const price = await as("admin")
        .from("service_price_versions")
        .insert({ hospital_id: ids.hospitalB, hospital_service_id: ids.nivA, amount: 1, billing_unit: "per_day", effective_from: "2026-01-01" });
      expect(price.error?.code).toBe("23503");
    });

    it("configuration is deactivated, never deleted", async () => {
      const del = await as("admin").from("hospital_departments").delete().eq("id", ids.picu);
      expect(del.error?.code).toBe("42501");
      const off = await as("managerA").from("hospital_departments").update({ active: false }).eq("id", ids.picu).select("active");
      expect(off.data).toEqual([{ active: false }]);
      await as("managerA").from("hospital_departments").update({ active: true }).eq("id", ids.picu).throwOnError();
    });
  });

  describe("effective-dated prices", () => {
    const price = (db: Db, month: string, amount: number, extra: Record<string, unknown> = {}) =>
      db
        .from("service_price_versions")
        .insert({ hospital_id: ids.hospitalA, hospital_service_id: ids.nivA, amount, billing_unit: "per_day", effective_from: `${month}-01`, ...extra })
        .select("id, created_by")
        .single();

    it("records January, February and March NIV prices as separate versions", async () => {
      const jan = await price(as("managerA"), "2026-01", 1500);
      expect(jan.error).toBeNull();
      expect(jan.data!.created_by).toBe(users.managerA!.id);
      ids.janPriceA = jan.data!.id;
      await price(as("managerA"), "2026-02", 1800).throwOnError();
      await price(as("managerA"), "2026-03", 1600).throwOnError();
      await as("managerB")
        .from("service_price_versions")
        .insert({ hospital_id: ids.hospitalB, hospital_service_id: ids.nivB, amount: 2400, billing_unit: "per_day", effective_from: "2026-01-01" })
        .throwOnError();
    });

    it("prices take effect on the first of a month, once per month", async () => {
      const midMonth = await price(as("managerA"), "2026-04", 1700, { effective_from: "2026-04-15" });
      expect(midMonth.error?.code).toBe("23514");
      const duplicate = await price(as("managerA"), "2026-02", 1900);
      expect(duplicate.error?.code).toBe("23505");
    });

    it("a version can never be edited or deleted", async () => {
      const edit = await as("admin").from("service_price_versions").update({ amount: 1 } as never).eq("id", ids.janPriceA);
      expect(edit.error?.code).toBe("42501"); // amount is not an updatable column
      const del = await as("admin").from("service_price_versions").delete().eq("id", ids.janPriceA);
      expect(del.error?.code).toBe("42501");
    });

    it("a wrong version is voided with a reason and cannot be restored", async () => {
      const wrong = await price(as("managerA"), "2026-06", 9999);
      const noReason = await as("managerA").from("service_price_versions").update({ voided: true }).eq("id", wrong.data!.id);
      expect(noReason.error?.code).toBe("23514");
      const voided = await as("managerA")
        .from("service_price_versions")
        .update({ voided: true, void_reason: "Typo: should be 1,700" })
        .eq("id", wrong.data!.id)
        .select("voided, voided_by, voided_at")
        .single();
      expect(voided.data).toMatchObject({ voided: true, voided_by: users.managerA!.id });
      expect(voided.data!.voided_at).not.toBeNull();
      const restore = await as("admin").from("service_price_versions").update({ voided: false }).eq("id", wrong.data!.id);
      expect(restore.error?.message).toContain("cannot be restored");
      // The month is free again for the right price.
      await price(as("managerA"), "2026-06", 1700).throwOnError();
    });

    it("the price timeline derives each version's end month", async () => {
      const { data } = await as("viewerA")
        .from("service_price_timeline")
        .select("amount, effective_from, effective_to")
        .eq("hospital_service_id", ids.nivA)
        .order("effective_from");
      expect(data).toEqual([
        { amount: 1500, effective_from: "2026-01-01", effective_to: "2026-01-31" },
        { amount: 1800, effective_from: "2026-02-01", effective_to: "2026-02-28" },
        { amount: 1600, effective_from: "2026-03-01", effective_to: "2026-05-31" },
        { amount: 1700, effective_from: "2026-06-01", effective_to: null },
      ]);
    });

    it("Hospital B's prices are invisible to Hospital A's staff", async () => {
      const { data } = await as("managerA").from("service_price_versions").select("amount").eq("hospital_id", ids.hospitalB);
      expect(data).toEqual([]);
    });
  });

  describe("monthly operating periods", () => {
    const activity = (db: Db, periodId: string, hs: string, dept: string | null, quantity: number, hospital = ids.hospitalA) =>
      db.from("service_activity").insert({ hospital_id: hospital, period_id: periodId, hospital_service_id: hs, department_id: dept, quantity }).select("id").single();

    it("records January, February and March NIV volumes", async () => {
      ids.janA = await period(as("managerA"), ids.hospitalA, "2026-01");
      ids.febA = await period(as("managerA"), ids.hospitalA, "2026-02");
      ids.marA = await period(as("managerA"), ids.hospitalA, "2026-03");
      await activity(as("managerA"), ids.janA, ids.nivA, ids.aicu, 60).throwOnError();
      await activity(as("managerA"), ids.janA, ids.nivA, ids.picu, 40).throwOnError();
      await activity(as("managerA"), ids.febA, ids.nivA, ids.aicu, 100).throwOnError();
      await activity(as("managerA"), ids.marA, ids.nivA, ids.aicu, 120).throwOnError();
      ids.janB = await period(as("managerB"), ids.hospitalB, "2026-01");
      await activity(as("managerB"), ids.janB, ids.nivB, ids.bIcu, 100, ids.hospitalB).throwOnError();

      const twice = await as("managerA").from("operating_periods").insert({ hospital_id: ids.hospitalA, period_month: "2026-01-01" });
      expect(twice.error?.code).toBe("23505");
      const sameSlot = await activity(as("managerA"), ids.janA, ids.nivA, ids.aicu, 1);
      expect(sameSlot.error?.code).toBe("23505");
      const byViewer = await activity(as("viewerA"), ids.janA, ids.hfncA, ids.picu, 5);
      expect(byViewer.error?.code).toBe("42501");
    });

    it("revenue is volume × the price in force that month (from the database)", async () => {
      const detail = await loadHospitalDetail(as("viewerA"), ids.hospitalA);
      const periods = await loadPeriods(as("viewerA"), ids.hospitalA);
      const revenue = periods.map((p) => [p.input.month, calculatePeriod(detail!.config, p.input).revenue.value]);
      expect(revenue).toEqual([
        ["2026-01", 150_000],
        ["2026-02", 180_000],
        ["2026-03", 192_000],
      ]);

      const detailB = await loadHospitalDetail(as("managerB"), ids.hospitalB);
      const [janB] = await loadPeriods(as("managerB"), ids.hospitalB);
      const b = calculatePeriod(detailB!.config, janB!.input);
      expect(b.revenue.value).toBe(240_000);

      // Hospital vs hospital: same NIV volume, different price.
      const adminA = await loadHospitalDetail(as("admin"), ids.hospitalA);
      const [janA] = await loadPeriods(as("admin"), ids.hospitalA, ["2026-01"]);
      const variance = explainVariance(calculatePeriod(adminA!.config, janA!.input), b);
      expect(variance.drivers).toEqual([expect.objectContaining({ kind: "service_price", subject: "NIV", effect: 90_000 })]);
    });

    it("status changes go through set_period_status, not direct updates", async () => {
      const direct = await as("managerA").from("operating_periods").update({ status: "finalized" } as never).eq("id", ids.janA);
      expect(direct.error?.code).toBe("42501");
      const byViewer = await as("viewerA").rpc("set_period_status", { p_period: ids.janA, p_status: "in_review" });
      expect(byViewer.error?.code).toBe("42501");
      await as("managerA").rpc("set_period_status", { p_period: ids.janA, p_status: "in_review" }).throwOnError();
      await as("managerA").rpc("set_period_status", { p_period: ids.janA, p_status: "finalized", p_snapshot: { revenue: 150000 } }).throwOnError();
      const { data } = await as("viewerA").from("operating_periods").select("status, finalized_by, finalized_snapshot").eq("id", ids.janA).single();
      expect(data).toEqual({ status: "finalized", finalized_by: users.managerA!.id, finalized_snapshot: { revenue: 150000 } });
    });

    it("a finalized month cannot be changed by managers, and nothing is deleted", async () => {
      const edit = await as("managerA").from("service_activity").update({ quantity: 999 }).eq("period_id", ids.janA).eq("department_id", ids.aicu);
      expect(edit.error?.code).toBe("42501");
      const add = await activity(as("managerA"), ids.janA, ids.hfncA, ids.picu, 5);
      expect(add.error?.code).toBe("42501");
      const del = await as("admin").from("service_activity").delete().eq("period_id", ids.janA);
      expect(del.error?.message).toContain("cannot be deleted");
      const reopen = await as("managerA").rpc("set_period_status", { p_period: ids.janA, p_status: "draft" });
      expect(reopen.error?.code).toBe("42501");
    });

    it("a new price that would change a finalized month is an Admin correction with a reason", async () => {
      // HFNC had no January price; adding one now would change finalized January.
      const hfnc = (db: Db, extra: Record<string, unknown> = {}) =>
        db
          .from("service_price_versions")
          .insert({ hospital_id: ids.hospitalA, hospital_service_id: ids.hfncA, amount: 900, billing_unit: "per_day", effective_from: "2026-01-01", ...extra })
          .select("id")
          .single();
      expect((await hfnc(as("managerA"))).error?.code).toBe("42501");
      expect((await hfnc(as("admin"))).error?.message).toContain("reason is required");
      // Changing the current NIV price (from October) leaves January to March untouched.
      await as("managerA")
        .from("service_price_versions")
        .insert({ hospital_id: ids.hospitalA, hospital_service_id: ids.nivA, amount: 2000, billing_unit: "per_day", effective_from: "2026-10-01" })
        .throwOnError();
      const voidJan = await as("managerA").from("service_price_versions").update({ voided: true, void_reason: "Wrong" }).eq("id", ids.janPriceA);
      expect(voidJan.error?.code).toBe("42501");

      const detail = await loadHospitalDetail(as("admin"), ids.hospitalA);
      const periods = await loadPeriods(as("admin"), ids.hospitalA);
      expect(periods.map((p) => calculatePeriod(detail!.config, p.input).revenue.value)).toEqual([150_000, 180_000, 192_000]);
    });

    it("Admin corrections to a finalized month need a reason and are audited with it", async () => {
      const noReason = await as("admin").from("service_activity").update({ quantity: 65 }).eq("period_id", ids.janA).eq("department_id", ids.aicu);
      expect(noReason.error?.message).toContain("reason is required");

      const corrected = await as("admin")
        .from("service_activity")
        .update({ quantity: 65, change_reason: "Late AICU charts added" })
        .eq("period_id", ids.janA)
        .eq("department_id", ids.aicu)
        .select("quantity")
        .single();
      expect(corrected.data).toEqual({ quantity: 65 });

      const { data: audit } = await as("admin")
        .from("audit_log")
        .select("hospital_id, period_id, entity_type, entity_label, field_name, old_value, new_value, action, reason, actor_name")
        .eq("period_id", ids.janA)
        .eq("action", "correction");
      expect(audit).toEqual([
        {
          hospital_id: ids.hospitalA,
          period_id: ids.janA,
          entity_type: "service_activity",
          entity_label: "NIV — AICU",
          field_name: "quantity",
          old_value: "60",
          new_value: "65",
          action: "correction",
          reason: "Late AICU charts added",
          actor_name: "Test admin",
        },
      ]);

      // The reason applies to that one change only.
      const again = await as("admin").from("service_activity").update({ quantity: 60 }).eq("period_id", ids.janA).eq("department_id", ids.aicu);
      expect(again.error?.message).toContain("reason is required");
      await as("admin")
        .from("service_activity")
        .update({ quantity: 60, change_reason: "Reverted: charts were duplicates" })
        .eq("period_id", ids.janA)
        .eq("department_id", ids.aicu)
        .throwOnError();
    });

    it("locking and unlocking are Admin-only; unlocking needs a reason and is audited", async () => {
      const byManager = await as("managerA").rpc("set_period_status", { p_period: ids.janA, p_status: "locked" });
      expect(byManager.error?.code).toBe("42501");
      await as("admin").rpc("set_period_status", { p_period: ids.janA, p_status: "locked" }).throwOnError();
      const noReason = await as("admin").rpc("set_period_status", { p_period: ids.janA, p_status: "finalized" });
      expect(noReason.error?.message).toContain("reason is required");
      await as("admin").rpc("set_period_status", { p_period: ids.janA, p_status: "finalized", p_reason: "Auditor query on January" }).throwOnError();

      const { data } = await as("admin")
        .from("audit_log")
        .select("old_value, new_value, action, reason")
        .eq("period_id", ids.janA)
        .eq("entity_type", "period")
        .eq("field_name", "status")
        .order("id");
      expect(data).toEqual([
        { old_value: "draft", new_value: "in_review", action: "status", reason: null },
        { old_value: "in_review", new_value: "finalized", action: "status", reason: null },
        { old_value: "finalized", new_value: "locked", action: "status", reason: null },
        { old_value: "locked", new_value: "finalized", action: "status", reason: "Auditor query on January" },
      ]);
    });
  });

  describe("audit visibility and inactive hospitals", () => {
    it("managers see their hospitals' audit; viewers and other hospitals' managers do not", async () => {
      const a = await as("managerA").from("audit_log").select("hospital_id").eq("organization_id", orgId);
      expect(a.data!.length).toBeGreaterThan(0);
      expect(new Set(a.data!.map((r) => r.hospital_id))).toEqual(new Set([ids.hospitalA]));
      const viewer = await as("viewerA").from("audit_log").select("id").eq("organization_id", orgId);
      expect(viewer.data).toEqual([]);
      const b = await as("managerB").from("audit_log").select("hospital_id").eq("hospital_id", ids.hospitalA);
      expect(b.data).toEqual([]);
    });

    it("an inactive hospital stays readable but managers can no longer change it", async () => {
      await as("admin").from("hospitals").update({ active: false }).eq("id", ids.hospitalB).throwOnError();
      const read = await as("managerB").from("hospitals").select("active").eq("id", ids.hospitalB).single();
      expect(read.data).toEqual({ active: false });
      const write = await as("managerB").from("hospital_departments").insert({ hospital_id: ids.hospitalB, name: "New unit" });
      expect(write.error?.code).toBe("42501");
      await as("admin").from("hospitals").update({ active: true }).eq("id", ids.hospitalB).throwOnError();
    });
  });

  describe("Workbook Value Model per hospital", () => {
    it("Admins attach the workbook model; hospital data starts blank", async () => {
      const byManager = await as("managerA").rpc("enable_workbook_model", { p_hospital: ids.hospitalA });
      expect(byManager.error?.code).toBe("42501");
      await as("admin").rpc("enable_workbook_model", { p_hospital: ids.hospitalA }).throwOnError();

      const { data: inputs } = await as("managerA").from("hospital_inputs").select("key, numeric_value, source_type").eq("hospital_id", ids.hospitalA);
      expect(inputs).toHaveLength(55);
      const icu = inputs!.find((i) => i.key === "icu_beds");
      expect(icu).toEqual({ key: "icu_beds", numeric_value: null, source_type: "hospital_data" });
      expect(inputs!.find((i) => i.key === "days_per_year")?.numeric_value).toBe(365);

      const { data: scenarios } = await as("viewerA").from("scenario_assumptions").select("scenario_name, is_default").eq("hospital_id", ids.hospitalA);
      expect(scenarios).toEqual([{ scenario_name: "Workbook default", is_default: true }]);
      const other = await as("managerB").from("hospital_inputs").select("id").eq("hospital_id", ids.hospitalA);
      expect(other.data).toEqual([]);
    });
  });
});
