import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running app and a local Supabase stack:
 *   pnpm db:start && pnpm dev   (in another terminal)
 *   pnpm test:e2e
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE overrides the browser binary (e.g. a preinstalled Chromium).
 * Hosted: E2E_BASE_URL=<preview URL>, VERCEL_AUTOMATION_BYPASS_SECRET, and TEST_SUPABASE_* for the
 * hosted project (the tests create isolated test organisations and remove them afterwards).
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Hosted runs (E2E_BASE_URL) cross the Atlantic from CI runners: allow more time.
  timeout: process.env.E2E_BASE_URL ? 180_000 : 60_000,
  expect: { timeout: process.env.E2E_BASE_URL ? 20_000 : 5_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    // Vercel preview deployments are protected; automation passes with the project's bypass secret.
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" }
      : undefined,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
