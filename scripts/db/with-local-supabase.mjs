#!/usr/bin/env node
/**
 * Runs a command with TEST_SUPABASE_* variables taken from the running local
 * Supabase stack (`supabase start`). Local development keys only.
 *
 *   node scripts/db/with-local-supabase.mjs vitest run supabase/tests
 */
import { execFileSync, spawnSync } from "node:child_process";

let status;
try {
  status = JSON.parse(execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
} catch {
  console.error("Local Supabase is not running. Start it with `pnpm db:start` (requires Docker).");
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    TEST_SUPABASE_URL: status.API_URL,
    TEST_SUPABASE_ANON_KEY: status.ANON_KEY,
    TEST_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  },
});
process.exit(result.status ?? 1);
