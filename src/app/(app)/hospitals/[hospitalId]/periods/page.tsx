import type { Metadata } from "next";
import Link from "next/link";
import { addMonths, currentMonth, monthLabel, PERIOD_STATUSES } from "@/domain/hospital";
import { FigureValue, TableWrap, td, tdNum, th, thNum } from "@/components/hospital/figures";
import { CreatePeriodForm } from "@/components/hospital/period-editors";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canInHospital, requireHospital } from "@/server/hospitals/access";
import { loadAnalytics, loadPeopleCached } from "@/server/hospitals/load";
import { createPeriod } from "../../_actions/periods";

export const metadata: Metadata = { title: "Monthly periods" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Cairo" });

export default async function PeriodsPage({ params }: PageProps<"/hospitals/[hospitalId]/periods">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId);
  const [{ periods, monthly }, people] = await Promise.all([loadAnalytics(hospitalId), loadPeopleCached()]);
  const latest = periods.at(-1)?.input.month;
  const suggested = latest ? addMonths(latest, 1) : currentMonth();
  const rows = [...periods].reverse();

  return (
    <>
      <PageHeader
        title="Monthly periods"
        description="What happened each month: service volumes, statistics, cost quantities and documented savings. Configuration (prices, costs) stays separate; each month uses the versions in force that month."
      />
      <div className="space-y-6">
        {canInHospital(ctx, "enter_period_data") ? (
          <Card>
            <CardHeader>
              <CardTitle>Create a period</CardTitle>
              <CardDescription>One period per month. New periods start as Draft.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreatePeriodForm hospitalId={hospitalId} defaultMonth={suggested} create={createPeriod.bind(null, hospitalId)} />
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Periods</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            {rows.length === 0 ? (
              <p className="px-5 text-sm text-muted sm:px-6">No periods yet.</p>
            ) : (
              <TableWrap>
                <table className="w-full min-w-[46rem] text-sm">
                  <thead className="border-y border-line bg-surface/60">
                    <tr>
                      <th scope="col" className={th}>Month</th>
                      <th scope="col" className={th}>Status</th>
                      <th scope="col" className={thNum}>Revenue</th>
                      <th scope="col" className={thNum}>Operating cost</th>
                      <th scope="col" className={thNum}>Savings</th>
                      <th scope="col" className={thNum}>Net value</th>
                      <th scope="col" className={th}>Closed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((p) => {
                      const s = monthly.find((m) => m.months[0] === p.input.month);
                      return (
                        <tr key={p.input.id}>
                          <td className={td}>
                            <Link href={`/hospitals/${hospitalId}/periods/${p.input.month}`} className="font-medium text-brand-blue-700 hover:underline">
                              {monthLabel(p.input.month)}
                            </Link>
                          </td>
                          <td className={td}>
                            <Badge tone={p.input.status === "draft" ? "neutral" : p.input.status === "in_review" ? "caution" : "blue"}>{PERIOD_STATUSES[p.input.status]}</Badge>
                          </td>
                          <td className={tdNum}><FigureValue figure={s?.revenue} compact missingLabel="—" className="font-normal" /></td>
                          <td className={tdNum}><FigureValue figure={s?.costs} compact missingLabel="Data required" className="font-normal" /></td>
                          <td className={tdNum}><FigureValue figure={s?.savings} compact missingLabel="—" className="font-normal" /></td>
                          <td className={tdNum}><FigureValue figure={s?.net} compact missingLabel="—" /></td>
                          <td className={`${td} text-xs text-muted`}>
                            {p.finalizedAt ? `${dateFormat.format(new Date(p.finalizedAt))} · ${p.finalizedBy ? (people[p.finalizedBy] ?? "Former user") : "System"}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
