# Respiratory Gate Hospital Platform

Respiratory Care management and financial value platform for Respiratory Gate Egypt. It turns the hospital value workbook (`data/Elite_RT_Value_Calculator.xlsx`) into a live, authenticated web app: hospital inputs, revenue and savings scenarios, a value bridge, audit history and a printable executive report.

Read `CLAUDE.md` before making architectural or implementation decisions.

## What is in Phase 1

| Area | What it does |
|---|---|
| **Sign-in** | Invite-only accounts (no self sign-up). Temporary passwords must be replaced at first sign-in. |
| **Overview** | Executive dashboard: ICU package gross potential, net service-line value, savings, operating-cost status, data completeness, what to collect next. |
| **Inputs** | The workbook's hospital inputs, grouped, with unit, owner, note, validation and who changed each value last. Blank means *unknown*, never zero. |
| **Revenue** | Occupancy × package-price matrix (daily / monthly / annual), other revenue streams, billing leakage, contribution margin. |
| **Savings** | Six cost-avoidance levers at Low / Mid / High sensitivity; missing baselines shown, overlaps flagged. |
| **Value Bridge** | Gross revenue − RT operating cost + cost avoidance = net value. No net value until operating cost exists. |
| **Scenarios** | Occupancy, price and savings level recalculate instantly; save named scenarios; Admins approve (results frozen) and set the default. |
| **Reports** | Printable / PDF executive summary, data-completeness report by data owner, scenario comparison. |
| **Audit** | Who changed which input, assumption, scenario or user — when, previous and new value. |
| **Settings** | Users and roles (Admin), model assumptions (Admin), organisation, own password. |

Roles: **Admin** (everything), **Hospital Manager / Finance** (edit hospital data, save scenarios, view audit), **Viewer** (read-only). Referring physician and patient roles exist only as reserved names and are granted nothing.

## Architecture in one paragraph

Next.js 16 (App Router, TypeScript) on Vercel; Supabase for Postgres, Auth, row-level security and database-trigger audit logging. All business calculations live in `src/domain` — pure, framework-free TypeScript tested for **parity with the workbook** (all 132 formula cells across 10 LibreOffice-recalculated scenarios). The UI calls the engine; it never calculates on its own. Details: `docs/mvp-architecture.md`, `docs/database-schema.md`, `docs/excel-formula-map.md`.

```
src/domain/        calculation engine, input catalog, access model (pure TS, unit + parity tested)
src/server/        Supabase clients, session/role checks, data loading (server-only)
src/app/           routes, Server Actions
src/components/    UI, charts, dashboards
supabase/          config, migrations (schema, RLS, audit, reference data), database tests
e2e/               Playwright end-to-end tests
scripts/           workbook parity fixtures, user bootstrap, logo preparation
```

---

## Deploy: Supabase + Vercel + GitHub

You provide three values. Nothing secret is stored in the repository.

| Variable | Where it comes from | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API keys → `anon` (or the newer **publishable** key) | public (RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API keys → `service_role` (or the newer **secret** key) | **server only** — used to create users |

`.env.example` lists exactly these names.

### 1. Create the Supabase project

1. **New project → Region: `Central EU (Frankfurt)` — `eu-central-1`.** Supabase offers no Middle East or Africa region; Frankfurt is the closest practical option to Egypt and matches the Vercel region below. Confirm with the hospital's IT/legal (see *Data residency*).
2. Keep the database password in your password manager (needed once, for `supabase db push`).
3. **Authentication → Sign In / Providers**
   - **Allow new users to sign up: OFF** (accounts are created by Admins).
   - **Email provider: keep ENABLED** — it is also what allows email + password sign-in.
   - Password requirements: minimum length **10**, *letters and digits*.
4. **Authentication → URL Configuration**
   - Site URL: your production URL, e.g. `https://respiratory-gate.vercel.app`
   - Redirect URLs: `https://<your-domain>/**` (and `https://*-<your-team>.vercel.app/**` if you use preview deployments).
5. *(Optional, recommended later)* **Authentication → Emails → SMTP settings**: add a custom SMTP sender. Supabase's built-in email only delivers to your own team's addresses, so email invitations and "Forgot password" emails to hospital staff need custom SMTP. Without it, use **temporary passwords** (the default in Settings → Users).

### 2. Apply the database migrations

From a local clone (Node 22 + pnpm 10):

```bash
pnpm install
pnpm exec supabase login                       # opens the browser once
pnpm exec supabase link --project-ref <project-ref>
pnpm exec supabase db push                     # applies supabase/migrations/*
```

This creates the five tables, row-level security, audit triggers, the hospital organisation, its 55 input rows (hospital values blank, except the verified 50 ICU beds) and the *Workbook default* scenario.

*No CLI?* Paste each file in `supabase/migrations/` (in filename order) into Supabase → SQL Editor and run it.

### 3. Deploy on Vercel

1. **Add New → Project → Import** this GitHub repository. Framework is detected as Next.js; `vercel.json` sets the function region to **`fra1` (Frankfurt)** next to the database.
2. **Settings → Environment Variables**: add the three variables above for *Production* (and *Preview* if you use previews). Mark `SUPABASE_SERVICE_ROLE_KEY` as **Sensitive**.
3. **Deploy.** Until the variables exist, every page shows a *Setup required* screen listing which names are missing (never their values). After adding or changing variables, **redeploy**.

### 4. Create the first Admin

On your machine, put the **production** values in `.env.local` (git-ignored), then:

```bash
pnpm user:create --email you@example.com --name "Your Name" --role admin
```

It prints a one-time temporary password. Sign in at your Vercel URL; you will be asked to choose your own password. Then delete the production values from `.env.local`.

*Alternative without the CLI:* Supabase → Authentication → Users → **Add user** (auto-confirm), then in the SQL Editor:

```sql
insert into public.profiles (user_id, organization_id, full_name, role)
select id, '00000000-0000-4000-8000-000000000001', 'Your Name', 'admin'
from auth.users where email = 'you@example.com';
```

### 5. Invite colleagues

Settings → Users → **Add user**: choose the role; share the temporary password privately (it is shown once). Deactivate rather than delete people who leave, so the audit history keeps their name.

### Data residency and compliance

Phase 1 stores operational and financial service-line data only — **no patient information**. User names and emails are personal data under Egypt's Personal Data Protection Law (Law No. 151 of 2020): confirm the Frankfurt hosting with the hospital's IT/legal before entering production data. Before any patient-level data is introduced, follow the PHI gate in `CLAUDE.md`. Check that your Supabase plan's backups / point-in-time recovery meet the hospital's requirements.

---

## Local development

Prerequisites: Node 22, pnpm 10, Docker (for the local Supabase stack).

```bash
pnpm install
pnpm db:start          # local Supabase (Postgres + Auth + API) with all migrations applied
pnpm db:env            # writes .env.local with the LOCAL stack's development keys
pnpm user:create --email admin@local.test --name "Local Admin"
pnpm dev               # http://localhost:3000
```

`pnpm db:reset` re-applies migrations to a clean local database. Local Studio: `pnpm exec supabase start` (without exclusions) → http://127.0.0.1:54323.

## Tests

| Command | What it proves |
|---|---|
| `pnpm test` | Calculation engine: workbook parity (132 cells × 10 scenarios), statuses, validation, access model, catalog ↔ migration sync |
| `pnpm test:db` | Row-level security, column grants, audit triggers and scenario rules through the real Supabase Auth + API (needs `pnpm db:start`) |
| `pnpm test:e2e` | The MVP definition of done in a browser: sign-in, inputs, recalculation, audit, roles, temporary passwords, report, phone layout (needs `pnpm db:start` + `pnpm dev`) |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | Static checks, including import boundaries that keep `src/domain` framework-free |

CI (`.github/workflows/ci.yml`) runs all of the above on every push.

### Workbook parity fixtures

If the workbook changes, regenerate the expected results (Python 3.10+ and LibreOffice):

```bash
pip install -r scripts/workbook/requirements.txt
python3 scripts/workbook/generate_parity_fixtures.py
pnpm test
```

Fixture scenarios use synthetic test values — never hospital data.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Every page shows *Setup required* | Add the environment variables in Vercel and **redeploy**. |
| "Email logins are disabled" when signing in | Supabase → Authentication → Providers → **Email** must stay enabled; only *Allow new users to sign up* should be off. |
| Users do not receive invitation / reset emails | Configure custom SMTP in Supabase, or use temporary passwords. |
| *User management needs the server key* in Settings | Add `SUPABASE_SERVICE_ROLE_KEY` in Vercel and redeploy. |
| "Your account is not linked to a hospital profile" | The auth user exists without a `profiles` row — create users via Settings or `pnpm user:create`. |
| Inputs page warns *Database setup incomplete* | Run `pnpm exec supabase db push` to apply the latest migrations. |

## Security

- Never commit credentials, `.env.local`, or patient-identifiable information.
- The service-role key is used only in server code for user administration; all other data access runs as the signed-in user under RLS.
- The audit log is append-only and written by database triggers.
