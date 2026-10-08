# CLAUDE.md — Respiratory Gate Hospital Platform

## Mission

Build a production-minded MVP that transforms the uploaded Excel workbook into a live hospital Respiratory Care management and financial value platform.

The hard constraint is speed: **weeks, not months**. Prioritize the smallest architecture that proves the Respiratory Care service-line value, preserves calculation integrity, and can grow later.

Do not start by building every requested portal. First make the internal hospital financial/operational system work end-to-end.

---

## Source of Truth

The file `data/Elite_RT_Value_Calculator.xlsx` is the current business-logic source of truth.

Workbook structure:

1. `Read Me`
   - Purpose, legends, assumptions and important financial rules.
2. `Inputs`
   - Hospital operational and financial inputs.
   - Yellow cells = Elite/hospital data required.
   - Blue text = Respiratory Gate editable assumptions.
3. `Savings Scenarios`
   - Low / Mid / High cost-avoidance scenarios.
   - Uses 5% / 10% / 15% sensitivities.
4. `Revenue`
   - ICU Respiratory Management Package scenarios.
   - Occupancy scenarios: 60%, 70%, 80%, 90%.
   - Price scenarios: EGP 800 / 1,000 / 1,200 per occupied ICU respiratory patient-day.
   - Also contains placeholders for PFT, Education Center and future clinical programs.
5. `Value Bridge`
   - Combines gross revenue, billing leakage recovery, operating cost and cost avoidance into service-line value.

Important existing check:
- 50 ICU beds × 80% occupancy × EGP 1,000 × 365 days = EGP 14,600,000 annual gross ICU package potential.

### Financial safety rules from the workbook

Preserve these concepts exactly:

- Gross revenue is **not** profit.
- Contribution margin requires hospital cost data.
- Package pricing is a commercial assumption, not an established reimbursement rate.
- Savings percentages are sensitivities, not forecasts.
- Savings levers may overlap; do not blindly add overlapping benefits.
- Billing leakage recovery is revenue, not savings.
- Missing hospital data must remain visibly marked as incomplete instead of being invented.

Never silently substitute missing data with fabricated values.

---

## MVP Product Decision

### Phase 1 — Build this first

Audience: Respiratory Gate leadership + authorized hospital staff.

Build an internal authenticated web app with:

1. **Dashboard**
   - ICU beds
   - occupancy
   - selected package price
   - annual gross revenue potential
   - quantified savings
   - operating cost status
   - net respiratory service-line value
   - data completeness indicator

2. **Hospital Inputs**
   - Editable form matching the `Inputs` sheet.
   - Group fields into:
     - ICU Activity
     - Unit Costs
     - Annual Spend
     - Usage
     - Equipment
     - Billing
   - Each field should show unit, owner, note and validation.
   - Missing required data must display `Baseline required` / `Data required`.

3. **Revenue Scenarios**
   - Interactive occupancy × package price matrix.
   - Daily, monthly and annual views.
   - Keep 60/70/80/90% occupancy and EGP 800/1000/1200 defaults editable by authorized users.

4. **Savings Scenarios**
   - Low / Mid / High scenario selector.
   - Preserve workbook logic.
   - Show each lever separately:
     - Ventilator resources
     - NIV / HFNC utilization
     - Oxygen stewardship
     - Consumable standardization
     - Equipment utilization
     - Staffing & outsourcing
   - Clearly show unavailable baselines.

5. **Value Bridge**
   - Visual waterfall/bridge or stacked financial summary.
   - Revenue
   - cost avoidance
   - operating cost
   - net service-line value
   - Never imply profitability when operating cost is missing.

6. **Scenario Controls**
   - selected occupancy
   - selected package price
   - selected savings scenario
   - Save named scenarios if simple to implement without delaying MVP.

7. **Audit Basics**
   - who changed an input
   - timestamp
   - previous value
   - new value

8. **Export**
   - Printable / PDF-ready executive summary.
   - Excel export can be Phase 1.1 if easy; otherwise defer.

### Do NOT build in Phase 1

Do not spend MVP time on:
- patient portal
- referring physician portal
- patient-level clinical records
- predictive AI
- advanced notifications
- WhatsApp integration
- complex scheduling
- advanced BI
- multi-hospital tenancy
- full EHR integration

Create architecture boundaries so these can be added later.

---

## Access Model

Start with three internal roles:

### Admin
- full access
- edit hospital inputs and assumptions
- manage users
- view audit log
- save/approve scenarios

### Hospital Manager / Finance
- view all dashboards
- edit approved financial and hospital inputs
- review scenarios
- export reports

### Viewer
- read-only dashboard and reports

Future roles to model but not implement fully:
- Referring Physician
- Patient

Do not expose hospital financial data to future patient/physician roles by default.

---

## Recommended Technical Direction

Optimize for a very small team and rapid deployment.

Preferred default stack unless repository constraints suggest otherwise:

- **Next.js + TypeScript**
- **Tailwind CSS**
- **shadcn/ui or equivalent accessible component library**
- **Supabase** for Postgres + authentication + row-level security
- **Recharts / lightweight charting library** for scenario charts and value bridge
- **Vercel** for fast deployment

Keep business calculations in a dedicated typed domain layer, not inside UI components.

Example separation:

`src/domain/calculations/`
- revenue.ts
- savings.ts
- valueBridge.ts
- validation.ts

The UI should call calculation functions; calculation functions should be independently testable.

### Important healthcare constraint

Phase 1 should contain **operational and financial service-line data only**, not patient-identifiable health information.

Before any patient-level PHI is introduced, stop and define:
- hosting/data residency
- encryption
- audit requirements
- backup/retention
- access policies
- local regulatory requirements
- hospital legal/IT approval

---

## Minimum Data Model

Prefer normalized but simple tables.

### organizations
- id
- name
- created_at

### profiles
- id
- user_id
- organization_id
- full_name
- role
- active

### hospital_inputs
- id
- organization_id
- key
- category
- label
- unit
- numeric_value
- text_value
- data_owner
- note
- source_type
- updated_by
- updated_at

### scenario_assumptions
- id
- organization_id
- scenario_name
- occupancy_rate
- package_price
- savings_level
- low_savings_pct
- mid_savings_pct
- high_savings_pct
- created_by
- created_at
- updated_at

### audit_log
- id
- organization_id
- entity_type
- entity_id
- field_name
- old_value
- new_value
- changed_by
- changed_at

Avoid creating dozens of tables during MVP unless a real requirement demands them.

---

## Excel Migration Strategy

Do not attempt a blind 1:1 workbook-to-database conversion.

Use this sequence:

1. Inspect workbook formulas and references.
2. Produce `docs/excel-formula-map.md`.
3. Classify each workbook cell as:
   - hospital input
   - Respiratory Gate assumption
   - derived calculation
   - display-only text
4. Recreate calculations in TypeScript.
5. Add automated tests that compare web calculation results against known workbook scenarios.
6. Keep the Excel workbook in `data/` as a reference artifact.
7. Only after parity is verified should the web calculation engine become the operational source of truth.

---

## UI / Brand Direction

Use the **orange + blue Respiratory Gate color logo** as the primary official identity.

Use the monochrome mark only for:
- dark navigation
- subtle watermark
- compact secondary branding

Design tone:
- premium clinical
- modern hospital dashboard
- calm, clean and evidence-driven
- avoid generic “AI dashboard” appearance

Suggested visual behavior:
- off-white / very light neutral page background
- dark navy/charcoal text
- Respiratory Gate blue for navigation, trusted information and primary actions
- Respiratory Gate orange for selected scenario, highlight and financial opportunity
- green only for positive confirmed metrics
- amber for incomplete assumptions
- red only for errors/critical missing requirements

Use generous spacing, rounded cards, restrained shadows and strong numeric typography.

The dashboard must work well on:
- desktop hospital workstations
- tablets
- mobile phones

---

## Data Presentation Rules

Every major output should communicate three things:

1. value
2. calculation basis
3. confidence / completeness

Example:

**Annual ICU Package Gross Potential**
EGP 14.6M
`50 beds × 80% occupancy × EGP 1,000 × 365 days`
Status: Scenario calculation

For incomplete savings:
**Oxygen Stewardship**
`Baseline required`
Required input: Annual oxygen spend

Do not display fake zeros for missing values when zero and unknown mean different things.

---

## Reporting

MVP automated:
- executive dashboard
- selected scenario summary
- data-completeness report
- change/audit history

On-demand:
- printable executive report
- scenario comparison

Defer:
- scheduled email reports
- automated physician/patient reporting
- predictive forecasting

---

## Development Sequence

Work in this order:

### Step 1 — Repository understanding
Inspect:
- `data/Elite_RT_Value_Calculator.xlsx`
- all files under `brand/`
- this `CLAUDE.md`

Create:
- `docs/excel-formula-map.md`
- `docs/mvp-architecture.md`
- `docs/database-schema.md`

Do not write large amounts of UI before understanding the workbook calculations.

### Step 2 — Scaffold
Create the application shell, authentication and core navigation.

Navigation:
- Overview
- Inputs
- Revenue
- Savings
- Value Bridge
- Reports
- Audit
- Settings

### Step 3 — Calculation engine
Implement and test:
- occupancy math
- package revenue
- savings scenarios
- billing leakage recovery
- value bridge

### Step 4 — Inputs UI
Create categorized forms with validation and data completeness.

### Step 5 — Dashboards
Connect live inputs to the calculation engine and charts.

### Step 6 — Persistence / security
Connect Supabase, roles and audit history.

### Step 7 — Executive polish
Responsive design, loading/error states, empty states, report view and final QA.

---

## Working Style for Claude Code

- Make reasonable implementation decisions without repeatedly asking for confirmation.
- Prefer shipping a coherent vertical slice over many unfinished features.
- Do not invent hospital data.
- Preserve financial meaning from the workbook.
- Add tests for every important calculation.
- Use clear TypeScript types.
- Keep components modular.
- Keep the app responsive.
- Never commit secrets, passwords or API keys.
- Use `.env.example` for configuration.
- Maintain `README.md` with local setup and deployment instructions.
- After each major milestone, summarize:
  - what was completed
  - what remains
  - risks/blockers
  - exact files changed

If an external service credential is required, scaffold the integration and document the required environment variable instead of hardcoding it.

---

## Definition of MVP Done

The MVP is successful when an authorized internal user can:

1. sign in
2. enter/update hospital inputs
3. change occupancy, package price and savings scenario
4. immediately see recalculated Revenue, Savings and Value Bridge results
5. understand which outputs are calculated vs. blocked by missing data
6. view an executive dashboard
7. see who changed key inputs
8. print/export a management-ready summary
9. use the system comfortably on mobile and desktop

Only after this works should the project expand toward physician or patient portals.
