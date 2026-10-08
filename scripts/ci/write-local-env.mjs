#!/usr/bin/env node
/**
 * Writes .env.local from the running local Supabase stack (local development
 * keys only — never use this against a hosted project).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const status = JSON.parse(execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
writeFileSync(
  ".env.local",
  [
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${status.ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
    "",
  ].join("\n"),
);
console.log("Wrote .env.local for the local Supabase stack.");
