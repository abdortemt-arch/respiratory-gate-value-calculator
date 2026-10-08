"use client";

import { hasValue } from "@/domain/calculations/quantity";
import { formatEgp, formatNumber } from "@/domain/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Guardrails } from "@/components/metrics/guardrails";
import { MetricCard } from "@/components/metrics/metric-card";
import { QuantityMissing, QuantityStatus, QuantityValue } from "@/components/metrics/quantity";
import { RevenueMatrix } from "@/components/charts/revenue-matrix";
import { useScenario } from "@/components/scenario/scenario-provider";

export function RevenueView() {
  const { model, settings, update, values } = useScenario();
  const { icuPackage, matrix, otherStreams, billingLeakage } = model.revenue;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="Daily gross (selected)" quantity={icuPackage.daily} calculatedLabel="Scenario calculation" />
        <MetricCard
          title="Monthly gross (selected)"
          quantity={icuPackage.monthly}
          calculatedLabel="Scenario calculation"
          footer={<p className="text-xs text-muted">30-day month assumption: 12 months ≠ the 365-day annual figure.</p>}
        />
        <MetricCard title="Annual gross (selected)" quantity={icuPackage.annual} calculatedLabel="Scenario calculation" accent="orange" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ICU Respiratory Management Package — occupancy × price</CardTitle>
          <CardDescription>
            Gross potential revenue per occupied ICU respiratory patient-day. Grid values are Respiratory Gate assumptions,
            editable by Admins in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueMatrix matrix={matrix} selected={settings} onSelect={(occupancyRate, packagePrice) => update({ occupancyRate, packagePrice })} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Other revenue streams</CardTitle>
            <CardDescription>Hospital inputs — left as “Scenario pending” until volume and price are entered.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Stream</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Volume / yr</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Price</th>
                  <th scope="col" className="py-2 text-right font-medium">Gross / yr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {otherStreams.map(({ stream, gross }) => (
                  <tr key={stream.id}>
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                      {stream.label}
                      <span className="block text-xs font-normal text-muted">{stream.basisLabel}</span>
                    </th>
                    <td className="figure py-2.5 pr-3 text-right">
                      {values[stream.volumeKey] === null ? <span className="text-muted">—</span> : formatNumber(values[stream.volumeKey] as number)}
                    </td>
                    <td className="figure py-2.5 pr-3 text-right">
                      {values[stream.priceKey] === null ? <span className="text-muted">—</span> : formatEgp(values[stream.priceKey] as number)}
                    </td>
                    <td className="py-2.5 text-right">
                      <QuantityValue quantity={gross} compact={false} className="figure" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <MetricCard title="Billing leakage recovery" quantity={billingLeakage} basis={hasValue(billingLeakage) ? undefined : "Unbilled eligible activities × average tariff × collection rate"} footer={<p className="text-xs text-muted">Recovered billing is revenue, not a saving.</p>} />
          <Card className="flex flex-col gap-2 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-ink-soft">ICU package contribution margin</h3>
              <QuantityStatus quantity={model.operatingCost.contributionMargin} partialLabel="Provisional" />
            </div>
            <QuantityValue quantity={model.operatingCost.contributionMargin} className="text-2xl" />
            <p className="text-xs text-muted">ICU package gross − total RT operating cost. Requires the hospital&apos;s cost data.</p>
            <QuantityMissing quantity={model.operatingCost.contributionMargin} />
          </Card>
        </div>
      </div>

      <Guardrails ids={["gross-not-profit", "package-price", "billing-is-revenue"]} />
    </div>
  );
}
