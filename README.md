# Respiratory Gate Hospital Platform

Respiratory Care Management & Financial Value Platform for Respiratory Gate Egypt. It turns the hospital Respiratory Care value workbook into a live, authenticated web app.

## Start here

Claude Code should read `CLAUDE.md` before making architectural or implementation decisions.

## Source material

- Excel business model (reference, read-only): `data/Elite_RT_Value_Calculator.xlsx`
- Brand assets: `brand/`
- Workbook summary: `docs/WORKBOOK_MAP.md`
- Product brief: `docs/PROJECT_BRIEF.md`

## Design documents

- `docs/excel-formula-map.md`: every workbook cell classified, formulas, edge cases, findings
- `docs/mvp-architecture.md`: Phase 1 architecture, module boundaries, access model, delivery plan
- `docs/database-schema.md`: Supabase schema, RLS policies, audit triggers, seed rules

## Status

| Step | State |
|---|---|
| 1. Workbook analysis and architecture | ✅ Done |
| 2. Scaffold (Next.js, auth, navigation) | Not started |
| 3. Calculation engine + parity tests | Fixtures ready (`tests/fixtures/workbook-parity.json`) |
| 4–7. Inputs UI, dashboards, persistence, polish | Not started |

## Workbook parity fixtures

The calculation engine is tested against results computed by the workbook itself. To regenerate the fixtures after any workbook change (requires Python 3.10+ and LibreOffice):

```bash
pip install -r scripts/workbook/requirements.txt
python3 scripts/workbook/generate_parity_fixtures.py
```

Fixture scenarios use synthetic test values only. They are not hospital data.

## MVP principle

Build the internal operational and financial model first. Do not start with patient-level clinical data or external portals.

## Security

Never commit credentials or patient-identifiable health information to this repository.
