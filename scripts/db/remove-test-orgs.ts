/**
 * Remove organisations created by the automated tests (database and
 * end-to-end) from a hosted project, e.g. after an interrupted run. The tests
 * normally remove their own data; this is the safety net.
 *
 * An organisation is removed only when BOTH hold:
 *   - its name starts with "RLS test ", "Hospitals test ", "E2E Org " or "E2E Platform ", and
 *   - every user in it has a test-domain email (@rls.test, @hospitals.test, @e2e.test).
 * The operator organisation and real users are never touched.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm exec tsx scripts/db/remove-test-orgs.ts [--yes]
 * Without --yes it only lists what it would remove.
 */
import { createClient } from "@supabase/supabase-js";
import { cleanupOrganization } from "../../supabase/tests/helpers";

const NAME = /^(RLS test|Hospitals test|E2E Org|E2E Platform) /;
const EMAIL = /@(rls|hospitals|e2e)\.test$/i;
const OPERATOR = "00000000-0000-4000-8000-000000000001";

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.TEST_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(2);
  }
  const apply = process.argv.includes("--yes");
  const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: orgs, error } = await service.from("organizations").select("id, name");
  if (error) throw error;
  let removed = 0;
  for (const org of orgs ?? []) {
    if (org.id === OPERATOR || !NAME.test(org.name)) continue;
    const { data: profiles } = await service.from("profiles").select("user_id").eq("organization_id", org.id);
    const userIds = (profiles ?? []).map((p) => p.user_id as string);
    const emails = await Promise.all(userIds.map(async (id) => (await service.auth.admin.getUserById(id)).data.user?.email ?? ""));
    if (emails.some((e) => !EMAIL.test(e))) {
      console.log(`Skipped ${org.name}: it has a user without a test email.`);
      continue;
    }
    console.log(`${apply ? "Removing" : "Would remove"} ${org.name} (${userIds.length} test users)`);
    if (apply) {
      await cleanupOrganization(service, org.id, userIds);
      removed++;
    }
  }
  console.log(apply ? `Removed ${removed} test organisation(s).` : "Dry run. Pass --yes to remove.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
