import type { Metadata } from "next";
import Link from "next/link";
import { aggregate, currentMonth, monthLabel, SAVINGS_CATEGORIES, ytdMonths, type SavingsCategory } from "@/domain/hospital";
import { FigureCard, Money } from "@/components/hospital/figures";
import { PageHeader } from "@/components/layout/app-shell";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireHospital } from "@/server/hospitals/access";
import { loadAnalytics } from "@/server/hospitals/load";

export const metadata: Metadata = { title: "Savings" };

export default async function SavingsPage({ params }: PageProps<"/hospitals/[hospitalId]/savings">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId);
  const { detail, periods, monthly } = await loadAnalytics(hospitalId);
  const latest = periods.at(-1)?.input.month ?? currentMonth();
  const ytdRange = ytdMonths(latest);
  const inYtd = monthly.filter((m) => ytdRange.includes(m.months[0]));
  const ytd = inYtd.length ? aggregate(detail.config, "YTD", inYtd.map((m) => m.months[0]), inYtd) : null;
  const withSavings = [...periods].reverse().filter((p) => p.input.savings.length > 0);

  return (
    <>
      <PageHeader
        title="Savings"
        description="Documented cost avoidance, month by month. Savings are recorded with what was saved — never estimated — and kept separate from revenue."
      />
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Savings totals">
          <FigureCard title={`Year to date · ${latest.slice(0, 4)}`} figure={ytd?.savings ?? null} missingLabel="None recorded" basis={`Jan–${monthLabel(latest, "short")}`} />
          <Card className="p-4 sm:p-5">
            <h3 className="mb-2 text-sm font-medium text-ink-soft">By category (YTD)</h3>
            {ytd && Object.keys(ytd.savingsByCategory).length ? (
              <dl className="space-y-1 text-sm">
                {(Object.entries(ytd.savingsByCategory) as [SavingsCategory, number][]).map(([c, v]) => (
                  <div key={c} className="flex justify-between gap-3">
                    <dt className="text-muted">{SAVINGS_CATEGORIES[c]}</dt>
                    <dd className="font-medium"><Money value={v} /></dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted">None recorded this year.</p>
            )}
          </Card>
        </section>

        {ctx.hospital.workbookModelEnabled ? (
          <Alert tone="info" title="Looking for savings scenarios?">
            Low / Mid / High savings sensitivities are part of the{" "}
            <Link href={`/hospitals/${hospitalId}/workbook/savings`}>Workbook Value Model</Link>. They are projections, not documented savings.
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Recorded savings</CardTitle>
            <CardDescription>Add savings in each month&apos;s period, under Documented savings.</CardDescription>
          </CardHeader>
          <CardContent>
            {withSavings.length === 0 ? (
              <p className="text-sm text-muted">
                No savings recorded yet.{" "}
                {periods.length ? (
                  <Link href={`/hospitals/${hospitalId}/periods/${latest}#savings`} className="font-medium text-brand-blue-700 hover:underline">
                    Record savings for {monthLabel(latest)}
                  </Link>
                ) : null}
              </p>
            ) : (
              <div className="space-y-5">
                {withSavings.map((p) => (
                  <section key={p.input.id} aria-labelledby={`sv-${p.input.month}`}>
                    <h3 id={`sv-${p.input.month}`} className="mb-1 flex items-center justify-between text-sm font-semibold">
                      <Link href={`/hospitals/${hospitalId}/periods/${p.input.month}#savings`} className="hover:underline">
                        {monthLabel(p.input.month)}
                      </Link>
                      <Money value={p.input.savings.reduce((s, x) => s + x.amount, 0)} />
                    </h3>
                    <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                      {p.input.savings.map((s) => (
                        <li key={s.id} className="flex justify-between gap-3 px-3 py-2">
                          <span>
                            <span className="text-ink">{s.description}</span>
                            <span className="block text-xs text-muted">{SAVINGS_CATEGORIES[s.category]}</span>
                          </span>
                          <Money value={s.amount} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
