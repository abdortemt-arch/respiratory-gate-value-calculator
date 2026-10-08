/**
 * Financial guardrails, verbatim in meaning from the workbook's Read Me
 * (Rules 1–5). Shown on Revenue, Savings, Value Bridge and the executive report.
 */
export const GUARDRAILS = [
  {
    id: "gross-not-profit",
    title: "Gross revenue is not profit",
    text: "Contribution margin requires the hospital's operating cost data.",
  },
  {
    id: "package-price",
    title: "Package price is a commercial assumption",
    text:
      "EGP 800–1,200 per occupied ICU respiratory patient-day is subject to hospital Finance, payer and contract " +
      "validation. It is not an established Egyptian reimbursement rate.",
  },
  {
    id: "sensitivities",
    title: "Savings percentages are sensitivities",
    text: "5% / 10% / 15% are applied to the hospital's own baseline. They are not forecasts or claims.",
  },
  {
    id: "overlap",
    title: "Savings levers can overlap",
    text:
      "Ventilator, NIV/HFNC and consumable levers can overlap (circuits, filters, interfaces). " +
      "Finance should de-duplicate before quoting a total.",
  },
  {
    id: "billing-is-revenue",
    title: "Billing leakage recovery is revenue",
    text: "Recovered billing (unbilled eligible activity × tariff × collection rate) is counted as revenue, not as a saving.",
  },
] as const;

export type GuardrailId = (typeof GUARDRAILS)[number]["id"];

export function guardrail(id: GuardrailId) {
  const rule = GUARDRAILS.find((g) => g.id === id);
  if (!rule) throw new Error(`Unknown guardrail ${id}`);
  return rule;
}
