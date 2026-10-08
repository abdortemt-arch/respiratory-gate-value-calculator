/**
 * Verify a hosted Supabase project (staging or production) without changing it:
 *   - every migration applied, none unknown
 *   - tables, RLS, policies, functions, triggers, indexes, enums and API-role
 *     privileges match supabase/schema-manifest.json
 *   - reference data present; no demo data; test leftovers reported
 *   - Auth: sign-up disabled (invite-only), email sign-in enabled
 *   - anonymous requests are refused by the Data API
 *
 *   SUPABASE_DB_URL=… SUPABASE_URL=… SUPABASE_ANON_KEY=… pnpm db:verify-hosted [--before-migrate | --api-only]
 *
 * Read-only. Never prints connection strings or keys.
 */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { diffCatalog, readCatalog } from "./catalog";
import { loadManifest } from "./schema-manifest";

const ORG = "00000000-0000-4000-8000-000000000001";
const results: { level: "ok" | "warn" | "fail"; message: string }[] = [];
const ok = (message: string) => results.push({ level: "ok", message });
const warn = (message: string) => results.push({ level: "warn", message });
const fail = (message: string) => results.push({ level: "fail", message });

function localMigrations(): string[] {
  const dir = fileURLToPath(new URL("../../supabase/migrations", import.meta.url));
  return readdirSync(dir)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .map((f) => f.slice(0, 14))
    .sort();
}

async function checkDatabase(dbUrl: string, beforeMigrate: boolean) {
  const host = new URL(dbUrl).hostname;
  const local = host === "127.0.0.1" || host === "localhost";
  const db = new pg.Client({ connectionString: dbUrl, ssl: local ? undefined : { rejectUnauthorized: false } });
  await db.connect();
  try {
    const { rows: version } = await db.query("select current_setting('server_version') as v");
    ok(`Connected to Postgres ${version[0].v} at ${host}`);

    // 1. Migration history
    const expected = localMigrations();
    const { rows: hist } = await db
      .query("select version from supabase_migrations.schema_migrations order by version")
      .catch(() => ({ rows: [] as { version: string }[] }));
    const applied = hist.map((r) => r.version);
    const pending = expected.filter((v) => !applied.includes(v));
    const unknown = applied.filter((v) => !expected.includes(v));
    if (unknown.length) fail(`Migrations applied remotely but not in this branch: ${unknown.join(", ")}`);
    if (beforeMigrate) {
      ok(`Applied: ${applied.length ? applied.join(", ") : "none"}; pending: ${pending.length ? pending.join(", ") : "none"}`);
      const latest = applied.at(-1);
      if (latest && pending.some((v) => v < latest)) {
        fail(`Pending migration(s) ${pending.filter((v) => v < latest).join(", ")} are older than the latest applied ${latest}`);
      }
      return; // the catalog is checked after migrating
    }
    if (pending.length) fail(`Migrations not applied: ${pending.join(", ")}`);
    else ok(`All ${expected.length} migrations applied (${expected.at(0)} … ${expected.at(-1)})`);

    // 2. Catalog vs manifest
    const { missing, extra } = diffCatalog(loadManifest(), await readCatalog(db));
    if (missing.length) for (const m of missing) fail(`Schema: ${m}`);
    else ok("Tables, RLS, policies, functions, triggers, indexes, enums and API-role privileges match the migrations");
    for (const x of extra) warn(`Schema object not created by the migrations: ${x}`);
    const { rows: noRls } = await db.query(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
    );
    if (noRls.length) fail(`Tables without row-level security: ${noRls.map((r) => r.relname).join(", ")}`);
    else ok("Row-level security is enabled on every public table");

    // 3. Reference data, demo data, test leftovers
    const one = async (sql: string, params: unknown[] = []) => Number((await db.query(sql, params)).rows[0].n);
    const org = (await db.query("select name from public.organizations where id = $1", [ORG])).rows[0];
    if (!org) fail("The operator organisation is missing");
    else ok(`Organisation: ${org.name}`);
    if ((await one("select count(*) as n from public.hospitals where code = 'ELITE' and organization_id = $1", [ORG])) === 1) ok("Elite Hospital present with the Workbook Value Model");
    else fail("Elite Hospital (code ELITE) is missing");
    const library = await one("select count(*) as n from public.services where organization_id = $1", [ORG]);
    if (library >= 15) ok(`Service library: ${library} services`);
    else fail(`Service library has ${library} services (expected at least 15)`);
    const demo = await one("select count(*) as n from public.hospitals where code in ('DEMO-A', 'DEMO-B') or notes ilike '%synthetic demo data%'");
    if (demo) fail(`Synthetic demo hospitals found: ${demo} (pnpm db:demo must never run against this project)`);
    else ok("No synthetic demo data");
    const leftovers = await one(
      "select count(*) as n from public.organizations where name ~ '^(RLS test|Hospitals test|E2E Org|E2E Platform) '",
    );
    if (leftovers) warn(`${leftovers} automated-test organisation(s) left behind (isolated from real data; remove with the cleanup in docs/staging-deployment.md)`);
    else ok("No automated-test organisations left behind");
    const admins = await one("select count(*) as n from public.profiles where organization_id = $1 and role = 'admin' and active", [ORG]);
    if (admins) ok(`Active Admins: ${admins}`);
    else warn("No Admin yet: create the first Admin (docs/staging-deployment.md, step 4)");

    // 4. Immutability guarantees
    const { rows: priv } = await db.query(`
      select has_table_privilege('authenticated', 'public.service_price_versions', 'DELETE') as price_delete,
             has_column_privilege('authenticated', 'public.service_price_versions', 'amount', 'UPDATE') as price_amount,
             has_column_privilege('authenticated', 'public.cost_versions', 'amount', 'UPDATE') as cost_amount,
             has_table_privilege('authenticated', 'public.audit_log', 'INSERT') as audit_insert,
             has_table_privilege('authenticated', 'public.audit_log', 'UPDATE') as audit_update,
             has_table_privilege('authenticated', 'public.audit_log', 'DELETE') as audit_delete,
             has_table_privilege('authenticated', 'public.hospitals', 'DELETE') as hospital_delete`);
    const p = priv[0];
    if (Object.values(p).some(Boolean)) fail(`Immutability grants are wrong: ${JSON.stringify(p)}`);
    else ok("Price/cost versions cannot be edited or deleted; the audit log and hospitals cannot be written or deleted by app users");
  } finally {
    await db.end();
  }
}

async function checkApi(url: string, anonKey: string) {
  const base = url.replace(/\/$/, "");
  const settings = await fetch(`${base}/auth/v1/settings`, { headers: { apikey: anonKey } });
  if (!settings.ok) {
    fail(`Auth settings unavailable (HTTP ${settings.status}) — check the project URL and anon key`);
    return;
  }
  const s = (await settings.json()) as { disable_signup?: boolean; external?: { email?: boolean } };
  if (s.disable_signup === true) ok("Auth: public sign-up is disabled (invite-only)");
  else fail("Auth: public sign-up is ENABLED — turn off “Allow new users to sign up”");
  if (s.external?.email) ok("Auth: email + password sign-in is enabled");
  else fail("Auth: the Email provider is disabled — sign-in will not work");

  for (const table of ["hospitals", "service_price_versions", "audit_log", "profiles", "hospital_inputs"]) {
    const r = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, { headers: { apikey: anonKey } });
    const body = r.ok ? ((await r.json()) as unknown[]) : null;
    if (!r.ok || (Array.isArray(body) && body.length === 0)) ok(`Anonymous read of ${table} refused (HTTP ${r.status})`);
    else fail(`Anonymous request can read ${table}`);
  }
  const rpc = await fetch(`${base}/rest/v1/rpc/set_period_status`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ p_period: ORG, p_status: "locked" }),
  });
  if (!rpc.ok) ok(`Anonymous RPC set_period_status refused (HTTP ${rpc.status})`);
  else fail("Anonymous RPC set_period_status was accepted");
}

async function main() {
  const beforeMigrate = process.argv.includes("--before-migrate");
  const apiOnly = process.argv.includes("--api-only");
  const dbUrl = process.env.SUPABASE_DB_URL;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!dbUrl && !apiOnly) {
    console.error("Set SUPABASE_DB_URL (session pooler connection string).");
    process.exit(2);
  }
  if (!apiOnly) await checkDatabase(dbUrl!, beforeMigrate);
  if (!beforeMigrate) {
    if (url && anonKey) await checkApi(url, anonKey);
    else warn("SUPABASE_URL / SUPABASE_ANON_KEY not set: Auth and API checks skipped");
  }
  for (const r of results) console.log(`${r.level === "ok" ? "✔" : r.level === "warn" ? "!" : "✘"} ${r.message}`);
  const failed = results.filter((r) => r.level === "fail").length;
  console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  // pg errors can include the host but never the password; keep messages short.
  console.error(`Verification error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
