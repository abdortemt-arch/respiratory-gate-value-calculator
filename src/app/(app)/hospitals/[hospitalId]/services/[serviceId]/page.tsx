import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addMonths,
  aggregate,
  currentMonth,
  formatPrice,
  isMonth,
  monthLabel,
  SERVICE_CATEGORIES,
  timeline,
  versionFor,
  versionsOf,
  volumeUnit,
  ytdMonths,
} from "@/domain/hospital";
import { formatNumber } from "@/domain/format";
import { Delta, FigureCard, Money, Num, TableWrap, td, tdNum, th, thNum } from "@/components/hospital/figures";
import { MonthPicker } from "@/components/hospital/month-picker";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireHospital } from "@/server/hospitals/access";
import { loadAnalytics } from "@/server/hospitals/load";
import { PriceFormSection, PricingHistorySection } from "../../_sections/config-sections";

export const metadata: Metadata = { title: "Service analytics" };

const change = (a: number | null | undefined, b: number | null | undefined) => (a === null || a === undefined || b === null || b === undefined ? null : b - a);

export default async function ServiceAnalyticsPage({ params, searchParams }: PageProps<"/hospitals/[hospitalId]/services/[serviceId]">) {
  const { hospitalId, serviceId } = await params;
  const query = await searchParams;
  const ctx = await requireHospital(hospitalId);
  const { detail, periods, monthly } = await loadAnalytics(hospitalId);
  const service = detail.services.find((s) => s.id === serviceId);
  if (!service) notFound();

  const months = periods.map((p) => p.input.month);
  const month = isMonth(query.month) ? query.month : (months.at(-1) ?? currentMonth());
  const versions = versionsOf(detail.config.priceVersions, "hospitalServiceId", serviceId);
  const current = versionFor(versions, month);
  const entries = timeline(versions);
  const idx = current ? entries.findIndex((e) => e.version.id === current.id) : -1;
  const previousPrice = idx >= 0 ? entries[idx + 1]?.version : undefined;
  const of = (m: (typeof monthly)[number] | undefined) => m?.services.find((s) => s.hospitalServiceId === serviceId);
  const now = of(monthly.find((m) => m.months[0] === month));
  const prev = of(monthly.find((m) => m.months[0] === addMonths(month, -1)));
  const ytdRange = ytdMonths(month);
  const inYtd = monthly.filter((m) => ytdRange.includes(m.months[0]));
  const ytd = inYtd.length ? of(aggregate(detail.config, "YTD", inYtd.map((m) => m.months[0]), inYtd)) : undefined;
  const unit = volumeUnit(current?.billingUnit ?? null);
  const prevLabel = `vs ${monthLabel(addMonths(month, -1), "short")}`;
  const deptName = new Map(detail.departments.map((d) => [d.id, d.name]));

  return (
    <>
      <PageHeader
        title={service.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{SERVICE_CATEGORIES[service.category]}</span>
            {service.active ? null : <Badge tone="neutral">Inactive</Badge>}
            <span>· {service.departmentIds.map((d) => deptName.get(d)).filter(Boolean).join(", ") || "Whole hospital"}</span>
          </span>
        }
        actions={months.length ? <MonthPicker months={months} value={month} /> : null}
      />
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={`${service.name} in ${monthLabel(month)}`}>
          <FigureCard
            title={`Price · ${monthLabel(month, "short")}`}
            value={current ? <span className="figure font-semibold">{formatPrice(current.amount, current.currency, current.billingUnit)}</span> : <span className="text-lg text-caution">No price</span>}
            basis={current ? `Effective since ${monthLabel(current.effectiveFrom)}${previousPrice ? ` · previous ${formatPrice(previousPrice.amount, previousPrice.currency, previousPrice.billingUnit)}` : ""}` : "Add a price in Pricing"}
            status={<Badge tone="orange">Price version</Badge>}
          />
          <FigureCard
            title="Volume"
            value={<span className="figure font-semibold">{now?.volume === null || now?.volume === undefined ? "—" : `${formatNumber(now.volume)} ${unit}`}</span>}
            status={<Badge tone="neutral">Activity</Badge>}
            footer={<Delta change={change(prev?.volume, now?.volume)} format="number" suffix={prevLabel} />}
          />
          <FigureCard title="Revenue" figure={now?.revenue ?? null} accent="blue" basis="Volume × price in force" footer={<Delta change={change(prev?.revenue.value, now?.revenue.value)} suffix={prevLabel} />} />
          <FigureCard
            title="Contribution"
            value={<Money value={now?.contribution ?? null} compact />}
            basis={`Revenue − direct cost (${now?.directCost ? `EGP ${formatNumber(now.directCost)}` : "none linked"})`}
            status={<Badge tone="neutral">Direct costs only</Badge>}
            footer={<Delta change={change(prev?.contribution, now?.contribution)} suffix={prevLabel} />}
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Year to date · {month.slice(0, 4)}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <dt className="text-muted">Volume</dt>
              <dd className="text-right"><Num value={ytd?.volume} /></dd>
              <dt className="text-muted">Revenue</dt>
              <dd className="text-right"><Money value={ytd?.revenue.value} /></dd>
              <dt className="text-muted">Average realised price</dt>
              <dd className="text-right"><Money value={ytd?.price} /></dd>
              <dt className="text-muted">Contribution</dt>
              <dd className="text-right"><Money value={ytd?.contribution} /></dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By month</CardTitle>
            <CardDescription>Each month at the price that was in force that month.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            <TableWrap>
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="border-y border-line bg-surface/60">
                  <tr>
                    <th scope="col" className={th}>Month</th>
                    <th scope="col" className={th}>Price in force</th>
                    <th scope="col" className={thNum}>Volume</th>
                    <th scope="col" className={thNum}>Revenue</th>
                    <th scope="col" className={thNum}>Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...monthly].reverse().map((m) => {
                    const s = of(m);
                    const v = versionFor(versions, m.months[0]);
                    return (
                      <tr key={m.months[0]}>
                        <td className={td}>
                          <Link href={`/hospitals/${hospitalId}/periods/${m.months[0]}`} className="text-brand-blue-700 hover:underline">
                            {monthLabel(m.months[0])}
                          </Link>
                        </td>
                        <td className={`${td} figure text-xs`}>{v ? formatPrice(v.amount, v.currency, v.billingUnit) : <span className="text-muted">No price</span>}</td>
                        <td className={tdNum}><Num value={s?.volume} /></td>
                        <td className={tdNum}><Money value={s?.revenue.value} /></td>
                        <td className={tdNum}><Money value={s?.contribution} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <PricingHistorySection ctx={ctx} serviceId={serviceId} />
            <PriceFormSection ctx={ctx} serviceId={serviceId} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
