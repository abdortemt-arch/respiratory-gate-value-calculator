/**
 * Create a platform user from the command line — used to create the first Admin.
 *
 *   pnpm user:create --email you@hospital.org --name "Your Name" [--role admin|manager|viewer] [--hospitals CODE-A,CODE-B]
 *
 * Managers and viewers only see the hospitals they are given (--hospitals takes
 * hospital codes); Admins see every hospital.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 * (or the environment). Prints a one-time temporary password; the user must
 * replace it at first sign-in. Nothing is written to disk.
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { temporaryPassword } from "../src/server/auth/temporary-password";

const ROLES = ["admin", "manager", "viewer"] as const;
type Role = (typeof ROLES)[number];

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string", default: "admin" },
      organization: { type: "string" },
      hospitals: { type: "string" },
    },
  });
  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim();
  const role = values.role as Role;
  if (!email || !name || !ROLES.includes(role)) {
    console.error('Usage: pnpm user:create --email you@hospital.org --name "Your Name" [--role admin|manager|viewer]');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local).");
    process.exit(1);
  }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let organizationId = values.organization;
  if (!organizationId) {
    const { data, error } = await admin.from("organizations").select("id, name");
    if (error) throw error;
    if (data.length !== 1) {
      console.error(`Found ${data.length} organisations; pass --organization <id>. Did you apply the migrations?`);
      process.exit(1);
    }
    organizationId = data[0].id as string;
    console.log(`Organisation: ${data[0].name}`);
  }

  const password = temporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { must_change_password: true },
    user_metadata: { full_name: name },
  });
  if (createError) {
    console.error(`Could not create the account: ${createError.message}`);
    process.exit(1);
  }

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ user_id: created.user.id, organization_id: organizationId, full_name: name, role });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    console.error(`Could not create the profile: ${profileError.message}`);
    process.exit(1);
  }

  const codes = (values.hospitals ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (role !== "admin" && codes.length) {
    const { data: hospitals } = await admin.from("hospitals").select("id, code").eq("organization_id", organizationId).in("code", codes);
    const missing = codes.filter((c) => !hospitals?.some((h) => h.code === c));
    if (missing.length) console.warn(`Unknown hospital codes (skipped): ${missing.join(", ")}`);
    if (hospitals?.length) {
      const { error } = await admin
        .from("hospital_members")
        .insert(hospitals.map((h) => ({ hospital_id: h.id, user_id: created.user.id, role: role === "viewer" ? "viewer" : "manager" })));
      if (error) console.warn(`Could not give hospital access: ${error.message}`);
      else console.log(`Hospital access: ${hospitals.map((h) => h.code).join(", ")}`);
    }
  } else if (role !== "admin") {
    console.log("No hospital access yet: an Admin can add it in the hospital's Settings → Access.");
  }

  console.log(`\nCreated ${role} ${name} <${email}>`);
  console.log(`Temporary password (shown once): ${password}`);
  console.log("They will be asked to choose their own password at first sign-in.\n");
}

if (process.argv[1]?.endsWith("create-user.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
