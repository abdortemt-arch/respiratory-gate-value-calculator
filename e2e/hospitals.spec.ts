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
  await expect(page.getByText("This hospital is inactive")).toHaveCount(0);
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

test("costs, month close and an audited Admin correction", async ({ page }) => {
  await signIn(page);
  // Staffing cost per FTE from January
  await page.goto(`/hospitals/${hospitalA}/staffing`);
  await page.getByLabel("Role / position").fill("Respiratory therapist");
  await page.getByLabel("Monthly cost per FTE (EGP)").fill("25000");
  await page.getByLabel("Effective from").first().fill("2026-01");
  await page.getByRole("button", { name: "Add role" }).click();
  await expect(page.getByText("Respiratory therapist added.")).toBeVisible();

  // January: 4 FTE → operating cost EGP 100,000; net = 150,000 − 100,000
  await page.goto(`/hospitals/${hospitalA}/periods/2026-01`);
  await page.getByLabel("Respiratory therapist Quantity").fill("4");
  await page.getByRole("button", { name: "Save quantities" }).click();
  await expect(page.locator("#costs")).toContainText("EGP 100,000");
  const results = page.getByRole("region", { name: "Results" });
  await expect(results).toContainText("EGP 100K");
  await expect(results).toContainText("EGP 50K");

  // Finalize, then correct with a reason
  await page.getByRole("button", { name: "Finalize month" }).click();
  await expect(page.getByText("Status changed to finalized.")).toBeVisible();
  await expect(page.getByText("Changes here are historical corrections")).toBeVisible();
  await enterVolume(page, "NIV — AICU", "65");
  const save = page.getByRole("button", { name: "Save volumes" });
  await expect(save).toBeDisabled();
  await page.locator("#activity").getByLabel("Reason for correction").fill("Late AICU charts added");
  await save.click();
  await expect(page.locator("#activity tfoot")).toContainText("EGP 157,500");
  await expect(page.getByText("Corrected after finalization")).toBeVisible();

  // The correction is in the audit log with its reason, hospital and period
  await page.goto(`/hospitals/${hospitalA}/audit?corrections=1`);
  const row = page.getByRole("row", { name: /NIV — AICU/ }).first();
  await expect(row).toContainText("Correction");
  await expect(row).toContainText("January 2026");
  await expect(row).toContainText("60");
  await expect(row).toContainText("65");
  await expect(row).toContainText("Late AICU charts added");

  // Lock; unlocking needs a reason
  await page.goto(`/hospitals/${hospitalA}/periods/2026-01`);
  await page.getByRole("button", { name: "Lock month" }).click();
  await expect(page.getByText("Status changed to locked.")).toBeVisible();
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("button", { name: "Confirm" })).toBeDisabled();
  await page.getByLabel("Reason", { exact: true }).fill("Auditor query");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Status changed to finalized.")).toBeVisible();
});

test("a hospital manager sees and edits only their own hospital", async ({ page }) => {
  const email = `manager-b-${Date.now()}@e2e.test`;
  const password = `Mgr-${Date.now()}-pass`;
  const { data, error } = await world.service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await world.service.from("profiles").insert({ user_id: data.user.id, organization_id: world.orgId, full_name: "Manager B", role: "manager" }).throwOnError();
  await world.service.from("hospital_members").insert({ hospital_id: hospitalB, user_id: data.user.id, role: "manager" }).throwOnError();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/hospitals$/);
  await expect(page.getByRole("link", { name: "Hospital B" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Hospital A" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Add hospital" })).toHaveCount(0);

  const res = await page.goto(`/hospitals/${hospitalA}`);
  expect(res?.status()).toBe(404);

  // Draft month: editable; once finalized: read-only for the manager
  await page.goto(`/hospitals/${hospitalB}/periods/2026-01`);
  await enterVolume(page, "NIV — ICU", "110");
  await page.getByRole("button", { name: "Save volumes" }).click();
  await expect(page.locator("#activity tfoot")).toContainText("EGP 264,000");
  await page.getByRole("button", { name: "Finalize month" }).click();
  await expect(page.getByText("This month is finalized")).toBeVisible();
  await expect(page.getByLabel("NIV — ICU Volume")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save volumes" })).toHaveCount(0);
  await expect(page.getByText(/Only an Admin can lock, reopen or correct/)).toBeVisible();
});

test("a viewer reads reports but cannot change anything", async ({ page }) => {
  const email = `viewer-a-${Date.now()}@e2e.test`;
  const password = `Vwr-${Date.now()}-pass`;
  const { data, error } = await world.service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await world.service.from("profiles").insert({ user_id: data.user.id, organization_id: world.orgId, full_name: "Viewer A", role: "viewer" }).throwOnError();
  await world.service.from("hospital_members").insert({ hospital_id: hospitalA, user_id: data.user.id, role: "viewer" }).throwOnError();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/hospitals$/);
  await expect(page.getByRole("link", { name: "Hospital A" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Hospital B" })).toHaveCount(0);

  await page.goto(`/hospitals/${hospitalA}/departments`);
  await expect(page.getByRole("button", { name: "Add department" })).toHaveCount(0);
  await page.goto(`/hospitals/${hospitalA}/pricing`);
  await expect(page.getByRole("button", { name: "Add price" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Void/ })).toHaveCount(0);
  await page.goto(`/hospitals/${hospitalA}/periods/2026-02`);
  await expect(page.getByLabel("NIV — AICU Volume")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save volumes" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Finalize month" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);

  // Reports: January after the audited correction (105 × EGP 1,500) and its operating cost.
  await page.goto(`/hospitals/${hospitalA}/reports?p=2026-01`);
  await expect(page.getByRole("heading", { name: "Hospital A · January 2026" })).toBeVisible();
  const key = page.getByRole("region", { name: "Key figures" });
  await expect(key.getByRole("row", { name: /^Revenue/ })).toContainText("EGP 157,500");
  await expect(key.getByRole("row", { name: /^Operating cost/ })).toContainText("EGP 100,000");
  await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();
  await page.goto(`/hospitals/${hospitalA}/comparisons?mode=month&a=2026-01&b=2026-02`);
  await expect(page.getByText("NIV: price EGP 1,500 → EGP 1,800")).toBeVisible();
});

test("hospital pages fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const h = `/hospitals/${hospitalA}`;
  for (const path of [h, `${h}/periods`, `${h}/periods/2026-01`, `${h}/departments`, `${h}/services`, `${h}/pricing`, `${h}/staffing`, `${h}/comparisons`, `${h}/reports`, `${h}/settings`, "/comparisons", "/hospitals/new"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
