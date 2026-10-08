/**
 * Multi-hospital acceptance flow, step by step in the browser:
 * hospitals, departments, services, effective-dated prices, monthly periods,
 * revenue at each month's own price, and hospital vs hospital comparison.
 * Synthetic demo data only.
 */
import { expect, test, type Page } from "@playwright/test";
import { setupPlatformWorld, teardownPlatform, type PlatformWorld } from "./fixtures";

test.describe.configure({ mode: "serial" });

let world: PlatformWorld;
let hospitalA = "";
let hospitalB = "";

test.beforeAll(async () => {
  world = await setupPlatformWorld();
});

test.afterAll(async () => {
  if (world) await teardownPlatform(world);
});

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(world.email);
  await page.getByLabel("Password", { exact: true }).fill(world.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

async function createHospital(page: Page, name: string, code: string) {
  await page.goto("/hospitals");
  await page.getByRole("link", { name: "Add hospital" }).first().click();
  await expect(page).toHaveURL(/\/hospitals\/new$/);
  await page.getByLabel("Hospital name").fill(name);
  await page.getByLabel("Code").fill(code);
  await page.getByLabel("Hospital type").selectOption("teaching");
  await page.getByRole("button", { name: "Create hospital and continue" }).click();
  await page.waitForURL(/\/hospitals\/[0-9a-f-]{36}\/setup\/departments$/);
  return /\/hospitals\/([0-9a-f-]{36})\//.exec(page.url())![1];
}

async function addDepartment(page: Page, name: string, type: string, beds: string) {
  await page.getByLabel("Department name").first().fill(name);
  await page.getByLabel("Type").first().selectOption(type);
  await page.getByLabel("Beds").first().fill(beds);
  await page.getByRole("button", { name: "Add department" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`^${name}`) })).toBeVisible();
}

async function addService(page: Page, service: string, departments: string[]) {
  await page.getByLabel("Service", { exact: true }).selectOption({ label: service });
  for (const d of departments) await page.getByRole("checkbox", { name: d, exact: true }).check();
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByText(`${service} added.`)).toBeVisible();
}

async function addPrice(page: Page, service: string, amount: string, month: string) {
  await page.getByLabel("Service", { exact: true }).selectOption({ label: service });
  await page.getByLabel("Price", { exact: true }).fill(amount);
  await page.getByLabel("Billing unit").selectOption("per_case");
  await page.getByLabel("Effective from").fill(month);
  await page.getByRole("button", { name: "Add price" }).click();
  const shown = Number(amount).toLocaleString("en-US");
  await expect(page.getByText(new RegExp(`^Saved: ${service} EGP ${shown} per case from`))).toBeVisible();
}

async function createPeriod(page: Page, hospitalId: string, month: string) {
  await page.goto(`/hospitals/${hospitalId}/periods`);
  await page.getByLabel("Month").fill(month);
  await page.getByRole("button", { name: "Create period" }).click();
  await page.waitForURL(new RegExp(`/periods/${month}$`));
}

async function enterVolume(page: Page, slot: string, volume: string) {
  await page.getByLabel(`${slot} Volume`).fill(volume);
}

const revenueCard = (page: Page) => page.getByRole("region", { name: "Results" }).locator("section").filter({ hasText: "Revenue" }).first();

test("1–10: create Hospital A with departments, services and two effective-dated NIV prices", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/hospitals$/); // 1. Hospitals
  hospitalA = await createHospital(page, "Hospital A", "HOSP-A"); // 2–3

  // 4–5. AICU and PICU with different beds
  await addDepartment(page, "AICU", "adult_icu", "12");
  await addDepartment(page, "PICU", "picu", "8");

  // 6–7. NIV and HFNC, assigned to departments
  await page.getByRole("link", { name: /Continue to services/ }).click();
  await addService(page, "NIV", ["AICU", "PICU"]);
  await addService(page, "HFNC", ["PICU"]);
  await expect(page.getByRole("checkbox", { name: "NIV in AICU" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "NIV in PICU" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "HFNC in PICU" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "HFNC in AICU" })).not.toBeChecked();

  // 8–9. January and February NIV prices
  await page.getByRole("link", { name: /Continue to prices/ }).click();
  await addPrice(page, "NIV", "1500", "2026-01");
  await addPrice(page, "NIV", "1800", "2026-02");

  // 10. Both in Pricing History
  await page.goto(`/hospitals/${hospitalA}/pricing`);
  const history = page.locator("#history");
  await expect(history.getByRole("row", { name: /Jan 2026 – Jan 2026 EGP 1,500 per case Past/ })).toBeVisible();
  await expect(history.getByRole("row", { name: /Feb 2026 – onwards EGP 1,800 per case Current/ })).toBeVisible();
});

test("11–17: January and February are each calculated with their own price", async ({ page }) => {
  await signIn(page);

  // 11–13. January period, volume, revenue = 100 × 1,500
  await createPeriod(page, hospitalA, "2026-01");
  await expect(page.getByRole("cell", { name: "EGP 1,500 per case" }).first()).toBeVisible();
  await enterVolume(page, "NIV — AICU", "60");
  await enterVolume(page, "NIV — PICU", "40");
  await page.getByRole("button", { name: "Save volumes" }).click();
  await expect(page.getByText("Saved. Figures recalculated.")).toBeVisible();
  await expect(revenueCard(page)).toContainText("EGP 150K");
  await expect(page.locator("#activity tfoot")).toContainText("EGP 150,000");

  // 14–16. February period, volume, revenue = 100 × 1,800
  await createPeriod(page, hospitalA, "2026-02");
  await expect(page.getByRole("cell", { name: "EGP 1,800 per case" }).first()).toBeVisible();
  await enterVolume(page, "NIV — AICU", "100");
  await enterVolume(page, "NIV — PICU", "0");
  await page.getByRole("button", { name: "Save volumes" }).click();
  await expect(page.locator("#activity tfoot")).toContainText("EGP 180,000");
  await expect(revenueCard(page)).toContainText("EGP 180K");

  // A later price change never rewrites history.
  await page.goto(`/hospitals/${hospitalA}/pricing`);
  await addPrice(page, "NIV", "2000", "2026-10");

  // 17. January is unchanged
  await page.goto(`/hospitals/${hospitalA}/periods/2026-01`);
  await expect(page.locator("#activity tfoot")).toContainText("EGP 150,000");
  await expect(page.getByRole("cell", { name: "EGP 1,500 per case" }).first()).toBeVisible();
  await page.goto(`/hospitals/${hospitalA}/periods/2026-02`);
  await expect(page.locator("#activity tfoot")).toContainText("EGP 180,000");

  // February vs January, explained
  await page.getByRole("link", { name: /Why did Feb 2026 differ from Jan 2026/ }).click();
  await expect(page.getByText("NIV: price EGP 1,500 → EGP 1,800")).toBeVisible();
  await expect(page.getByText("+EGP 30,000").first()).toBeVisible();
});

test("18–20: Hospital B prices NIV differently, and the hospitals compare side by side", async ({ page }) => {
  await signIn(page);

  // 18–19. Hospital B with its own NIV price
  hospitalB = await createHospital(page, "Hospital B", "HOSP-B");
  await addDepartment(page, "ICU", "adult_icu", "20");
  await page.getByRole("link", { name: /Continue to services/ }).click();
  await addService(page, "NIV", ["ICU"]);
  await page.getByRole("link", { name: /Continue to prices/ }).click();
  await addPrice(page, "NIV", "2400", "2026-01");
  await createPeriod(page, hospitalB, "2026-01");
  await enterVolume(page, "NIV — ICU", "100");
  await page.getByRole("button", { name: "Save volumes" }).click();
  await expect(page.locator("#activity tfoot")).toContainText("EGP 240,000");

  // Hospital A's January is still its own
  await page.goto(`/hospitals/${hospitalA}/periods/2026-01`);
  await expect(page.locator("#activity tfoot")).toContainText("EGP 150,000");

  // 20. Compare A and B
  await page.goto("/comparisons");
  await page.getByLabel("Hospital A").selectOption({ label: "Hospital A" });
  await page.getByLabel("Hospital B").selectOption({ label: "Hospital B" });
  await page.getByLabel("Period").selectOption("2026-01");
  await page.getByRole("button", { name: "Compare" }).click();
  const revenueRow = page.getByRole("row", { name: /^Revenue/ }).first();
  await expect(revenueRow).toContainText("EGP 150,000");
  await expect(revenueRow).toContainText("EGP 240,000");
  await expect(page.getByText("NIV: price EGP 1,500 → EGP 2,400")).toBeVisible();
  await expect(page.getByText("+EGP 90,000").first()).toBeVisible();

  // The portfolio shows both hospitals
  await page.goto("/hospitals?month=2026-01");
  await expect(page.getByRole("link", { name: "Hospital A" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Hospital B" }).first()).toBeVisible();
});
