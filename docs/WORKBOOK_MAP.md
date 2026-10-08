# Workbook Map — Elite_RT_Value_Calculator.xlsx

## Read Me

Purpose and guardrails.

Key rules:
- gross revenue != profit
- package pricing is a commercial assumption
- 5/10/15% savings are sensitivities
- avoid double-counting overlapping cost levers
- billing leakage recovery is revenue, not savings

## Inputs

39-row input model with categories:

### ICU Activity
- ICU beds
- ICU occupancy rate
- ventilated patient-days
- average ventilator days per patient
- NIV patient-days
- HFNC patient-days
- oxygen consumption

### Unit Costs
- cost per ventilator-day
- cost per NIV day
- cost per HFNC day

### Annual Spend
- oxygen
- respiratory consumables
- equipment rental
- equipment maintenance
- planned equipment purchases
- respiratory staffing
- respiratory overtime
- PFT outsourcing
- external respiratory services

### Usage
- ventilator circuits
- filters
- closed suction
- HFNC circuits
- NIV interfaces
- respiratory equipment inventory
- utilization rate

### Billing
- current billable respiratory activities
- unbilled eligible respiratory activities
- average tariff
- collection rate

## Savings Scenarios

Default sensitivities:
- Low: 5%
- Mid: 10%
- High: 15%

Levers:
- Ventilator resources
- NIV / HFNC utilization
- Oxygen stewardship
- Consumable standardization
- Equipment utilization
- Staffing & outsourcing

## Revenue

Defaults:
- ICU beds: 50
- occupancy scenarios: 60%, 70%, 80%, 90%
- package price scenarios: EGP 800, 1,000, 1,200
- days/month: 30
- days/year: 365

Known reference:
- 80% occupancy @ EGP 1,000 = EGP 14,600,000 / year

Other future revenue streams:
- PFT
- Education Center
- Future clinical programs

Contribution margin section requires hospital operating-cost data.

## Value Bridge

Scenario selectors:
- occupancy
- package price
- savings level

Bridge:
- ICU package revenue
- PFT revenue
- education revenue
- future clinical programs
- billing leakage recovery
- RT operating cost
- each cost-avoidance lever
- total gross revenue
- total cost avoidance
- operating cost
- net respiratory service-line value
