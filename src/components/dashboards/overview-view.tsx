"use client";

import { WorkbookLink } from "@/components/scenario/workbook-link";
import { ArrowRight } from "lucide-react";
import { hasValue, missingInputs, type Quantity } from "@/domain/calculations/quantity";
import { ratio } from "@/domain/calculations/completeness";
import { OPERATING_COST_KEYS, type InputKey } from "@/domain/inputs/catalog";
import { formatEgp, formatNumber, formatPercent } from "@/domain/format";
import { SAVINGS_LEVEL_LABELS } from "@/domain/scenario";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompletenessBar } from "@/components/metrics/completeness";
import { Guardrails } from "@/components/metrics/guardrails";
import { MetricCard } from "@/components/metrics/metric-card";
import { inputLabel, QuantityMissing, QuantityStatus, QuantityValue } from "@/components/metrics/quantity";
import { ValueBridgeChart } from "@/components/charts/value-bridge-chart";
import { useScenario } from "@/components/scenario/scenario-provider";

interface NextStep {
  readonly unlocks: string;
  readonly keys: readonly InputKey[];
}

function nextSteps(items: readonly { unlocks: string; quantity: Quantity }[]): NextStep[] {
  return items
    .filter(({ quantity }) => quantity.kind !== "calculated")
    .map(({ unlocks, quantity }) => ({ unlocks, keys: missingInputs(quantity) }))
    .filter((s) => s.keys.length > 0);
}

export function OverviewView() {
  const { model, settings, values } = useScenario();
  const icu = model.revenue.icuPackage.annual;
  const net = model.bridge.net;
  const savings = model.savings.totals.byLevel[settings.savingsLevel];
  const opCost = model.operatingCost.total;
  const opEntered = OPERATING_COST_KEYS.filter((k) => values[k] !== null).length;
  const leversQuantified = model.savings.levers.filter((l) => hasValue(l.baseline)).length;

  const steps = nextSteps([
    { unlocks: "Net service-line value and contribution margin", quantity: opCost },
    ...model.savings.levers.map((l) => ({ unlocks: l.lever.label, quantity: l.baseline })),
    { unlocks: "Billing leakage recovery", quantity: model.revenue.billingLeakage },
    ...model.revenue.otherStreams.map((s) => ({ unlocks: s.stream.label, quantity: s.gross })),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="flex flex-col gap-2 border-brand-orange-100 bg-gradient-to-br from-brand-orange-50/80 via-card to-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink-soft">Annual ICU package gross potential</h2>
            <QuantityStatus quantity={icu} calculatedLabel="Scenario calculation" />
          </div>
          <QuantityValue quantity={icu} className="text-5xl tracking-tight text-ink sm:text-6xl" />
          {hasValue(icu) ? <p className="figure text-sm text-muted">{icu.basis}</p> : <QuantityMissing quantity={icu} />}
          <p className="text-xs text-muted">Gross potential revenue — not profit. Package price is a commercial assumption.</p>
        </Card>
        <Card className="flex flex-col gap-2 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink-soft">Net respiratory service-line value</h2>
            <QuantityStatus quantity={net} partialLabel="Provisional" />
          </div>
          <QuantityValue quantity={net} className="text-4xl tracking-tight text-ink" />
          {hasValue(net) ? (
            <p className="figure text-xs text-muted">{net.basis}</p>
          ) : (
            <p className="text-sm text-muted">Shown only once RT operating cost is entered — gross revenue alone is not value.</p>
          )}
          <QuantityMissing quantity={net} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="ICU beds"
          value={values.icu_beds === null ? "Data required" : formatNumber(values.icu_beds)}
          basis="Elite Hospital official ICU page (verified public source)"
          status={<Badge tone="blue">Verified</Badge>}
        />
        <MetricCard
          title="Occupancy (scenario)"
          value={formatPercent(settings.occupancyRate)}
          basis={
            values.icu_occupancy_rate_actual === null
              ? "Hospital actual occupancy: not provided"
              : `Hospital actual occupancy: ${formatPercent(values.icu_occupancy_rate_actual)}`
          }
          status={<Badge tone="orange">Selected</Badge>}
        />
        <MetricCard
          title="Package price (scenario)"
          value={formatEgp(settings.packagePrice)}
          basis="Per occupied ICU respiratory patient-day. Commercial assumption, not a reimbursement rate."
          status={<Badge tone="orange">Selected</Badge>}
        />
        <MetricCard
          title={`Quantified savings (${SAVINGS_LEVEL_LABELS[settings.savingsLevel]})`}
          quantity={savings}
          basis={`${leversQuantified} of 6 levers have a baseline · ${formatPercent(settings.sensitivities[settings.savingsLevel])} sensitivity · levers may overlap`}
          partialLabel="Partial"
          showMissing={false}
        />
        <MetricCard
          title="RT operating cost"
          quantity={opCost}
          basis={`${opEntered} of ${OPERATING_COST_KEYS.length} cost lines entered`}
          partialLabel={`Provisional · ${opEntered}/${OPERATING_COST_KEYS.length}`}
          calculatedLabel="Entered"
        />
        <MetricCard title="Billing leakage recovery" quantity={model.revenue.billingLeakage} basis="Counted as revenue, not savings" />
        <MetricCard title="ICU package contribution margin" quantity={model.operatingCost.contributionMargin} partialLabel="Provisional" />
        <MetricCard
          title="Data completeness"
          value={`${model.completeness.model.entered} / ${model.completeness.model.total}`}
          basis={`Model inputs entered · ${model.completeness.all.entered} of ${model.completeness.all.total} requested data points`}
          status={
            <Badge tone={ratio(model.completeness.model) === 1 ? "positive" : "caution"}>
              {Math.round(ratio(model.completeness.model) * 100)}%
            </Badge>
          }
          footer={<CompletenessBar count={model.completeness.model} />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Value bridge</CardTitle>
              <WorkbookLink to="value-bridge" className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue-700 hover:underline">
                Details <ArrowRight className="size-4" aria-hidden />
              </WorkbookLink>
            </div>
            <CardDescription>EGP per year for the selected scenario. Steps without hospital data are excluded and listed.</CardDescription>
          </CardHeader>
          <CardContent>
            <ValueBridgeChart bridge={model.bridge} showExcluded={false} />
            {model.bridge.grossRevenue.excluded.length + model.bridge.costAvoidance.excluded.length > 0 ? (
              <p className="mt-3 text-xs text-muted">
                Not yet quantified (excluded):{" "}
                {model.bridge.steps
                  .filter((s) => !hasValue(s.amount) && s.type !== "cost")
                  .map((s) => s.label)
                  .join(", ")}
                .
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next data to collect</CardTitle>
            <CardDescription>Each item lists the hospital inputs that would quantify it.</CardDescription>
          </CardHeader>
          <CardContent>
            {steps.length === 0 ? (
              <p className="text-sm text-positive">Every model input is entered.</p>
            ) : (
              <ol className="space-y-3">
                {steps.slice(0, 7).map((s) => (
                  <li key={s.unlocks} className="text-sm">
                    <p className="font-medium text-ink">{s.unlocks}</p>
                    <p className="text-xs text-muted">
                      {s.keys.slice(0, 3).map((k, i) => (
                        <span key={k}>
                          {i > 0 ? ", " : ""}
                          <WorkbookLink to={`inputs#${k}`} className="text-brand-blue-700 hover:underline">
                            {inputLabel(k)}
                          </WorkbookLink>
                        </span>
                      ))}
                      {s.keys.length > 3 ? ` and ${s.keys.length - 3} more` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Guardrails ids={["gross-not-profit", "package-price"]} />
    </div>
  );
}
