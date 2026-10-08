import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running app and a local Supabase stack:
 *   pnpm db:start && pnpm dev   (in another terminal)
 *   pnpm test:e2e
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE overrides the browser binary (e.g. a preinstalled Chromium).
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
