/**
 * supabase/schema-manifest.json records the database objects the migrations
 * create. It is generated from a freshly migrated local database and checked
 * in CI, then used to verify hosted projects (scripts/db/verify-hosted.ts).
 *
 *   pnpm db:manifest           # check the local database against the manifest
 *   pnpm db:manifest --write   # regenerate after changing migrations
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { diffCatalog, readCatalog, type Catalog } from "./catalog";

export const MANIFEST = fileURLToPath(new URL("../../supabase/schema-manifest.json", import.meta.url));

export function loadManifest(): Catalog {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Catalog;
}

async function main() {
  const url = process.env.LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    const catalog = await readCatalog(db);
    if (process.argv.includes("--write")) {
      writeFileSync(MANIFEST, `${JSON.stringify(catalog, null, 2)}\n`);
      console.log(`Wrote ${MANIFEST}: ${catalog.tables.length} tables, ${catalog.policies.length} policies, ${catalog.functions.length} functions, ${catalog.triggers.length} triggers, ${catalog.indexes.length} indexes.`);
      return;
    }
    const { missing, extra } = diffCatalog(loadManifest(), catalog);
    if (missing.length || extra.length) {
      for (const m of missing) console.error(`missing/different: ${m}`);
      for (const x of extra) console.error(`not in manifest: ${x}`);
      console.error("The local database does not match supabase/schema-manifest.json. After changing migrations run `pnpm db:manifest --write`.");
      process.exit(1);
    }
    console.log("Local database matches supabase/schema-manifest.json.");
  } finally {
    await db.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
