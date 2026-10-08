/**
 * Nothing privileged reaches the browser: every response the browser receives
 * while an Admin uses the app (HTML, JavaScript, React Server Component
 * payloads, JSON) is scanned for the service-role key, Supabase secret keys and
 * service-role JWTs. Runs locally and against a hosted preview.
 */
import { expect, test } from "@playwright/test";
import { setupWorld, teardown, type TestWorld } from "./fixtures";

let world: TestWorld;

test.beforeAll(async () => {
  world = await setupWorld();
});

test.afterAll(async () => {
  if (world) await teardown(world);
});

function serviceRoleJwt(text: string): boolean {
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g)) {
    try {
      if (JSON.parse(Buffer.from(m[1], "base64url").toString("utf8")).role === "service_role") return true;
    } catch {
      /* not a JWT */
    }
  }
  return false;
}

test("no secret or privileged key is sent to the browser", async ({ page }) => {
  const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "";
  expect(serviceKey.length, "TEST_SUPABASE_SERVICE_ROLE_KEY must be set for this check").toBeGreaterThan(20);
  const findings: string[] = [];
  let scanned = 0;
  page.on("response", async (res) => {
    const type = res.headers()["content-type"] ?? "";
    if (!/text|javascript|json|x-component/.test(type)) return;
    const body = await res.text().catch(() => "");
    scanned++;
    const where = new URL(res.url()).pathname;
    if (body.includes(serviceKey)) findings.push(`service-role key value in ${where}`);
    if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(body)) findings.push(`sb_secret_ key in ${where}`);
    if (serviceRoleJwt(body)) findings.push(`service-role JWT in ${where}`);
  });

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(world.emails.admin);
  await page.getByLabel("Password", { exact: true }).fill(world.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/hospitals$/);
  const h = `/hospitals/${world.hospitalId}`;
  // Settings → Users is rendered with the service-role client on the server.
  for (const path of ["/hospitals", h, `${h}/pricing`, `${h}/periods`, `${h}/workbook`, `${h}/workbook/inputs`, "/settings", "/audit", "/comparisons"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    if (path === "/settings") await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  }
  expect(scanned).toBeGreaterThan(10);
  expect(findings).toEqual([]);

  // Cookies hold only the user's own session.
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.value.includes(serviceKey) || serviceRoleJwt(decodeURIComponent(c.value)))).toBe(false);
});
