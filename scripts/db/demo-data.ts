/**
 * Load SYNTHETIC demo data: two demo hospitals with departments, services,
 * effective-dated prices and costs, equipment and three months of activity.
 * For trying the platform locally; every record is labelled as demo data.
 *
 *   pnpm db:demo                 # local Supabase (from .env.local)
 *   pnpm db:demo --remote        # required to write to a hosted project
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Idempotent:
 * does nothing if the demo hospitals already exist.
 */
import { parseArgs } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const NOTE = "Synthetic demo data — not real hospital data.";

type Row = Record<string, unknown>;

async function insert(db: SupabaseClient, table: string, rows: Row | Row[]): Promise<{ id: string }[]> {
  const { data, error } = await db.from(table).insert(rows).select("id");
  if (error) throw new Error(`${table}: ${error.message}`);
  return data as { id: string }[];
}

async function main() {
  const { values } = parseArgs({ options: { remote: { type: "boolean", default: false }, organization: { type: "string" } } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local).");
    process.exit(1);
  }
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url);
  if (!local && !values.remote) {
    console.error(`Refusing to write demo data to ${url}. Pass --remote if you really want demo hospitals there.`);
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let org = values.organization;
  if (!org) {
    const { data } = await db.from("organizations").select("id");
    if (data?.length !== 1) {
      console.error("Pass --organization <id> (found more than one organisation, or none).");
      process.exit(1);
    }
    org = data[0].id as string;
  }
  const { data: existing } = await db.from("hospitals").select("id").eq("organization_id", org).in("code", ["DEMO-A", "DEMO-B"]);
  if (existing?.length) {
    console.log("Demo hospitals already exist. Nothing to do.");
    return;
  }
  const { data: library } = await db.from("services").select("id, name").eq("organization_id", org);
  const svc = (name: string) => {
    const s = library?.find((x) => x.name === name);
    if (!s) throw new Error(`Service library is missing ${name}. Apply the migrations first.`);
    return s.id as string;
  };

  // ── Hospitals and departments ──────────────────────────────────────────
  const [a] = await insert(db, "hospitals", { organization_id: org, name: "Demo Hospital A", code: "DEMO-A", hospital_type: "teaching", total_beds: 300, location: "Cairo (demo)", notes: NOTE });
  const [b] = await insert(db, "hospitals", { organization_id: org, name: "Demo Hospital B", code: "DEMO-B", hospital_type: "private", total_beds: 180, location: "Alexandria (demo)", notes: NOTE });
  const [aicu, picu, nicu] = await insert(db, "hospital_departments", [
    { hospital_id: a.id, name: "AICU", category: "adult_icu", beds: 12, sort_order: 1 },
    { hospital_id: a.id, name: "PICU", category: "picu", beds: 8, sort_order: 2 },
    { hospital_id: a.id, name: "NICU", category: "nicu", beds: 10, sort_order: 3 },
  ]);
  const [bIcu, bCcu] = await insert(db, "hospital_departments", [
    { hospital_id: b.id, name: "ICU", category: "adult_icu", beds: 20, sort_order: 1 },
    { hospital_id: b.id, name: "CCU", category: "ccu", beds: 8, sort_order: 2 },
  ]);

  // ── Services and department assignments ────────────────────────────────
  const hs = async (hospital: string, name: string, departments: string[]) => {
    const [row] = await insert(db, "hospital_services", { organization_id: org, hospital_id: hospital, service_id: svc(name) });
    if (departments.length) {
      await insert(db, "hospital_service_departments", departments.map((d) => ({ hospital_id: hospital, hospital_service_id: row.id, department_id: d })));
    }
    return row.id;
  };
  const aNiv = await hs(a.id, "NIV", [aicu.id, picu.id]);
  const aHfnc = await hs(a.id, "HFNC", [picu.id, nicu.id]);
  const aImv = await hs(a.id, "Invasive Mechanical Ventilation", [aicu.id]);
  const aAbg = await hs(a.id, "ABG", [aicu.id, picu.id]);
  const bNiv = await hs(b.id, "NIV", [bIcu.id, bCcu.id]);
  const bImv = await hs(b.id, "Invasive Mechanical Ventilation", [bIcu.id]);

  // ── Prices (effective-dated) ───────────────────────────────────────────
  const price = (hospital: string, service: string, amount: number, unit: string, month: string, notes?: string) => ({
    hospital_id: hospital,
    hospital_service_id: service,
    amount,
    billing_unit: unit,
    effective_from: `${month}-01`,
    notes: notes ?? null,
  });
  await insert(db, "service_price_versions", [
    price(a.id, aNiv, 1500, "per_case", "2026-01", "Demo opening price"),
    price(a.id, aNiv, 1800, "per_case", "2026-02", "Demo price increase"),
    price(a.id, aNiv, 1600, "per_case", "2026-03", "Demo negotiated price"),
    price(a.id, aHfnc, 900, "per_day", "2026-01"),
    price(a.id, aImv, 2500, "per_ventilator_day", "2026-01"),
    price(a.id, aAbg, 150, "per_procedure", "2026-01"),
    price(b.id, bNiv, 2400, "per_case", "2026-01"),
    price(b.id, bImv, 2800, "per_ventilator_day", "2026-01"),
  ]);

  // ── Equipment and costs (effective-dated) ──────────────────────────────
  const [aVents] = await insert(db, "equipment", [
    { hospital_id: a.id, name: "ICU ventilator", category: "ventilator", quantity: 10, ownership: "owned", department_id: aicu.id },
    { hospital_id: a.id, name: "NIV device", category: "niv_device", quantity: 4, ownership: "rented" },
  ]);
  await insert(db, "equipment", { hospital_id: b.id, name: "ICU ventilator", category: "ventilator", quantity: 8, ownership: "leased", department_id: bIcu.id });
  const item = async (hospital: string, row: Record<string, unknown>, versions: [number, string][]) => {
    const [ci] = await insert(db, "cost_items", { hospital_id: hospital, ...row });
    await insert(db, "cost_versions", versions.map(([amount, month]) => ({ hospital_id: hospital, cost_item_id: ci.id, amount, effective_from: `${month}-01` })));
    return ci.id;
  };
  const aRt = await item(a.id, { name: "Respiratory therapist", category: "staffing", basis: "per_unit", unit_label: "FTE", is_rt_staff: true }, [[25_000, "2026-01"], [27_000, "2026-03"]]);
  const aCircuit = await item(a.id, { name: "Ventilator circuit", category: "consumable", basis: "per_unit", unit_label: "circuit" }, [[450, "2026-01"], [520, "2026-02"], [480, "2026-03"]]);
  await item(a.id, { name: "NIV mask", category: "consumable", basis: "per_service_unit", unit_label: "mask", hospital_service_id: aNiv }, [[100, "2026-01"]]);
  await item(a.id, { name: "Ventilator maintenance contract", category: "maintenance", basis: "monthly", unit_label: "month", equipment_id: aVents.id }, [[10_000, "2026-01"]]);
  const bRt = await item(b.id, { name: "Respiratory therapist", category: "staffing", basis: "per_unit", unit_label: "FTE", is_rt_staff: true }, [[24_000, "2026-01"]]);
  const bCircuit = await item(b.id, { name: "Ventilator circuit", category: "consumable", basis: "per_unit", unit_label: "circuit" }, [[500, "2026-01"]]);

  // ── Monthly periods ────────────────────────────────────────────────────
  const period = async (hospital: string, month: string, data: { activity: [string, string | null, number][]; stats: [string | null, number, number, number, number][]; costs: [string, number][]; savings?: [string, string, number][] }) => {
    const [p] = await insert(db, "operating_periods", { hospital_id: hospital, period_month: `${month}-01`, notes: NOTE });
    await insert(db, "service_activity", data.activity.map(([s, d, q]) => ({ hospital_id: hospital, period_id: p.id, hospital_service_id: s, department_id: d, quantity: q })));
    await insert(db, "period_stats", data.stats.map(([d, patients, admissions, bedDays, ventDays]) => ({ hospital_id: hospital, period_id: p.id, department_id: d, patients, admissions, occupied_bed_days: bedDays, ventilator_days: ventDays })));
    await insert(db, "period_cost_entries", data.costs.map(([c, q]) => ({ hospital_id: hospital, period_id: p.id, cost_item_id: c, quantity: q })));
    if (data.savings?.length) {
      await insert(db, "period_savings", data.savings.map(([category, description, amount]) => ({ hospital_id: hospital, period_id: p.id, category, description, amount })));
    }
    return p.id;
  };
  const aJan = await period(a.id, "2026-01", {
    activity: [[aNiv, aicu.id, 60], [aNiv, picu.id, 40], [aHfnc, picu.id, 45], [aHfnc, nicu.id, 30], [aImv, aicu.id, 210], [aAbg, aicu.id, 320], [aAbg, picu.id, 140]],
    stats: [[aicu.id, 48, 52, 310, 210], [picu.id, 30, 33, 190, 40], [nicu.id, 26, 28, 250, 25]],
    costs: [[aRt, 6], [aCircuit, 100]],
    savings: [["oxygen_stewardship", "Oxygen titration protocol (demo)", 15_000]],
  });
  const aFeb = await period(a.id, "2026-02", {
    activity: [[aNiv, aicu.id, 100], [aNiv, picu.id, 0], [aHfnc, picu.id, 50], [aHfnc, nicu.id, 28], [aImv, aicu.id, 190], [aAbg, aicu.id, 300], [aAbg, picu.id, 150]],
    stats: [[aicu.id, 45, 47, 290, 190], [picu.id, 28, 30, 180, 35], [nicu.id, 25, 26, 240, 22]],
    costs: [[aRt, 6], [aCircuit, 120]],
    savings: [["consumable_standardization", "Circuit standardisation (demo)", 8_000]],
  });
  await period(a.id, "2026-03", {
    activity: [[aNiv, aicu.id, 120], [aNiv, picu.id, 0], [aHfnc, picu.id, 52], [aHfnc, nicu.id, 35], [aImv, aicu.id, 220], [aAbg, aicu.id, 330], [aAbg, picu.id, 145]],
    stats: [[aicu.id, 50, 54, 320, 220], [picu.id, 31, 34, 200, 38], [nicu.id, 27, 29, 260, 26]],
    costs: [[aRt, 7], [aCircuit, 110]],
  });
  const bJan = await period(b.id, "2026-01", {
    activity: [[bNiv, bIcu.id, 80], [bNiv, bCcu.id, 20], [bImv, bIcu.id, 260]],
    stats: [[bIcu.id, 55, 60, 520, 260], [bCcu.id, 18, 20, 190, 0]],
    costs: [[bRt, 5], [bCircuit, 90]],
  });
  await period(b.id, "2026-02", {
    activity: [[bNiv, bIcu.id, 85], [bNiv, bCcu.id, 25], [bImv, bIcu.id, 240]],
    stats: [[bIcu.id, 52, 55, 500, 240], [bCcu.id, 20, 22, 200, 0]],
    costs: [[bRt, 5], [bCircuit, 95]],
  });

  // Close January (status set directly by the service role; the app uses set_period_status).
  const now = new Date().toISOString();
  await db.from("operating_periods").update({ status: "finalized", finalized_at: now }).in("id", [aJan, bJan]).throwOnError();
  await db.from("operating_periods").update({ status: "in_review" }).eq("id", aFeb).throwOnError();

  console.log("Loaded synthetic demo data: Demo Hospital A (DEMO-A) and Demo Hospital B (DEMO-B), Jan–Mar 2026.");
  console.log("Managers and viewers need hospital access: Admin → hospital Settings → Access.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
