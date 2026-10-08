/**
 * Guards against leaking credentials:
 *   1. no keys, JWTs, secret keys or database passwords in tracked files
 *   2. the service-role key is referenced only from server-only modules, and
 *      no client component imports server code
 *   3. --bundle: nothing secret in the browser bundle (.next/static and
 *      prerendered pages) — including the actual key value when it is set in
 *      the environment
 *
 *   pnpm check:secrets            # 1 + 2
 *   pnpm check:secrets --bundle   # 1 + 2 + 3 (after `pnpm build`)
 *
 * Findings name the file and pattern, never the matched value.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const problems: string[] = [];
const BINARY = /\.(png|jpe?g|gif|webp|ico|xlsx|zip|pdf|woff2?|ttf)$/i;

const JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "Supabase secret key (sb_secret_…)", re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: "Supabase publishable key (sb_publishable_…)", re: /sb_publishable_[A-Za-z0-9_-]{10,}/ },
  { name: "Vercel token", re: /\b(vercel_|vc_)[A-Za-z0-9]{20,}/ },
  { name: "Supabase access token (sbp_…)", re: /\bsbp_[A-Za-z0-9]{20,}/ },
];
const DB_URL = /postgres(?:ql)?:\/\/[^:\s/"'`]+:([^@\s"'`]+)@([^\s/:"'`]+)/g;

function jwtRole(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { role?: string; iss?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

function scanText(file: string, text: string, { allowLocalJwt }: { allowLocalJwt: boolean }) {
  for (const { name, re } of PATTERNS) if (re.test(text)) problems.push(`${file}: ${name}`);
  for (const m of text.matchAll(JWT)) {
    const role = jwtRole(m[0]);
    if (role === "service_role" || !allowLocalJwt) problems.push(`${file}: JWT${role ? ` (role ${role})` : ""}`);
  }
  for (const m of text.matchAll(DB_URL)) {
    const [, password, host] = m;
    const local = ["127.0.0.1", "localhost", "db", "host.docker.internal"].includes(host);
    const placeholder = /^\[.*\]$|^\$|YOUR|PASSWORD|<|\*/i.test(password);
    if (!local && !placeholder) problems.push(`${file}: database connection string with a password (host ${host})`);
  }
}

// 1. Tracked files
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
for (const file of tracked) {
  if (/(^|\/)\.env($|\.)/.test(file) && file !== ".env.example") problems.push(`${file}: environment file is tracked`);
  if (BINARY.test(file) || !existsSync(file) || statSync(file).size > 2_000_000) continue;
  scanText(file, readFileSync(file, "utf8"), { allowLocalJwt: false });
}

// 2. Server-only boundary
// Reading the value (not mentioning the name in help text). getServiceRoleKey() lives in a
// server-only module, so any client import of it already fails the build.
const SECRET_ACCESS = /process\.env(\.|\[["'`])(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)|readEnv\([^)]*(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)/;
const srcFiles = tracked.filter((f) => f.startsWith("src/") && /\.(ts|tsx)$/.test(f));
for (const file of srcFiles) {
  const text = readFileSync(file, "utf8");
  const serverOnly = /^import "server-only";/m.test(text);
  if (SECRET_ACCESS.test(text) && !serverOnly) problems.push(`${file}: reads the service-role key without import "server-only"`);
  if (/^["']use client["']/m.test(text) && /from ["'](@\/server\/|(\.\.\/)+server\/)/.test(text)) {
    problems.push(`${file}: client component imports server code`);
  }
  if (/NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET)/.test(text)) problems.push(`${file}: a NEXT_PUBLIC_ variable name suggests a secret`);
}
for (const file of ["src/server/supabase/admin.ts", "src/server/env.ts"]) {
  if (!/^import "server-only";/m.test(readFileSync(file, "utf8"))) problems.push(`${file}: must import "server-only"`);
}

// 3. Browser bundle
if (process.argv.includes("--bundle")) {
  const roots = [".next/static", ".next/server/app"].filter(existsSync);
  if (roots.length === 0) problems.push("--bundle: no .next build output; run `pnpm build` first");
  const secretValues = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "TEST_SUPABASE_SERVICE_ROLE_KEY"]
    .map((n) => process.env[n])
    .filter((v): v is string => Boolean(v && v.length > 20));
  let scanned = 0;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (dir.startsWith(".next/static") ? /\.(js|css|json|txt|map)$/.test(entry) : /\.(html|rsc|body|meta)$/.test(entry)) {
        const text = readFileSync(path, "utf8");
        scanned++;
        if (/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/.test(text)) problems.push(`${path}: contains a service-role variable name`);
        for (const v of secretValues) if (text.includes(v)) problems.push(`${path}: contains the service-role key value`);
        scanText(path, text, { allowLocalJwt: true });
      }
    }
  };
  for (const r of roots) walk(r);
  console.log(`Scanned ${scanned} browser-facing build files.`);
}

if (problems.length) {
  for (const p of problems) console.error(`✘ ${p}`);
  console.error(`\n${problems.length} problem(s). Remove the secret, rotate it if it was ever committed, and use environment variables.`);
  process.exit(1);
}
console.log(`✔ No secrets in ${tracked.length} tracked files; service-role key only in server-only modules${process.argv.includes("--bundle") ? "; browser bundle clean" : ""}.`);
