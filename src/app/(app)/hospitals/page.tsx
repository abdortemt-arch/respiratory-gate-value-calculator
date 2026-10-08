import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus, TrendingUp, Trophy } from "lucide-react";
import { can } from "@/domain/access";
import { buildPortfolio, currentMonth, isMonth, latestMonth, monthLabel, PERIOD_STATUSES, type Month } from "@/domain/hospital";
import { formatPercent } from "@/domain/format";
import { Delta, FigureCard, FigureValue, Money, TableWrap, td, tdNum, th, thNum } from "@/components/hospital/figures";
import { MonthPicker } from "@/components/hospital/month-picker";
import { PageHeader } from "@/components/layout/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { loadHospitalsWithRoles } from "@/server/hospitals/access";
import { loadPortfolioData } from "@/server/hospitals/load";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage({ searchParams }: PageProps<"/hospitals">) {
  const user = await requireUser();
  const query = await searchParams;
  const [hospitals, data] = await Promise.all([loadHospitalsWithRoles(user), loadPortfolioData(user)]);
  const canAdd = can(user.role, "manage_hospitals");
  const months = [...new Set(data.flatMap((h) => h.periods.map((p) => p.month)))].sort();
  const month: Month = isMonth(query.month) ? query.month : (latestMonth(data) ?? currentMonth());
  const portfolio = buildPortfolio(data, month);
  const active = hospitals.filter((h) => h.active).length;
  const prev = monthLabel(portfolio.previousMonth, "short");

  return (
    <>
      <PageHeader
        title="Portfolio"
        description="Respiratory Care financial performance across hospitals. Each month is calculated with the prices and costs in force that month."
        actions={
          <>
            {months.length ? <MonthPicker months={months} value={month} /> : null}
            {canAdd ? (
              <LinkButton href="/hospitals/new">
                <Plus /> Add hospital
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

      {hospitals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 pt-5">
            <Building2 aria-hidden className="size-8 text-brand-blue" />
            {canAdd ? (
              <>
                <p className="text-sm text-ink-soft">No hospitals yet. Add the first hospital to configure its departments, services and prices.</p>
                <LinkButton href="/hospitals/new">
                  <Plus /> Add hospital
                </LinkButton>
              </>
            ) : (
              <p className="text-sm text-ink-soft">You do not have access to any hospital yet. Ask an Admin to add you to a hospital.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <section aria-label={`Totals for ${monthLabel(month)}`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FigureCard
              title="Hospitals"
              value={<span className="figure font-semibold">{hospitals.length}</span>}
              basis={`${active} active · ${portfolio.hospitalsWithData} with data for ${monthLabel(month, "short")}`}
              status={<Badge tone="neutral">Portfolio</Badge>}
            />
            <FigureCard
              title={`Revenue · ${monthLabel(month, "short")}`}
              figure={portfolio.totals.revenue}
              accent="blue"
              basis="Σ service volume × effective price, all hospitals"
              footer={<FigureValue figure={portfolio.ytd.revenue} compact className="text-xs font-medium text-muted" missingLabel="YTD: no data" />}
            />
            <FigureCard title={`Operating cost · ${monthLabel(month, "short")}`} figure={portfolio.totals.costs} basis="Staffing, consumables, equipment and contracts" footer={<span className="text-xs text-muted">YTD <FigureValue figure={portfolio.ytd.costs} compact missingLabel="no data" className="font-medium" /></span>} />
            <FigureCard title={`Documented savings · ${monthLabel(month, "short")}`} figure={portfolio.totals.savings} basis="Cost avoidance recorded per month (not forecasts)" footer={<span className="text-xs text-muted">YTD <FigureValue figure={portfolio.ytd.savings} compact missingLabel="none recorded" className="font-medium" /></span>} />
            <FigureCard
              title={`Net service-line value · ${monthLabel(month, "short")}`}
              figure={portfolio.totals.net}
              accent="orange"
              basis="Revenue − operating cost + documented savings (hospitals with cost data only)"
              footer={<span className="text-xs text-muted">YTD <FigureValue figure={portfolio.ytd.net} compact missingLabel="needs cost data" className="font-medium" /></span>}
            />
            <FigureCard
              title={`Year to date · ${month.slice(0, 4)}`}
              figure={portfolio.ytd.revenue}
              basis={`Revenue, Jan–${monthLabel(month, "short").split(" ")[0]} ${month.slice(0, 4)}`}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2" aria-label="Highlights">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy aria-hidden className="size-4 text-brand-orange" /> Highest value
                </CardTitle>
                <CardDescription>
                  {portfolio.highestValue?.month?.net.value !== null && portfolio.highestValue?.month?.net.value !== undefined
                    ? "Highest net service-line value this month"
                    : "Highest revenue this month (no hospital has cost data yet)"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {portfolio.highestValue ? (
                  <Link href={`/hospitals/${portfolio.highestValue.hospitalId}?month=${month}`} className="group block">
                    <p className="font-semibold text-ink group-hover:underline">{portfolio.highestValue.name}</p>
                    <p className="text-xl">
                      <FigureValue
                        figure={portfolio.highestValue.month?.net.value !== null ? portfolio.highestValue.month?.net : portfolio.highestValue.month?.revenue}
                        compact
                      />
                    </p>
                  </Link>
                ) : (
                  <p className="text-sm text-muted">No hospital has data for {monthLabel(month)}.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp aria-hidden className="size-4 text-brand-blue" /> Highest growth
                </CardTitle>
                <CardDescription>Revenue growth against {prev}</CardDescription>
              </CardHeader>
              <CardContent>
                {portfolio.highestGrowth ? (
                  <Link href={`/hospitals/${portfolio.highestGrowth.hospitalId}?month=${month}`} className="group block">
                    <p className="font-semibold text-ink group-hover:underline">{portfolio.highestGrowth.name}</p>
                    <p className="figure text-xl font-semibold">{formatPercent(portfolio.highestGrowth.revenueGrowth ?? 0)}</p>
                    <Delta change={portfolio.highestGrowth.revenueChange} suffix={`vs ${prev}`} />
                  </Link>
                ) : (
                  <p className="text-sm text-muted">Needs revenue in both {prev} and {monthLabel(month, "short")}.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2" aria-label="Movements">
            <Card>
              <CardHeader>
                <CardTitle>Major cost increases</CardTitle>
                <CardDescription>Largest cost-line increases against {prev}</CardDescription>
              </CardHeader>
              <CardContent>
                {portfolio.costIncreases.length ? (
                  <ul className="divide-y divide-line text-sm">
                    {portfolio.costIncreases.map((c) => (
                      <li key={`${c.hospitalId}-${c.item}`} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="font-medium text-ink">{c.item}</span>
                          <span className="block text-xs text-muted">
                            {c.hospitalName} · <Money value={c.from} compact missing="new" /> → <Money value={c.to} compact />
                          </span>
                        </span>
                        <Delta change={c.increase} higherIsBetter={false} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No cost increases against {prev}.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Revenue changes</CardTitle>
                <CardDescription>By hospital, against {prev}</CardDescription>
              </CardHeader>
              <CardContent>
                {portfolio.revenueChanges.length ? (
                  <ul className="divide-y divide-line text-sm">
                    {portfolio.revenueChanges.map((r) => (
                      <li key={r.hospitalId} className="flex items-center justify-between gap-3 py-2">
                        <Link href={`/hospitals/${r.hospitalId}/comparisons?mode=month&a=${portfolio.previousMonth}&b=${month}`} className="font-medium text-ink hover:underline">
                          {r.name}
                        </Link>
                        <Delta change={r.revenueChange} pct={r.revenueGrowth} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No revenue changes to compare against {prev}.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Hospitals</CardTitle>
              <CardDescription>{monthLabel(month)} — open a hospital for its dashboard, configuration and monthly data.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-0">
              <TableWrap>
                <table className="w-full min-w-[46rem] text-sm">
                  <thead className="border-y border-line bg-surface/60">
                    <tr>
                      <th scope="col" className={th}>Hospital</th>
                      <th scope="col" className={th}>Period</th>
                      <th scope="col" className={thNum}>Revenue</th>
                      <th scope="col" className={thNum}>Operating cost</th>
                      <th scope="col" className={thNum}>Net value</th>
                      <th scope="col" className={thNum}>vs {prev}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {portfolio.hospitals.map((r) => (
                      <tr key={r.hospitalId}>
                        <td className={td}>
                          <Link href={`/hospitals/${r.hospitalId}?month=${month}`} className="font-medium text-brand-blue-700 hover:underline">
                            {r.name}
                          </Link>
                          <span className="ml-2 text-xs text-muted">{r.code}</span>
                          {r.active ? null : <Badge tone="caution" className="ml-2">Inactive</Badge>}
                        </td>
                        <td className={td}>
                          {r.month?.status ? <Badge tone={r.month.status === "draft" ? "neutral" : "blue"}>{PERIOD_STATUSES[r.month.status]}</Badge> : <span className="text-xs text-muted">No period</span>}
                        </td>
                        <td className={tdNum}><FigureValue figure={r.month?.revenue} compact missingLabel="—" className="font-normal" /></td>
                        <td className={tdNum}><FigureValue figure={r.month?.costs} compact missingLabel="Data required" className="font-normal" /></td>
                        <td className={tdNum}><FigureValue figure={r.month?.net} compact missingLabel="—" /></td>
                        <td className={tdNum}><Delta change={r.revenueChange} pct={r.revenueGrowth} /></td>
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
