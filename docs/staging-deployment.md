# Staging deployment (hosted Supabase + Vercel preview)

Goal: a real deployment of the `claude/step1-workbook-analysis` branch that you can open and test, backed by a hosted Supabase project — before anything is merged to `main`.

**Who does what**

| You (needs your accounts) | Automated (GitHub Actions, `.github/workflows/staging.yml`) |
|---|---|
| Create the Supabase project and set Auth options | Read-only migration plan, then apply migrations |
| Store four Supabase values and one Vercel value as **GitHub secrets** | Verify every table, policy, function, trigger, index and grant against `supabase/schema-manifest.json` |
| Import the repository in Vercel and set three environment variables | Verify sign-up is disabled, anonymous access is refused, no demo data exists |
| Create the first Admin | Hosted RLS tests and end-to-end tests against the preview; browser secret scan |

Secrets never go into chat, the repository or logs: you paste them only into Supabase, Vercel and GitHub. The workflow reads them from the GitHub environment `staging`.

---

## 1. Supabase project (≈ 10 minutes)

1. **supabase.com → New project**
   - Name: `respiratory-gate-staging` (any name).
   - Region: **Central EU (Frankfurt) — `eu-central-1`**. Supabase has no Middle East or Africa region; Frankfurt is the closest practical region to Egypt and sits next to the Vercel functions (`fra1`).
   - Database password: use **Generate a password**, store it in your password manager. (If you type your own, use letters and digits only — it goes into a URL.)
2. **Authentication → Sign In / Providers**
   - **Allow new users to sign up: OFF** (accounts are created by Admins only).
   - **Email: enabled** (this is what allows email + password sign-in). Optional: minimum password length 10, *letters and digits*.
3. **Authentication → URL Configuration** (needed for invitation and password-reset links)
   - **Redirect URLs → Add URL:** `https://*-<your-vercel-team-slug>.vercel.app/**` (the team slug is in your Vercel URL, `vercel.com/<team-slug>`).
   - **Site URL:** set it to the preview URL once you have it (step 4). Until then leave it.
4. Collect four values for GitHub (do not send them to anyone):
   - **Project URL** — Project Settings → API (or the *Connect* dialog): `https://<project-ref>.supabase.co`
   - **anon / publishable key** — Project Settings → API Keys
   - **service_role / secret key** — Project Settings → API Keys (*reveal*; server-only)
   - **Session pooler connection string** — click **Connect** (top bar) → *Session pooler* → URI. It looks like `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-…-eu-central-1.pooler.supabase.com:5432/postgres`. Replace `[YOUR-PASSWORD]` with the database password. (The pooler is required: GitHub's runners cannot reach the IPv6-only direct connection.)

## 2. GitHub secrets (≈ 5 minutes)

**GitHub → repository → Settings → Environments → New environment → `staging`** → *Environment secrets* → **Add secret** for each:

| Secret name | Value |
|---|---|
| `STAGING_SUPABASE_URL` | Project URL |
| `STAGING_SUPABASE_ANON_KEY` | anon / publishable key |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key |
| `STAGING_SUPABASE_DB_URL` | Session pooler connection string with the password filled in |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | from step 3.3 below |

Leave *Deployment protection rules* at their defaults.

## 3. Vercel project (≈ 5 minutes)

1. **vercel.com → Add New → Project → Import** `abdortemt-arch/respiratory-gate-value-calculator` (grant the Vercel GitHub app access to the repository if asked). Keep the detected settings — `vercel.json` already sets Next.js, `pnpm install --frozen-lockfile` and the function region **`fra1` (Frankfurt)**.
2. Before clicking **Deploy**, open **Environment Variables** and add (all environments is fine):

   | Name | Value | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL | public |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key | public; RLS protects data |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key | tick **Sensitive**; server-only (user administration) |

   Then **Deploy**. This first deployment builds `main`, which only holds the starter files: a failed or empty *Production* deployment is expected and harmless — `main` is not used until the branch is merged.
3. **Project → Settings → Deployment Protection → Protection Bypass for Automation → Add** (generate a secret) → copy it into the GitHub secret `VERCEL_AUTOMATION_BYPASS_SECRET`. Keep *Vercel Authentication* on: previews stay private to your Vercel team, and only the automated tests use the bypass.

Every push to the branch now creates a **Preview** deployment. Its permanent branch URL is shown in Vercel → Deployments (`…-git-claude-step1-…-<team>.vercel.app`).

## 4. Migrations and verification (automated)

Started explicitly — by Claude through the GitHub API, or by you in **GitHub → Actions → Staging → Run workflow** (branch `claude/step1-workbook-analysis`, mode `check`, `migrate` or `verify`). From your own clone, tags work too (they only run the workflow; nothing is merged):

```bash
git tag staging-check-1   && git push origin staging-check-1    # read-only: migration state, dry-run plan, Auth/API checks
git tag staging-migrate-1 && git push origin staging-migrate-1  # dry run, apply pending migrations, verify everything
git tag staging-verify-1  && git push origin staging-verify-1   # verify DB, hosted RLS tests, end-to-end on the preview, cleanup
```

What `supabase db push` applies, in order (filenames sort by timestamp):

| Migration | Contents |
|---|---|
| `20261008000000_init.sql` | Phase 1 schema, RLS, audit triggers, roles |
| `20261008000100_reference_data.sql` | Operator organisation, workbook inputs (hospital values blank, verified 50 ICU beds), *Workbook default* scenario |
| `20261008100000_multi_hospital.sql` | Multi-hospital schema, versions, periods, hospital-level RLS, guards, audit; Elite Hospital; service library |
| `20261008100100_workbook_templates.sql` | Workbook model template |
| `20261008100200_view_privileges.sql` | Explicit read-only grants on the price timeline view |

Safety review (done before the first push):
- **No destructive statements**: no `DROP TABLE`, `TRUNCATE` or `DELETE`. The only drops are constraints, an index and policies that are recreated in the same migration.
- **No test or demo data**: inserts are reference data only. `supabase/seed.sql` is empty and is never pushed (no `--include-seed`); `config.toml` settings and vault are not pushed (`--skip-vault`). `pnpm db:demo` refuses hosted projects, and the verification fails if demo hospitals exist.
- **History stays immutable**: price/cost versions cannot be updated (except voiding) or deleted, the audit log is written only by triggers, and closed months accept only reasoned Admin corrections — checked by `pnpm db:verify-hosted` and the hosted RLS tests.
- **Migration order**: all timestamps are on 2026-10-08 and in the past, so migrations created later (`supabase migration new`) always sort after them. (They were previously dated 2026-10-09, a future date, which would make the CLI treat newer migrations as out of order.)

### About the automated test records

The hosted RLS and end-to-end tests never touch your organisation or its hospitals. Each test creates its **own isolated organisation** with test users, works through the application, and deletes everything afterwards:

- organisations named `RLS test …`, `Hospitals test …`, `E2E Org …`, `E2E Platform …`
- users with `@rls.test`, `@hospitals.test`, `@e2e.test` emails (no emails are sent)

If a run is interrupted, the workflow's cleanup step (`scripts/db/remove-test-orgs.ts`) removes leftovers. It deletes an organisation only when its name matches those patterns **and** every one of its users has a test email. `pnpm db:verify-hosted` reports any leftovers.

## 5. First Admin (after the migrations)

In Supabase:

1. **Authentication → Users → Add user → Create new user**: your email, a strong password of your choice, **Auto Confirm User** ticked → Create.
2. **SQL Editor → New query**, replace the email and name, **Run**:

   ```sql
   insert into public.profiles (user_id, organization_id, full_name, role)
   select id, '00000000-0000-4000-8000-000000000001', 'Your Name', 'admin'
   from auth.users where email = 'you@example.com';
   ```

   Expected result: `INSERT 0 1`.
3. Sign in at the preview URL with that email and password.

(Alternative from your own computer: put the staging values in `.env.local` and run `pnpm user:create --email … --name "…" --role admin`; it prints a one-time temporary password.)

Further users: **Settings → Users → Add user** in the app (temporary password, shown once), ticking the hospitals they may access.

## 6. What to check yourself

See the checklist in the milestone report, or:

1. Sign in; open **Portfolio** — *Elite Hospital* is listed (workbook model, no monthly data yet).
2. **Add hospital** → name it `TEST — Hospital A` (prefix test records with `TEST —`), add departments, services, two NIV prices, create two months, enter volumes, finalize and lock a month, try a correction.
3. Create a Manager limited to that hospital and a Viewer; sign in as each in a private window.
4. Open Elite Hospital → *Workbook Value Model* — the workbook figures (e.g. EGP 14.6M at 50 beds × 80% × EGP 1,000 × 365) still compute.
5. Try the pages on your phone.

Hospitals cannot be deleted in the app (history is kept by design). To remove `TEST —` hospitals before real use, deactivate them, or ask for a one-off cleanup.

## 7. Settings to double-check

| Where | Setting | Expected |
|---|---|---|
| Supabase → Authentication → Sign In / Providers | Allow new users to sign up | **Off** |
| Supabase → Authentication → Sign In / Providers | Email | **On** |
| Supabase → Authentication → URL Configuration | Site URL / Redirect URLs | Preview URL / `https://*-<team>.vercel.app/**` |
| Supabase → Project Settings → General | Region | Central EU (Frankfurt) |
| Vercel → Settings → Environment Variables | 3 variables | Present for Preview; service-role key marked Sensitive |
| Vercel → Settings → Functions | Region | Frankfurt (`fra1`) (from `vercel.json`) |
| Vercel → Settings → Deployment Protection | Vercel Authentication | On for previews |
| GitHub → Settings → Environments → staging | 5 secrets | Present |

## Known limitations of the staging setup

- Supabase's built-in email sends only to members of your Supabase organisation: invitations and password-reset emails to other people need custom SMTP (Authentication → Emails → SMTP). Temporary passwords work without it.
- On the Supabase Free plan, inactive projects are paused after a week and daily backups are not included; use a paid plan before entering production data.
- The preview is private to your Vercel team (Deployment Protection). Colleagues need a Vercel team seat, or a shareable link from Vercel, to open it.
