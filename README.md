# Respiratory Gate Hospital Platform

Respiratory Care management and financial value platform for Respiratory Gate Egypt, across many hospitals. Each hospital is configured independently — departments, respiratory therapy services, its own prices and costs (effective-dated, so history is never rewritten) — and records what happened each month. The original hospital value workbook (`data/Elite_RT_Value_Calculator.xlsx`) lives on as the *Elite / Workbook Value Model*, available per hospital with full workbook parity.

Read `CLAUDE.md` before making architectural or implementation decisions.

## What is in the platform

| Area | What it does |
|---|---|
| **Portfolio** | All hospitals for a month: revenue, operating cost, documented savings, net value, YTD, highest-value and fastest-growing hospital, major cost increases, revenue changes, drill-down. |
| **Onboarding** | Add a hospital in four steps: details → departments (beds, RT coverage) → services (library or custom, assigned to departments) → prices. |
| **Pricing** | Hospital-specific prices per service with billing unit and effective month (per procedure / patient / session / day / ventilator day / hour / case, monthly package, fixed contract, percentage, custom). New prices apply from their month on; earlier months keep theirs. Full pricing history, voiding with a reason. |
| **Costs, staffing, equipment** | Cost items (consumables, staffing per FTE, equipment, maintenance, contracts, service/package costs, other) with effective-dated cost versions; equipment register. |
| **Monthly periods** | One per hospital and month: volumes per service and department, patients, bed-days, ventilator days, cost quantities, documented savings. Draft → In review → Finalized → Locked; Admin corrections need a reason and are audited. |
| **Hospital overview & service analytics** | Selected month vs previous month and YTD; staffing, consumables, occupancy, beds; per service: current and previous price, effective date, volume, revenue, cost, contribution, pricing history. |
| **Comparisons** | Month vs month, selected months, quarter, year, YTD; department vs department, service vs service; hospital vs hospital — with the drivers of each difference (volume vs price, quantity vs unit cost). |
| **Reports** | Printable hospital report (month, quarter, YTD, year) and the workbook executive summary. |
| **Audit** | Who changed what, when, previous and new value — with hospital, period and the reason for historical corrections. |
| **Workbook Value Model** | The Elite calculator per hospital: inputs, occupancy × price revenue scenarios, Low / Mid / High savings, value bridge, scenarios. |
| **Settings** | Users with hospital access, service library, organisation, own password; per hospital: details, status, members, financial models. |

Roles: **Admin** (every hospital; creates hospitals; locks months and makes audited corrections), **Hospital Manager / Finance** (configures and enters data for the hospitals they are members of), **Viewer** (read-only, their hospitals). Referring physician and patient roles exist only as reserved names and are granted nothing. No patient-level data is stored.

## Architecture in one paragraph

Next.js 16 (App Router, TypeScript) on Vercel; Supabase for Postgres, Auth, hospital-level row-level security and database-trigger audit logging. All business calculations live in `src/domain` — pure, framework-free TypeScript: the monthly hospital engine (`src/domain/hospital`) and the workbook model, tested for **parity with the workbook** (all 132 formula cells across 10 LibreOffice-recalculated scenarios). The UI calls the engine; it never calculates on its own. Details: `docs/mvp-architecture.md` (§16 for the multi-hospital platform), `docs/database-schema.md` (§8–§12), `docs/excel-formula-map.md`.

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

This creates the schema, hospital-level row-level security and audit triggers; the organisation *Respiratory Gate Egypt* with its respiratory service library (NIV, HFNC, IMV, CPAP, oxygen, aerosol, airway, ABG, suction, transport ventilation, PFT, sleep study, CPT, mobilization, weaning); and *Elite Hospital* with the Workbook Value Model (55 inputs, hospital values blank except the verified 50 ICU beds, and the *Workbook default* scenario). No demo data is created.

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

Settings → Users → **Add user**: choose the role and, for Managers and Viewers, the hospitals they may access; share the temporary password privately (it is shown once). Access can be changed later in each hospital's Settings → Access. Deactivate rather than delete people who leave, so the audit history keeps their name.

Then add your hospitals: **Portfolio → Add hospital**.

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
pnpm db:demo           # optional: synthetic Demo Hospital A and B with Jan–Mar 2026 data
pnpm dev               # http://localhost:3000
```

`pnpm db:demo` writes clearly labelled synthetic data and refuses a hosted Supabase project unless you pass `--remote`.

`pnpm db:reset` re-applies migrations to a clean local database. Local Studio: `pnpm exec supabase start` (without exclusions) → http://127.0.0.1:54323.

## Tests

| Command | What it proves |
|---|---|
| `pnpm test` | Calculation engines: workbook parity (132 cells × 10 scenarios); monthly hospital engine (effective-dated prices — NIV Jan 150,000 / Feb 180,000 / Mar 192,000 unchanged by later prices; costs, KPIs, aggregation, variance, comparisons, portfolio); validation; access model |
| `pnpm test:db` | Hospital-level RLS, cross-hospital foreign keys, immutable versions, period locking, audited corrections, column grants and audit triggers through the real Supabase Auth + API — including the NIV figures read back from Postgres (needs `pnpm db:start`) |
| `pnpm test:e2e` | In a browser: the 20-step multi-hospital acceptance flow, costs and corrections, hospital-scoped managers, the workbook model (inputs, recalculation, audit, roles, temporary passwords, report), phone layouts (needs `pnpm db:start` + a running app) |
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
| A Manager or Viewer sees no hospitals | Give them access: hospital → Settings → Access (or tick hospitals when creating the user). |
| A finalized month cannot be edited | By design. An Admin can correct it with a reason, or reopen it (also with a reason). |
| Saving a price says it "affects a finalized or locked period" | The new or voided price would change a closed month: only an Admin can do that, with a reason. |

## Security

- Never commit credentials, `.env.local`, or patient-identifiable information.
- The service-role key is used only in server code for user administration; all other data access runs as the signed-in user under RLS.
- The audit log is append-only and written by database triggers.
