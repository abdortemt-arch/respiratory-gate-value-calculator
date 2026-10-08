"use client";

import { hasValue } from "@/domain/calculations/quantity";
import { formatEgp, formatPercent } from "@/domain/format";
import { SAVINGS_LEVELS, SAVINGS_LEVEL_LABELS } from "@/domain/scenario";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Guardrails } from "@/components/metrics/guardrails";
import { MetricCard } from "@/components/metrics/metric-card";
import { QuantityValue } from "@/components/metrics/quantity";
import { LeverBars } from "@/components/charts/lever-bars";
import { useScenario } from "@/components/scenario/scenario-provider";

export function SavingsView() {
  const { model, settings } = useScenario();
  const { levers, totals } = model.savings;
  const level = settings.savingsLevel;
  const quantified = levers.filter((l) => hasValue(l.baseline)).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          title={`Cost avoidance — ${SAVINGS_LEVEL_LABELS[level]} (${formatPercent(settings.sensitivities[level])})`}
          quantity={totals.byLevel[level]}
          accent="orange"
          calculatedLabel="Sensitivity"
          partialLabel="Partial"
          showMissing={false}
        />
        <MetricCard
          title="Baseline spend covered"
          quantity={totals.baseline}
          calculatedLabel="Hospital data"
          partialLabel="Partial"
          showMissing={false}
        />
        <MetricCard
          title="Levers with a baseline"
          value={`${quantified} of ${levers.length}`}
          basis="Levers reported as “Baseline required” are excluded from totals."
        />
      </div>

      <Alert tone="caution" title="Levers can overlap — totals are not de-duplicated">
        Ventilator, NIV/HFNC and consumable levers can overlap (circuits, filters, interfaces). Quote levers individually, or
        have Finance de-duplicate before quoting a total.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>
            Cost avoidance by lever — {SAVINGS_LEVEL_LABELS[level]} sensitivity
          </CardTitle>
          <CardDescription>Annual saving = hospital baseline × scenario %. Sensitivities, not forecasts.</CardDescription>
        </CardHeader>
        <CardContent>
          <LeverBars levers={levers} level={level} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Low / Mid / High scenarios</CardTitle>
          <CardDescription>EGP per year. The selected level is highlighted.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Lever</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Baseline</th>
                {SAVINGS_LEVELS.map((l) => (
                  <th key={l} scope="col" className={cn("py-2 pr-3 text-right font-medium", l === level && "text-brand-orange-ink")}>
                    {SAVINGS_LEVEL_LABELS[l]} {formatPercent(settings.sensitivities[l])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {levers.map(({ lever, baseline, savings }) => (
                <tr key={lever.id}>
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                    {lever.label}
                    {lever.caveat ? <span className="block text-xs font-normal text-muted">{lever.caveat}</span> : null}
                  </th>
                  <td className="py-2.5 pr-3 text-right">
                    <QuantityValue quantity={baseline} compact={false} className="figure font-normal" />
                  </td>
                  {SAVINGS_LEVELS.map((l) => (
                    <td key={l} className={cn("py-2.5 pr-3 text-right", l === level && "bg-brand-orange-50")}>
                      <QuantityValue quantity={savings[l]} compact={false} className="figure font-normal" />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 border-line-strong">
                <th scope="row" className="py-2.5 pr-3 text-left font-semibold">
                  Total (undeduplicated)
                </th>
                <td className="py-2.5 pr-3 text-right">
                  <QuantityValue quantity={totals.baseline} compact={false} className="figure" />
                </td>
                {SAVINGS_LEVELS.map((l) => (
                  <td key={l} className={cn("py-2.5 pr-3 text-right", l === level && "bg-brand-orange-50")}>
                    <QuantityValue quantity={totals.byLevel[l]} compact={false} className="figure" />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          {hasValue(totals.byLevel[level]) ? (
            <p className="mt-3 text-xs text-muted">Selected total: {formatEgp(totals.byLevel[level].value)} per year.</p>
          ) : null}
        </CardContent>
      </Card>

      <Guardrails ids={["sensitivities", "overlap"]} />
    </div>
  );
}
