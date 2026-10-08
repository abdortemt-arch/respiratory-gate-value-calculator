/**
 * Walks the MVP "Definition of Done" (CLAUDE.md) through the real app.
 */
import { expect, test, type Page } from "@playwright/test";
import { setupWorld, teardown, type TestWorld } from "./fixtures";

test.describe.configure({ mode: "serial" });

let world: TestWorld;
let viewerPassword: string;

test.beforeAll(async () => {
  world = await setupWorld();
});

test.afterAll(async () => {
  if (world) await teardown(world);
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

async function saveInput(page: Page, key: string, value: string) {
  const field = page.locator(`[id="${key}"]`);
  await field.locator("input").first().fill(value);
  await field.getByRole("button", { name: "Save" }).click();
  await expect(field.getByText("Last changed")).toBeVisible();
}

test("signed-out visitors are sent to sign-in", async ({ page }) => {
  await page.goto("/overview");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Foverview/);
});

test("admin sees the workbook check and no fake values", async ({ page }) => {
  await signIn(page, world.emails.admin, world.password);
  await expect(page).toHaveURL(/\/overview/);
  await expect(page.getByText("EGP 14.6M").first()).toBeVisible();
  await expect(page.getByText("50 beds × 80% occupancy × EGP 1,000 × 365 days").first()).toBeVisible();
  await expect(page.getByText("To be quantified").first()).toBeVisible();
});

test("editing inputs recalculates savings and the bridge, and is audited", async ({ page }) => {
  await signIn(page, world.emails.admin, world.password);
  await page.goto("/inputs");
  await saveInput(page, "oxygen_spend", "3,000,000");
  await saveInput(page, "opcost_rt_salaries", "4800000");

  await page.goto("/savings");
  await expect(page.getByText("EGP 300K").first()).toBeVisible();

  await page.goto("/value-bridge");
  await expect(page.getByText("Provisional").first()).toBeVisible();

  await page.goto("/audit");
  const row = page.getByRole("row", { name: /Oxygen spend/ });
  await expect(row).toContainText("E2E admin");
  await expect(row).toContainText("Blank (unknown)");
  await expect(row).toContainText("EGP 3,000,000");
});

test("scenario controls recalculate immediately and survive reload", async ({ page }) => {
  await signIn(page, world.emails.admin, world.password);
  await page.getByLabel("ICU occupancy").selectOption("0.9");
  await page.getByLabel("Package price / patient-day").selectOption("1200");
  await expect(page.getByText("EGP 19.7M").first()).toBeVisible();
  await expect(page).toHaveURL(/occ=0\.9&price=1200/);
  await page.reload();
  await expect(page.getByText("EGP 19.7M").first()).toBeVisible();
});

test("admin creates a viewer with a temporary password", async ({ page }) => {
  await signIn(page, world.emails.admin, world.password);
  await page.goto("/settings#users");
  await page.getByLabel("Full name").fill("E2E viewer");
  await page.getByLabel("Email", { exact: true }).fill(world.emails.viewer);
  await page.getByLabel("Role", { exact: true }).selectOption("viewer");
  await page.getByRole("button", { name: "Add user" }).click();
  const code = page.locator("code.select-all");
  await expect(code).toBeVisible();
  viewerPassword = (await code.textContent()) ?? "";
  expect(viewerPassword.length).toBeGreaterThan(16);
});

test("viewer must replace the temporary password and is read-only", async ({ page }) => {
  await signIn(page, world.emails.viewer, viewerPassword);
  await expect(page).toHaveURL(/\/account\/set-password/);
  const newPassword = "ViewerPassw0rd2026";
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/overview/);

  await page.goto("/inputs");
  await expect(page.locator('[id="oxygen_spend"]')).toContainText("EGP 3,000,000");
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Audit" })).toHaveCount(0);
  await page.goto("/audit");
  await expect(page).toHaveURL(/\/overview\?denied=1/);
  await expect(page.getByText("That page is not available for your role")).toBeVisible();
  await page.goto("/overview");
  await expect(page.getByRole("button", { name: "Save as scenario" })).toHaveCount(0);
});

test("manager edits hospital data but not Respiratory Gate assumptions", async ({ page }) => {
  await signIn(page, world.emails.manager, world.password);
  await page.goto("/inputs");
  await saveInput(page, "cost_per_niv_day", "900");
  await page.goto("/settings#assumptions");
  await expect(page.locator('[id="days_per_year"]')).toContainText("365");
  await expect(page.locator('[id="days_per_year"]').getByRole("button", { name: "Save" })).toHaveCount(0);
});

test("executive report renders for printing", async ({ page }) => {
  await signIn(page, world.emails.admin, world.password);
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Respiratory Care Service-Line Value" })).toBeVisible();
  await expect(page.getByText("Data still required, by owner")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();
});

test("pages fit a phone screen without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, world.emails.admin, world.password);
  for (const path of ["/overview", "/inputs", "/revenue", "/savings", "/value-bridge", "/reports", "/audit", "/settings"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
