/**
 * Snapshot of the database objects the platform relies on: tables (with RLS),
 * policies, functions, triggers, indexes, enums and the privileges of the API
 * roles. Used to keep supabase/schema-manifest.json in sync with the migrations
 * and to verify a hosted Supabase project against it.
 */
import type { Client } from "pg";

export interface Catalog {
  tables: { name: string; kind: string; rls: boolean }[];
  policies: { table: string; name: string; cmd: string; roles: string[] }[];
  functions: { schema: string; name: string; args: string; securityDefiner: boolean }[];
  triggers: { table: string; name: string }[];
  indexes: { table: string; name: string }[];
  enums: { name: string; labels: string[] }[];
  /** "role:PRIVILEGE" per table, e.g. "authenticated:SELECT". */
  tablePrivileges: Record<string, string[]>;
  /** Column-level INSERT/UPDATE grants where no table-level grant exists, e.g. "authenticated:UPDATE(voided)". */
  columnPrivileges: Record<string, string[]>;
  /** Roles allowed to execute each function in the public and private schemas. */
  functionPrivileges: Record<string, string[]>;
}

const ROLES = ["anon", "authenticated"] as const;
const PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;

export async function readCatalog(db: Client): Promise<Catalog> {
  const q = async <T>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];

  const tables = await q<{ name: string; kind: string; rls: boolean }>(
    `select c.relname as name, c.relkind::text as kind, c.relrowsecurity as rls
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'v', 'p')
      order by 1`,
  );
  const policies = await q<{ table: string; name: string; cmd: string; roles: string[] }>(
    `select tablename as "table", policyname as name, cmd, roles::text[] as roles
       from pg_policies where schemaname = 'public' order by 1, 2`,
  );
  const functions = await q<{ schema: string; name: string; args: string; securityDefiner: boolean }>(
    `select n.nspname as schema, p.proname as name, pg_get_function_identity_arguments(p.oid) as args,
            p.prosecdef as "securityDefiner"
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      order by 1, 2, 3`,
  );
  const triggers = await q<{ table: string; name: string }>(
    `select c.relname as "table", t.tgname as name
       from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and not t.tgisinternal order by 1, 2`,
  );
  const indexes = await q<{ table: string; name: string }>(
    `select tablename as "table", indexname as name from pg_indexes where schemaname = 'public' order by 1, 2`,
  );
  const enums = await q<{ name: string; labels: string[] }>(
    `select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder)::text[] as labels
       from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' group by 1 order by 1`,
  );

  const tablePrivileges: Record<string, string[]> = {};
  const columnPrivileges: Record<string, string[]> = {};
  for (const t of tables) {
    const table = `public.${t.name}`;
    const granted: string[] = [];
    for (const role of ROLES) {
      for (const privilege of PRIVILEGES) {
        const [{ ok }] = await q<{ ok: boolean }>(`select has_table_privilege($1, $2, $3) as ok`, [role, table, privilege]);
        if (ok) granted.push(`${role}:${privilege}`);
      }
    }
    tablePrivileges[t.name] = granted;
    const columns = await q<{ role: string; privilege: string; column: string }>(
      `select r.role, p.privilege, a.attname as "column"
         from pg_attribute a
         cross join (values ('anon'), ('authenticated')) as r(role)
         cross join (values ('INSERT'), ('UPDATE')) as p(privilege)
        where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped
          and has_column_privilege(r.role, a.attrelid, a.attnum, p.privilege)
          and not has_table_privilege(r.role, a.attrelid, p.privilege)
        order by 1, 2, 3`,
      [table],
    );
    const byKey = new Map<string, string[]>();
    for (const c of columns) {
      const key = `${c.role}:${c.privilege}`;
      byKey.set(key, [...(byKey.get(key) ?? []), c.column]);
    }
    const cols = [...byKey.entries()].map(([k, list]) => `${k}(${list.join(",")})`);
    if (cols.length) columnPrivileges[t.name] = cols;
  }

  const functionPrivileges: Record<string, string[]> = {};
  for (const f of functions) {
    const signature = `${f.schema}.${f.name}(${f.args})`;
    const roles: string[] = [];
    for (const role of ROLES) {
      const [{ ok }] = await q<{ ok: boolean }>(
        `select has_function_privilege($1, p.oid, 'EXECUTE') as ok
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = $2 and p.proname = $3 and pg_get_function_identity_arguments(p.oid) = $4`,
        [role, f.schema, f.name, f.args],
      );
      if (ok) roles.push(role);
    }
    functionPrivileges[signature] = roles;
  }

  return { tables, policies, functions, triggers, indexes, enums, tablePrivileges, columnPrivileges, functionPrivileges };
}

export interface CatalogDiff {
  /** Expected but absent or different: the database does not match the migrations. */
  readonly missing: string[];
  /** Present but not expected (e.g. objects added outside the migrations). */
  readonly extra: string[];
}

function keys(c: Catalog): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of c.tables) m.set(`table ${t.name}`, `${t.kind} rls=${t.rls}`);
  for (const p of c.policies) m.set(`policy ${p.table}.${p.name}`, `${p.cmd} ${[...p.roles].sort().join(",")}`);
  for (const f of c.functions) m.set(`function ${f.schema}.${f.name}(${f.args})`, `definer=${f.securityDefiner}`);
  for (const t of c.triggers) m.set(`trigger ${t.table}.${t.name}`, "");
  for (const i of c.indexes) m.set(`index ${i.table}.${i.name}`, "");
  for (const e of c.enums) m.set(`enum ${e.name}`, e.labels.join(","));
  for (const [t, privs] of Object.entries(c.tablePrivileges)) m.set(`privileges ${t}`, [...privs].sort().join(" "));
  for (const [t, privs] of Object.entries(c.columnPrivileges)) m.set(`column privileges ${t}`, [...privs].sort().join(" "));
  for (const [f, roles] of Object.entries(c.functionPrivileges)) m.set(`execute ${f}`, [...roles].sort().join(","));
  return m;
}

/** Compare a database catalog with the expected one. */
export function diffCatalog(expected: Catalog, actual: Catalog): CatalogDiff {
  const e = keys(expected);
  const a = keys(actual);
  const missing: string[] = [];
  const extra: string[] = [];
  for (const [k, v] of e) {
    if (!a.has(k)) missing.push(k);
    else if (a.get(k) !== v) missing.push(`${k}: expected "${v}", found "${a.get(k)}"`);
  }
  for (const k of a.keys()) if (!e.has(k)) extra.push(k);
  return { missing, extra };
}
