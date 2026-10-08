import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import {
  addMonths,
  aggregate,
  currentMonth,
  formatPrice,
  hospitalBeds,
  isMonth,
  monthLabel,
  PERIOD_STATUSES,
  versionFor,
  versionsOf,
  volumeUnit,
  ytdMonths,
} from "@/domain/hospital";
import { formatNumber, formatPercent } from "@/domain/format";
import { Delta, FigureCard, FigureValue, Money, Num, TableWrap, td, tdNum, th, thNum } from "@/components/hospital/figures";
import { MonthPicker } from "@/components/hospital/month-picker";
import { TrendChart } from "@/components/hospital/trend-chart";
import { PageHeader } from "@/components/layout/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canInHospital, requireHospital } from "@/server/hospitals/access";
import { loadAnalytics } from "@/server/hospitals/load";

export const metadata: Metadata = { title: "Hospital overview" };

const change = (a: number | null | undefined, b: number | null | undefined) => (a === null || a === undefined || b === null || b === undefined ? null : b - a);

export default async function HospitalOverviewPage({ params, searchParams }: PageProps<"/hospitals/[hospitalId]">) {
  const { hospitalId } = await params;
  const query = await searchParams;
  const ctx = await requireHospital(hospitalId);
  const { detail, periods, monthly } = await loadAnalytics(hospitalId);
  const months = periods.map((p) => p.input.month);
  const month = isMonth(query.month) ? query.month : (months.at(-1) ?? currentMonth());
  const summary = monthly.find((m) => m.months[0] === month) ?? null;
  const previous = monthly.find((m) => m.months[0] === addMonths(month, -1)) ?? null;
  const ytdRange = ytdMonths(month);
  const inYtd = monthly.filter((m) => ytdRange.includes(m.months[0]));
  const ytd = inYtd.length ? aggregate(detail.config, `YTD ${monthLabel(month, "short")}`, ytdRange.filter((m) => inYtd.some((x) => x.months[0] === m)), inYtd) : null;
  const prevLabel = `vs ${monthLabel(addMonths(month, -1), "short")}`;

  const activeServices = detail.services.filter((s) => s.active);
  const activeDepartments = detail.departments.filter((d) => d.active);
  const beds = hospitalBeds(detail.config);
  const pricedServices = activeServices.filter((s) => detail.config.priceVersions.some((v) => v.hospitalServiceId === s.id && !v.voided));
  const setup = [
    { done: activeDepartments.length > 0, label: "Add departments", href: `/hospitals/${hospitalId}/setup/departments` },
    { done: activeServices.length > 0, label: "Add services and assign them to departments", href: `/hospitals/${hospitalId}/setup/services` },
    { done: activeServices.length > 0 && pricedServices.length === activeServices.length, label: "Enter prices for every service", href: `/hospitals/${hospitalId}/pricing` },
    { done: detail.costItems.length > 0, label: "Add operating costs (staffing, consumables, equipment)", href: `/hospitals/${hospitalId}/costs` },
    { done: periods.length > 0, label: "Create the first monthly period and enter activity", href: `/hospitals/${hospitalId}/periods` },
  ];
  const setupDone = setup.every((s) => s.done);
  const trend = monthly.slice(-12).map((m) => ({ month: m.months[0], revenue: m.revenue.value, costs: m.costs.value, net: m.net.value }));

  return (
    <>
      <PageHeader
        title={ctx.hospital.name}
        description={`Respiratory Care financial overview for ${monthLabel(month)}. Each month is calculated with its own prices and costs.`}
        actions={
          <>
            {months.length ? <MonthPicker months={months} value={month} /> : null}
            {summary && canInHospital(ctx, "enter_period_data") ? (
              <LinkButton href={`/hospitals/${hospitalId}/periods/${month}`} variant="secondary">
                Open {monthLabel(month, "short")} data
              </LinkButton>
            ) : null}
          </>
        }
      />

      {query.denied === "1" ? (
        <Alert tone="caution" title="That page is not available for your role" className="mb-6">
          Ask an Admin if you need access.
        </Alert>
      ) : null}

      {!setupDone && canInHospital(ctx, "edit_hospital_config") ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Finish setting up {ctx.hospital.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {setup.map((s) => (
                <li key={s.label} className="flex items-center gap-2">
                  {s.done ? <CheckCircle2 aria-hidden className="size-4 text-positive" /> : <Circle aria-hidden className="size-4 text-muted" />}
                  {s.done ? (
                    <span className="text-muted line-through">{s.label}</span>
                  ) : (
                    <Link href={s.href} className="font-medium text-brand-blue-700 hover:underline">
                      {s.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-6">
        {summary ? (
          <>
            <section aria-label={`Results for ${monthLabel(month)}`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <FigureCard
                title={`Revenue · ${monthLabel(month, "short")}`}
                figure={summary.revenue}
                accent="blue"
                basis="Σ service volume × price in force"
                footer={<Delta change={change(previous?.revenue.value, summary.revenue.value)} suffix={prevLabel} />}
              />
              <FigureCard
                title="Operating cost"
                figure={summary.costs}
                basis="All cost items at this month's versions"
                footer={<Delta change={change(previous?.costs.value, summary.costs.value)} higherIsBetter={false} suffix={prevLabel} />}
              />
              <FigureCard
                title="Net service-line value"
                figure={summary.net}
                accent="orange"
                basis="Revenue − operating cost + documented savings"
                footer={<Delta change={change(previous?.net.value, summary.net.value)} suffix={prevLabel} />}
              />
              <FigureCard
                title="Staffing cost"
                value={<Money value={summary.costsByCategory.staffing ?? null} compact missing="None recorded" />}
                basis={summary.kpis.rtFte !== null ? `${formatNumber(summary.kpis.rtFte)} RT FTE` : "Per-FTE monthly cost × FTEs"}
                status={<Badge tone="neutral">Staffing</Badge>}
                footer={<Delta change={change(previous?.costsByCategory.staffing, summary.costsByCategory.staffing)} higherIsBetter={false} suffix={prevLabel} />}
              />
              <FigureCard
                title="Consumables"
                value={<Money value={summary.costsByCategory.consumable ?? null} compact missing="None recorded" />}
                basis="Unit cost × quantity used"
                status={<Badge tone="neutral">Consumables</Badge>}
                footer={<Delta change={change(previous?.costsByCategory.consumable, summary.costsByCategory.consumable)} higherIsBetter={false} suffix={prevLabel} />}
              />
              <FigureCard
                title="Documented savings"
                figure={summary.savings}
                basis="Recorded cost avoidance (not forecasts)"
                missingLabel="None recorded"
                status={summary.savings.status === "missing" ? <Badge tone="neutral">None recorded</Badge> : undefined}
                footer={<Delta change={change(previous?.savings.value, summary.savings.value)} suffix={prevLabel} />}
              />
            </section>

            <section aria-label="Year to date and operations" className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Year to date · {month.slice(0, 4)}</CardTitle>
                  <CardDescription>
                    {ytd ? `${ytd.monthsWithData.length} month${ytd.monthsWithData.length === 1 ? "" : "s"} with data, through ${monthLabel(month, "short")}` : "No months yet"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <dt className="text-muted">Revenue</dt>
                    <dd className="text-right"><FigureValue figure={ytd?.revenue} missingLabel="—" /></dd>
                    <dt className="text-muted">Operating cost</dt>
                    <dd className="text-right"><FigureValue figure={ytd?.costs} missingLabel="Data required" /></dd>
                    <dt className="text-muted">Documented savings</dt>
                    <dd className="text-right"><FigureValue figure={ytd?.savings} missingLabel="None recorded" className="font-normal" /></dd>
                    <dt className="text-muted">Net value</dt>
                    <dd className="text-right"><FigureValue figure={ytd?.net} missingLabel="Needs cost data" /></dd>
                  </dl>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Operations · {monthLabel(month, "short")}</CardTitle>
                  <CardDescription>
                    Period status: <Badge tone={summary.status === "draft" ? "neutral" : "blue"}>{summary.status ? PERIOD_STATUSES[summary.status] : "—"}</Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <dt className="text-muted">Active services</dt>
                    <dd className="figure text-right font-medium">{activeServices.length}</dd>
                    <dt className="text-muted">Departments</dt>
                    <dd className="figure text-right font-medium">{activeDepartments.length}</dd>
                    <dt className="text-muted">Beds</dt>
                    <dd className="figure text-right font-medium">
                      {beds ?? <span className="text-caution">Unknown</span>}
                      {summary.kpis.coveredBeds !== null && summary.kpis.coveredBeds !== beds ? (
                        <span className="block text-xs font-normal text-muted">{summary.kpis.coveredBeds} RT-covered</span>
                      ) : null}
                    </dd>
                    <dt className="text-muted">Occupancy</dt>
                    <dd className="figure text-right font-medium">
                      {summary.kpis.occupancy !== null ? (
                        <>
                          {formatPercent(summary.kpis.occupancy)}
                          <span className="block text-xs font-normal text-muted">of {summary.kpis.occupancyBeds} beds reporting bed-days</span>
                        </>
                      ) : (
                        <span className="text-xs font-normal text-caution">Needs occupied bed-days</span>
                      )}
                    </dd>
                    <dt className="text-muted">Revenue per RT-covered bed</dt>
                    <dd className="text-right"><Money value={summary.kpis.revenuePerBed} compact /></dd>
                    <dt className="text-muted">Cost per patient</dt>
                    <dd className="text-right"><Money value={summary.kpis.costPerPatient} compact /></dd>
                  </dl>
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Services · {monthLabel(month)}</CardTitle>
                <CardDescription>Price in force, volume, revenue and direct cost per service, against the previous month.</CardDescription>
              </CardHeader>
              <CardContent className="px-0 sm:px-0">
                <TableWrap>
                  <table className="w-full min-w-[52rem] text-sm">
                    <thead className="border-y border-line bg-surface/60">
                      <tr>
                        <th scope="col" className={th}>Service</th>
                        <th scope="col" className={th}>Price in force</th>
                        <th scope="col" className={thNum}>Volume</th>
                        <th scope="col" className={thNum}>Revenue</th>
                        <th scope="col" className={thNum}>Direct cost</th>
                        <th scope="col" className={thNum}>Contribution</th>
                        <th scope="col" className={thNum}>{prevLabel}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {summary.services.map((s) => {
                        const prev = previous?.services.find((p) => p.hospitalServiceId === s.hospitalServiceId);
                        const version = versionFor(versionsOf(detail.config.priceVersions, "hospitalServiceId", s.hospitalServiceId), month);
                        return (
                          <tr key={s.hospitalServiceId}>
                            <td className={td}>
                              <Link href={`/hospitals/${hospitalId}/services/${s.hospitalServiceId}?month=${month}`} className="font-medium text-brand-blue-700 hover:underline">
                                {s.name}
                              </Link>
                            </td>
                            <td className={`${td} figure text-xs text-ink-soft`}>
                              {version ? `${formatPrice(version.amount, version.currency, version.billingUnit)} · since ${monthLabel(version.effectiveFrom, "short")}` : <span className="text-caution">No price</span>}
                            </td>
                            <td className={tdNum}>
                              <Num value={s.volume} missing="Not entered" /> <span className="text-xs text-muted">{volumeUnit(s.billingUnit)}</span>
                            </td>
                            <td className={tdNum}><FigureValue figure={s.revenue} missingLabel="—" className="font-normal" /></td>
                            <td className={tdNum}><Money value={s.directCost || null} missing="—" /></td>
                            <td className={tdNum}><Money value={s.contribution} /></td>
                            <td className={tdNum}><Delta change={change(prev?.revenue.value, s.revenue.value)} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
              </CardContent>
            </Card>

            {summary.issues.length ? (
              <Alert tone="caution" title="Data still required for this month">
                <ul className="list-disc space-y-0.5 pl-4">
                  {summary.issues.slice(0, 8).map((i) => (
                    <li key={i.message}>{i.message}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
          </>
        ) : (
          <Card>
            <CardContent className="pt-5 text-sm text-muted">
              No operating period for {monthLabel(month)}.{" "}
              {canInHospital(ctx, "enter_period_data") ? (
                <Link href={`/hospitals/${hospitalId}/periods/${month}`} className="font-medium text-brand-blue-700 hover:underline">
                  Create it
                </Link>
              ) : null}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Monthly trend</CardTitle>
            <CardDescription>Revenue and operating cost, last 12 months with data.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart points={trend} selected={month} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
