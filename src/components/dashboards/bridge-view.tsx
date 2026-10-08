"use client";

import { hasValue } from "@/domain/calculations/quantity";
import { formatEgp } from "@/domain/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Guardrails } from "@/components/metrics/guardrails";
import { MetricCard } from "@/components/metrics/metric-card";
import { QuantityMissing, QuantityValue } from "@/components/metrics/quantity";
import { ValueBridgeChart } from "@/components/charts/value-bridge-chart";
import { useScenario } from "@/components/scenario/scenario-provider";

const TYPE_LABEL = { revenue: "Revenue", cost: "Cost", cost_avoidance: "Cost avoidance" } as const;

export function BridgeView() {
  const { model } = useScenario();
  const { bridge } = model;
  const labelOf = (id: string) => bridge.steps.find((s) => s.id === id)?.label ?? id;
  const excludedText = (ids: readonly string[]) => (ids.length ? `Excludes: ${ids.map(labelOf).join(", ")}` : "All steps quantified");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Gross revenue (calculated streams)" value={formatEgp(bridge.grossRevenue.value)} basis={excludedText(bridge.grossRevenue.excluded)} status={<Badge tone="blue">Revenue</Badge>} />
        <MetricCard title="Cost avoidance (calculated levers)" value={formatEgp(bridge.costAvoidance.value)} basis={excludedText(bridge.costAvoidance.excluded)} status={<Badge tone="orange">Sensitivity</Badge>} />
        <MetricCard title="RT operating cost" quantity={model.operatingCost.total} partialLabel="Provisional" calculatedLabel="Entered" />
        <MetricCard title="Net respiratory service-line value" quantity={bridge.net} partialLabel="Provisional" accent="orange" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hospital financial value bridge (EGP / year)</CardTitle>
          <CardDescription>
            Gross revenue − RT operating cost + cost avoided = net respiratory service-line value. Steps without hospital data
            are excluded and flagged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ValueBridgeChart bridge={bridge} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bridge steps</CardTitle>
          <CardDescription>The same figures as a table, in the workbook&apos;s order.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[38rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Bridge step</th>
                <th scope="col" className="py-2 pr-3 font-medium">Type</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">EGP / year</th>
                <th scope="col" className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bridge.steps.map((s) => (
                <tr key={s.id}>
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                    {s.label}
                    <QuantityMissing quantity={s.amount} />
                  </th>
                  <td className="py-2.5 pr-3 text-ink-soft">{TYPE_LABEL[s.type]}</td>
                  <td className="py-2.5 pr-3 text-right">
                    {hasValue(s.amount) ? (
                      <span className="figure">{formatEgp(s.type === "cost" ? -s.amount.value : s.amount.value)}</span>
                    ) : (
                      <QuantityValue quantity={s.amount} />
                    )}
                  </td>
                  <td className="py-2.5">
                    <Badge tone={hasValue(s.amount) ? (s.amount.kind === "partial" ? "caution" : "blue") : "neutral"}>
                      {hasValue(s.amount) && s.amount.kind === "partial" ? "Calculated — partial" : s.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line-strong">
              <tr>
                <th scope="row" colSpan={2} className="py-2.5 pr-3 text-left font-semibold">
                  Net respiratory service-line value
                </th>
                <td className="py-2.5 pr-3 text-right">
                  <QuantityValue quantity={bridge.net} compact={false} className="figure" />
                </td>
                <td className="py-2.5 text-xs text-muted">Shown once RT operating cost is entered.</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <Guardrails ids={["gross-not-profit", "billing-is-revenue", "overlap", "sensitivities"]} />
    </div>
  );
}
