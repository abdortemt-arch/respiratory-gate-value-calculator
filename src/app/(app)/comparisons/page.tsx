import type { Metadata } from "next";
import Link from "next/link";
import {
  compareSummaries,
  currentMonth,
  explainVariance,
  formatPrice,
  latestMonth,
  monthLabel,
  monthlySummaries,
  parseSpec,
  quartersOf,
  specLabel,
  specMonths,
  specToString,
  summarizeSpec,
  versionFor,
  versionsOf,
  yearsOf,
} from "@/domain/hospital";
import { formatNumber } from "@/domain/format";
import { MetricTable, VarianceView } from "@/components/hospital/comparison";
import { FigureValue, Money, TableWrap, td, tdNum, th, thNum } from "@/components/hospital/figures";
import { PageHeader } from "@/components/layout/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { requireUser } from "@/server/auth/session";
import { loadPortfolioData } from "@/server/hospitals/load";

export const metadata: Metadata = { title: "Comparisons" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PortfolioComparisonsPage({ searchParams }: PageProps<"/comparisons">) {
  const user = await requireUser();
  const sp = await searchParams;
  const data = await loadPortfolioData(user);
  const months = [...new Set(data.flatMap((h) => h.periods.map((p) => p.month)))].sort().reverse();
  const latest = latestMonth(data) ?? currentMonth();
  const span = parseSpec(one(sp.p)) ?? { kind: "month" as const, month: latest };
  const spanOptions = [
    ...months.map((m) => ({ value: m, label: monthLabel(m) })),
    ...months.slice(0, 1).map((m) => ({ value: `ytd:${m}`, label: `Year to date (${monthLabel(m, "short")})` })),
    ...quartersOf(months).map((q) => ({ value: q, label: specLabel(parseSpec(q)!) })),
    ...yearsOf(months).map((y) => ({ value: y, label: y })),
  ];
  if (!spanOptions.some((o) => o.value === specToString(span))) spanOptions.unshift({ value: specToString(span), label: specLabel(span) });

  const summaries = data.map((h) => ({ h, s: summarizeSpec(h.config, monthlySummaries(h.config, h.periods), span) }));
  const ha = one(sp.ha) ?? data[0]?.config.id;
  const hb = one(sp.hb) ?? data[1]?.config.id ?? data[0]?.config.id;
  const A = summaries.find((x) => x.h.config.id === ha);
  const B = summaries.find((x) => x.h.config.id === hb);
  const lastMonth = specMonths(span).at(-1)!;

  // Shared library services: price and volume side by side.
  const serviceIds = new Set([...(A?.h.config.services ?? []), ...(B?.h.config.services ?? [])].map((s) => s.serviceId));
  const serviceRows = [...serviceIds].map((serviceId) => {
    const side = (x: typeof A) => {
      const hs = x?.h.config.services.find((s) => s.serviceId === serviceId);
      const version = hs ? versionFor(versionsOf(x!.h.config.priceVersions, "hospitalServiceId", hs.id), lastMonth) : null;
      const summary = hs ? x!.s.services.find((s) => s.hospitalServiceId === hs.id) : undefined;
      return { name: hs?.name ?? null, price: version ? formatPrice(version.amount, version.currency, version.billingUnit) : null, volume: summary?.volume ?? null, revenue: summary?.revenue.value ?? null };
    };
    return { serviceId, a: side(A), b: side(B) };
  });

  return (
    <>
      <PageHeader title="Comparisons" description="Compare hospitals side by side for a month, quarter, year or year to date. Each hospital is calculated with its own prices and costs." />
      {data.length === 0 ? (
        <Alert tone="info" title="No hospitals to compare yet" />
      ) : (
        <div className="space-y-6">
          <Card className="no-print">
            <CardContent className="pt-5">
              <form action="/comparisons" className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5 text-sm font-medium">
                  <label htmlFor="cmp-ha" className="block">Hospital A</label>
                  <Select id="cmp-ha" name="ha" defaultValue={ha} className="w-56">
                    {data.map((h) => (
                      <option key={h.config.id} value={h.config.id}>
                        {h.config.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5 text-sm font-medium">
                  <label htmlFor="cmp-hb" className="block">Hospital B</label>
                  <Select id="cmp-hb" name="hb" defaultValue={hb} className="w-56">
                    {data.map((h) => (
                      <option key={h.config.id} value={h.config.id}>
                        {h.config.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5 text-sm font-medium">
                  <label htmlFor="cmp-p" className="block">Period</label>
                  <Select id="cmp-p" name="p" defaultValue={specToString(span)} className="w-56">
                    {spanOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit">Compare</Button>
              </form>
            </CardContent>
          </Card>

          {A && B ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {A.h.config.name} vs {B.h.config.name} · {specLabel(span)}
                  </CardTitle>
                  <CardDescription>Revenue, costs, savings, net value and efficiency measures.</CardDescription>
                </CardHeader>
                <CardContent>
                  <MetricTable aLabel={A.h.config.name} bLabel={B.h.config.name} rows={compareSummaries(A.s, B.s)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Services side by side</CardTitle>
                  <CardDescription>Same service in both hospitals: price in force ({monthLabel(lastMonth, "short")}), volume and revenue for {specLabel(span)}.</CardDescription>
                </CardHeader>
                <CardContent className="px-0 sm:px-0">
                  <TableWrap>
                    <table className="w-full min-w-[52rem] text-sm">
                      <thead className="border-y border-line bg-surface/60">
                        <tr>
                          <th scope="col" className={th}>Service</th>
                          <th scope="col" className={th}>Price · {A.h.config.code}</th>
                          <th scope="col" className={th}>Price · {B.h.config.code}</th>
                          <th scope="col" className={thNum}>Volume · {A.h.config.code}</th>
                          <th scope="col" className={thNum}>Volume · {B.h.config.code}</th>
                          <th scope="col" className={thNum}>Revenue · {A.h.config.code}</th>
                          <th scope="col" className={thNum}>Revenue · {B.h.config.code}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {serviceRows.map((r) => (
                          <tr key={r.serviceId}>
                            <td className={`${td} font-medium text-ink`}>{r.a.name ?? r.b.name}</td>
                            <td className={`${td} figure text-xs`}>{r.a.price ?? <span className="text-muted">{r.a.name ? "No price" : "Not provided"}</span>}</td>
                            <td className={`${td} figure text-xs`}>{r.b.price ?? <span className="text-muted">{r.b.name ? "No price" : "Not provided"}</span>}</td>
                            <td className={tdNum}>{r.a.volume === null ? <span className="text-muted">—</span> : formatNumber(r.a.volume)}</td>
                            <td className={tdNum}>{r.b.volume === null ? <span className="text-muted">—</span> : formatNumber(r.b.volume)}</td>
                            <td className={tdNum}><Money value={r.a.revenue} /></td>
                            <td className={tdNum}><Money value={r.b.revenue} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Why {B.h.config.name} differs from {A.h.config.name}
                  </CardTitle>
                  <CardDescription>Same services matched across hospitals: volume and price effects; costs by category.</CardDescription>
                </CardHeader>
                <CardContent>
                  <VarianceView variance={explainVariance(A.s, B.s)} />
                </CardContent>
              </Card>
            </>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>All hospitals · {specLabel(span)}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-0">
              <TableWrap>
                <table className="w-full min-w-[44rem] text-sm">
                  <thead className="border-y border-line bg-surface/60">
                    <tr>
                      <th scope="col" className={th}>Hospital</th>
                      <th scope="col" className={thNum}>Revenue</th>
                      <th scope="col" className={thNum}>Operating cost</th>
                      <th scope="col" className={thNum}>Net value</th>
                      <th scope="col" className={thNum}>Revenue per RT-covered bed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[...summaries]
                      .sort((x, y) => (y.s.revenue.value ?? -Infinity) - (x.s.revenue.value ?? -Infinity))
                      .map(({ h, s }) => (
                        <tr key={h.config.id}>
                          <td className={td}>
                            <Link href={`/hospitals/${h.config.id}`} className="font-medium text-brand-blue-700 hover:underline">
                              {h.config.name}
                            </Link>
                          </td>
                          <td className={tdNum}><FigureValue figure={s.revenue} compact missingLabel="—" className="font-normal" /></td>
                          <td className={tdNum}><FigureValue figure={s.costs} compact missingLabel="Data required" className="font-normal" /></td>
                          <td className={tdNum}><FigureValue figure={s.net} compact missingLabel="—" /></td>
                          <td className={tdNum}><Money value={s.kpis.revenuePerBed} compact /></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </TableWrap>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
