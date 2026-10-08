"use client";

import Image from "next/image";
import { Printer } from "lucide-react";
import { calculateModel } from "@/domain/calculations";
import { hasValue, type Quantity } from "@/domain/calculations/quantity";
import { GUARDRAILS } from "@/domain/copy/guardrails";
import { getInputDefinition, INPUT_GROUPS, OCCUPANCY_SCENARIO_KEYS, PRICE_SCENARIO_KEYS } from "@/domain/inputs/catalog";
import { formatEgp, formatNumber, formatPercent } from "@/domain/format";
import { SAVINGS_LEVELS, SAVINGS_LEVEL_LABELS } from "@/domain/scenario";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { useScenario } from "@/components/scenario/scenario-provider";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" });

function status(q: Quantity, calculated = "Calculated", partial = "Partial — some inputs missing"): string {
  if (q.kind === "calculated") return calculated;
  if (q.kind === "partial") return partial;
  return q.label;
}

function money(q: Quantity): string {
  return hasValue(q) ? formatEgp(q.value) : q.label;
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("print-break-avoid space-y-3", className)}>
      <h2 className="border-b border-line pb-1.5 text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const th = "py-1.5 pr-3 text-left text-xs font-medium text-muted";
const td = "py-1.5 pr-3 align-top";

export function ReportView({ organizationName, preparedBy }: { organizationName: string; preparedBy: string }) {
  const { model, settings, base, modified, scenarios, values } = useScenario();
  const { bridge, completeness } = model;
  const level = settings.savingsLevel;
  const missingModel = completeness.model.missing.map((k) => getInputDefinition(k));
  const byOwner = new Map<string, string[]>();
  for (const d of missingModel) byOwner.set(d.owner, [...(byOwner.get(d.owner) ?? []), d.label]);
  const comparison = scenarios.map((s) => ({ scenario: s, model: calculateModel(values, s.settings) }));

  const opLines = model.operatingCost.lines;
  const provisional = `Provisional — ${opLines.filter((l) => l.value !== null).length} of ${opLines.length} cost lines`;
  const headline: { label: string; q: Quantity; note: string; calculated?: string; partial?: string }[] = [
    { label: "ICU package gross potential (annual)", q: model.revenue.icuPackage.annual, note: "Gross potential — not profit", calculated: "Scenario calculation" },
    { label: "Billing leakage recovery", q: model.revenue.billingLeakage, note: "Revenue, not savings" },
    { label: `Cost avoidance — ${SAVINGS_LEVEL_LABELS[level]} sensitivity`, q: model.savings.totals.byLevel[level], note: "Undeduplicated sum of levers; sensitivity, not forecast", calculated: "Sensitivity" },
    { label: "RT operating cost", q: model.operatingCost.total, note: "Hospital cost data", partial: provisional },
    { label: "ICU package contribution margin", q: model.operatingCost.contributionMargin, note: "ICU package gross − RT operating cost", partial: "Provisional" },
    { label: "Net respiratory service-line value", q: bridge.net, note: "Shown only once operating cost is entered", partial: "Provisional" },
  ];

  return (
    <article className="mx-auto max-w-4xl space-y-7 rounded-[var(--radius-card)] border border-line bg-card p-6 shadow-[var(--shadow-card)] sm:p-10 print:max-w-none print:border-0 print:p-0 print:shadow-none">
      <div className="no-print flex justify-end">
        <Button onClick={() => window.print()}>
          <Printer /> Print / Save as PDF
        </Button>
      </div>

      <header className="flex items-start justify-between gap-6 border-b-2 border-brand-blue pb-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-brand-orange-ink uppercase">Executive summary</p>
          <h1 className="text-2xl font-semibold text-ink">Respiratory Care Service-Line Value</h1>
          <p className="text-sm text-ink-soft">{organizationName}</p>
          <p className="text-xs text-muted">
            {dateFormat.format(new Date())} · Prepared by {preparedBy} · Scenario: {base?.name ?? "Workbook default"}
            {modified ? " (modified, unsaved)" : ""}
            {base?.status === "approved" && !modified ? " · approved" : ""}
          </p>
        </div>
        <Image src="/brand/rg-logo-color.png" alt="Respiratory Gate" width={78} height={90} className="shrink-0" />
      </header>

      <Section title="Selected scenario">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["ICU beds", values.icu_beds === null ? "Data required" : formatNumber(values.icu_beds)],
            ["Occupancy", formatPercent(settings.occupancyRate)],
            ["Package price", `${formatEgp(settings.packagePrice)} / patient-day`],
            ["Savings level", `${SAVINGS_LEVEL_LABELS[level]} (${formatPercent(settings.sensitivities[level])})`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface p-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Headline figures (EGP / year)">
        <div className="relative overflow-x-auto print:overflow-visible">
<table className="w-full min-w-[34rem] text-sm print:min-w-0">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Measure</th>
              <th className={cn(th, "text-right")}>Value</th>
              <th className={th}>Basis</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {headline.map((h) => (
              <tr key={h.label}>
                <td className={cn(td, "font-medium")}>{h.label}</td>
                <td className={cn(td, "figure text-right font-semibold whitespace-nowrap", !hasValue(h.q) && "text-caution")}>{money(h.q)}</td>
                <td className={cn(td, "text-xs text-muted")}>
                  {hasValue(h.q) ? h.q.basis : h.note}
                </td>
                <td className={cn(td, "text-xs")}>{status(h.q, h.calculated, h.partial)}</td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </Section>

      <Section title="Value bridge">
        <div className="relative overflow-x-auto print:overflow-visible">
<table className="w-full min-w-[34rem] text-sm print:min-w-0">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Step</th>
              <th className={th}>Type</th>
              <th className={cn(th, "text-right")}>EGP / year</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bridge.steps.map((s) => (
              <tr key={s.id}>
                <td className={td}>{s.label}</td>
                <td className={cn(td, "text-ink-soft")}>{s.type === "cost_avoidance" ? "Cost avoidance" : s.type === "cost" ? "Cost" : "Revenue"}</td>
                <td className={cn(td, "figure text-right whitespace-nowrap", !hasValue(s.amount) && "text-caution")}>
                  {hasValue(s.amount) ? formatEgp(s.type === "cost" ? -s.amount.value : s.amount.value) : s.amount.label}
                </td>
                <td className={cn(td, "text-xs")}>{hasValue(s.amount) && s.amount.kind === "partial" ? "Calculated — partial" : s.status}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-line-strong font-semibold">
              <td className={td} colSpan={2}>
                Net respiratory service-line value
              </td>
              <td className={cn(td, "figure text-right whitespace-nowrap", !hasValue(bridge.net) && "text-caution")}>{money(bridge.net)}</td>
              <td className={cn(td, "text-xs font-normal")}>{status(bridge.net, "Calculated", "Provisional")}</td>
            </tr>
          </tbody>
        </table>
</div>
      </Section>

      <Section title="Cost-avoidance levers (EGP / year)">
        <div className="relative overflow-x-auto print:overflow-visible">
<table className="w-full min-w-[34rem] text-sm print:min-w-0">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Lever</th>
              <th className={cn(th, "text-right")}>Baseline</th>
              {SAVINGS_LEVELS.map((l) => (
                <th key={l} className={cn(th, "text-right", l === level && "text-brand-orange-ink")}>
                  {SAVINGS_LEVEL_LABELS[l]} {formatPercent(settings.sensitivities[l])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {model.savings.levers.map(({ lever, baseline, savings }) => (
              <tr key={lever.id}>
                <td className={td}>{lever.label}</td>
                <td className={cn(td, "figure text-right whitespace-nowrap", !hasValue(baseline) && "text-caution")}>{money(baseline)}</td>
                {SAVINGS_LEVELS.map((l) => (
                  <td key={l} className={cn(td, "figure text-right whitespace-nowrap", !hasValue(savings[l]) && "text-caution")}>
                    {money(savings[l])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
</div>
        <p className="text-xs text-muted">Levers can overlap (circuits, filters, interfaces); totals are not de-duplicated.</p>
      </Section>

      <Section title="Data completeness">
        <p className="text-sm">
          <strong>
            {completeness.model.entered} of {completeness.model.total}
          </strong>{" "}
          model inputs entered ·{" "}
          <strong>
            {completeness.all.entered} of {completeness.all.total}
          </strong>{" "}
          requested data points overall.
        </p>
        <div className="relative overflow-x-auto print:overflow-visible">
<table className="w-full min-w-[34rem] text-sm print:min-w-0">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Input group</th>
              <th className={cn(th, "text-right")}>Entered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {INPUT_GROUPS.filter((g) => completeness.byGroup[g.id]).map((g) => (
              <tr key={g.id}>
                <td className={td}>{g.label}</td>
                <td className={cn(td, "figure text-right")}>
                  {completeness.byGroup[g.id]?.entered} / {completeness.byGroup[g.id]?.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
        {byOwner.size > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Data still required, by owner</h3>
            <ul className="space-y-1.5 text-sm">
              {[...byOwner.entries()].map(([owner, labels]) => (
                <li key={owner}>
                  <span className="font-medium">{owner}:</span> <span className="text-ink-soft">{labels.join("; ")}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      {comparison.length > 1 ? (
        <Section title="Scenario comparison (EGP / year)">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Scenario</th>
                  <th className={cn(th, "text-right")}>ICU package</th>
                  <th className={cn(th, "text-right")}>Gross revenue</th>
                  <th className={cn(th, "text-right")}>Cost avoidance</th>
                  <th className={cn(th, "text-right")}>Net value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {comparison.map(({ scenario: s, model: m }) => (
                  <tr key={s.id}>
                    <td className={td}>
                      <span className="font-medium">{s.name}</span>
                      <span className="block text-xs text-muted">
                        {formatPercent(s.settings.occupancyRate)} · {formatEgp(s.settings.packagePrice)} · {SAVINGS_LEVEL_LABELS[s.settings.savingsLevel]}
                        {s.status === "approved" ? " · approved" : ""}
                      </span>
                    </td>
                    <td className={cn(td, "figure text-right whitespace-nowrap")}>{money(m.revenue.icuPackage.annual)}</td>
                    <td className={cn(td, "figure text-right whitespace-nowrap")}>{formatEgp(m.bridge.grossRevenue.value)}</td>
                    <td className={cn(td, "figure text-right whitespace-nowrap")}>{formatEgp(m.bridge.costAvoidance.value)}</td>
                    <td className={cn(td, "figure text-right whitespace-nowrap", !hasValue(m.bridge.net) && "text-caution")}>
                      {money(m.bridge.net)}
                      {m.bridge.net.kind === "partial" ? " (provisional)" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      <Section title="Assumptions and financial guardrails">
        <p className="text-sm text-ink-soft">
          Occupancy grid {OCCUPANCY_SCENARIO_KEYS.map((k) => (values[k] === null ? "—" : formatPercent(values[k] as number))).join(" / ")} ·
          price grid {PRICE_SCENARIO_KEYS.map((k) => (values[k] === null ? "—" : formatEgp(values[k] as number))).join(" / ")} ·{" "}
          {values.days_per_month ?? "—"}-day month, {values.days_per_year ?? "—"}-day year.
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {GUARDRAILS.map((g) => (
            <li key={g.id}>
              <span className="font-medium">{g.title}.</span> <span className="text-ink-soft">{g.text}</span>
            </li>
          ))}
        </ol>
      </Section>

      <footer className="border-t border-line pt-4 text-xs text-muted">
        Generated by the Respiratory Gate platform from hospital inputs and Respiratory Gate assumptions. Scenario
        calculations, not audited financial statements. Missing hospital data is shown as missing — never as zero.
      </footer>
    </article>
  );
}
