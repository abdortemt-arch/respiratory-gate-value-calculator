import type { Metadata } from "next";
import {
  COST_CATEGORIES,
  currentMonth,
  explainVariance,
  formatPrice,
  monthLabel,
  parseSpec,
  PERIOD_STATUSES,
  previousSpec,
  quartersOf,
  specLabel,
  specMonths,
  specToString,
  summarizeSpec,
  versionFor,
  versionsOf,
  volumeUnit,
  yearsOf,
  type CostCategory,
} from "@/domain/hospital";
import { formatEgp, formatNumber, formatPercent } from "@/domain/format";
import { VarianceView } from "@/components/hospital/comparison";
import { Delta, FigureStatusBadge, FigureValue, Money, Num } from "@/components/hospital/figures";
import { PrintButton } from "@/components/hospital/print-button";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { requireHospital } from "@/server/hospitals/access";
import { loadAnalytics } from "@/server/hospitals/load";

export const metadata: Metadata = { title: "Hospital report" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" });
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const th = "py-1.5 pr-3 text-left text-xs font-semibold text-muted";
const thR = "py-1.5 pr-3 text-right text-xs font-semibold text-muted";

export default async function HospitalReportPage({ params, searchParams }: PageProps<"/hospitals/[hospitalId]/reports">) {
  const { hospitalId } = await params;
  const sp = await searchParams;
  const ctx = await requireHospital(hospitalId, "export_reports");
  const { detail, periods, monthly } = await loadAnalytics(hospitalId);
  const months = periods.map((p) => p.input.month).sort().reverse();
  const latest = months[0] ?? currentMonth();
  const spec = parseSpec(one(sp.p)) ?? { kind: "month" as const, month: latest };
  const options = [
    ...months.map((m) => ({ value: m, label: monthLabel(m) })),
    ...quartersOf(months).map((q) => ({ value: q, label: specLabel(parseSpec(q)!) })),
    ...months.slice(0, 1).map((m) => ({ value: `ytd:${m}`, label: `Year to date (${monthLabel(m, "short")})` })),
    ...yearsOf(months).map((y) => ({ value: y, label: y })),
  ];
  const s = summarizeSpec(detail.config, monthly, spec);
  const prevSpec = previousSpec(spec);
  const prev = summarizeSpec(detail.config, monthly, prevSpec);
  const prevHasData = prev.monthsWithData.length > 0;
  const lastMonth = specMonths(spec).at(-1)!;
  const statuses = periods.filter((p) => specMonths(spec).includes(p.input.month)).map((p) => `${monthLabel(p.input.month, "short")}: ${PERIOD_STATUSES[p.input.status]}`);
  const change = (a: number | null, b: number | null) => (prevHasData && a !== null && b !== null ? b - a : null);

  const key = [
    { label: "Revenue", f: s.revenue, p: prev.revenue, note: "Service volume × price in force each month. Gross revenue — not profit.", better: true },
    { label: "Operating cost", f: s.costs, p: prev.costs, note: "Staffing, consumables, equipment and contracts at each month's cost versions.", better: false },
    { label: "Documented savings", f: s.savings, p: prev.savings, note: "Recorded cost avoidance, kept separate from revenue.", better: true },
    { label: "Net service-line value", f: s.net, p: prev.net, note: "Revenue − operating cost + documented savings. Not shown without cost data.", better: true },
  ];

  return (
    <>
      <form className="no-print mb-4 flex flex-wrap items-end justify-between gap-3" action={`/hospitals/${hospitalId}/reports`}>
        <span className="flex flex-wrap items-end gap-3">
          <span className="space-y-1.5 text-sm font-medium">
            <label htmlFor="report-period" className="block">
              Report period
            </label>
            <Select id="report-period" name="p" defaultValue={specToString(spec)} className="w-60">
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </span>
          <Button type="submit" variant="secondary">
            Show
          </Button>
        </span>
        <PrintButton />
      </form>

      <article className="mx-auto max-w-4xl space-y-7 rounded-[var(--radius-card)] border border-line bg-card p-6 shadow-[var(--shadow-card)] sm:p-10 print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <header className="space-y-1 border-b-2 border-brand-blue pb-5">
          <p className="text-xs font-semibold tracking-wide text-brand-orange-ink uppercase">Respiratory Care report</p>
          <h1 className="text-2xl font-semibold text-ink">
            {ctx.hospital.name} · {specLabel(spec)}
          </h1>
          <p className="text-xs text-muted">
            {dateFormat.format(new Date())} · Prepared by {ctx.user.fullName} · {statuses.length ? statuses.join(" · ") : "No operating period in this span"}
          </p>
        </header>

        <section aria-labelledby="key-figures" className="space-y-3">
          <h2 id="key-figures" className="text-base font-semibold">Key figures</h2>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className={th} scope="col">Figure</th>
                  <th className={thR} scope="col">{specLabel(spec)}</th>
                  <th className={thR} scope="col">vs {specLabel(prevSpec)}</th>
                  <th className={th} scope="col">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {key.map((k) => (
                  <tr key={k.label} className="align-top">
                    <th scope="row" className="py-2 pr-3 text-left">
                      <span className="font-medium text-ink">{k.label}</span>
                      <span className="block text-xs font-normal text-muted">{k.note}</span>
                    </th>
                    <td className="py-2 pr-3 text-right"><FigureValue figure={k.f} /></td>
                    <td className="py-2 pr-3 text-right"><Delta change={change(k.p.value, k.f.value)} higherIsBetter={k.better} /></td>
                    <td className="py-2"><FigureStatusBadge figure={k.f} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="services" className="space-y-3">
          <h2 id="services" className="text-base font-semibold">Services</h2>
          {s.services.length === 0 ? (
            <p className="text-sm text-muted">No priced services with activity in this span.</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="border-b border-line">
                  <tr>
                    <th className={th} scope="col">Service</th>
                    <th className={th} scope="col">Price ({monthLabel(lastMonth, "short")})</th>
                    <th className={thR} scope="col">Volume</th>
                    <th className={thR} scope="col">Revenue</th>
                    <th className={thR} scope="col">Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {s.services.map((x) => {
                    const v = versionFor(versionsOf(detail.config.priceVersions, "hospitalServiceId", x.hospitalServiceId), lastMonth);
                    return (
                      <tr key={x.hospitalServiceId}>
                        <td className="py-1.5 pr-3 font-medium">{x.name}</td>
                        <td className="figure py-1.5 pr-3 text-xs">{v ? formatPrice(v.amount, v.currency, v.billingUnit) : "—"}</td>
                        <td className="figure py-1.5 pr-3 text-right">
                          <Num value={x.volume} /> <span className="text-xs text-muted">{volumeUnit(x.billingUnit)}</span>
                        </td>
                        <td className="figure py-1.5 pr-3 text-right"><Money value={x.revenue.value} /></td>
                        <td className="figure py-1.5 pr-3 text-right"><Money value={x.contribution} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid gap-7 sm:grid-cols-2">
          <section aria-labelledby="costs" className="space-y-2">
            <h2 id="costs" className="text-base font-semibold">Operating cost by category</h2>
            {Object.keys(s.costsByCategory).length === 0 ? (
              <p className="text-sm text-caution">No operating cost recorded — net value cannot be shown.</p>
            ) : (
              <dl className="space-y-1 text-sm">
                {(Object.entries(s.costsByCategory) as [CostCategory, number][]).map(([c, v]) => (
                  <div key={c} className="flex justify-between gap-3 border-b border-line py-1">
                    <dt className="text-muted">{COST_CATEGORIES[c]}</dt>
                    <dd className="figure">{formatEgp(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
          <section aria-labelledby="kpis" className="space-y-2">
            <h2 id="kpis" className="text-base font-semibold">Operations</h2>
            <dl className="space-y-1 text-sm">
              {[
                ["Beds (total)", s.kpis.beds === null ? "Unknown" : formatNumber(s.kpis.beds)],
                ["RT-covered beds", s.kpis.coveredBeds === null ? "Unknown" : formatNumber(s.kpis.coveredBeds)],
                ["Occupancy", s.kpis.occupancy === null ? "Needs bed-days" : `${formatPercent(s.kpis.occupancy)} of ${s.kpis.occupancyBeds} beds`],
                ["Patients", s.stats.patients === null ? "—" : formatNumber(s.stats.patients)],
                ["Ventilator days", s.stats.ventilatorDays === null ? "—" : formatNumber(s.stats.ventilatorDays)],
                ["Revenue per RT-covered bed", s.kpis.revenuePerBed === null ? "—" : formatEgp(s.kpis.revenuePerBed)],
                ["Cost per patient", s.kpis.costPerPatient === null ? "—" : formatEgp(s.kpis.costPerPatient)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-3 border-b border-line py-1">
                  <dt className="text-muted">{l}</dt>
                  <dd className="figure">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {s.departments.length ? (
          <section aria-labelledby="departments" className="space-y-2">
            <h2 id="departments" className="text-base font-semibold">Departments</h2>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead className="border-b border-line">
                  <tr>
                    <th className={th} scope="col">Department</th>
                    <th className={thR} scope="col">Beds</th>
                    <th className={thR} scope="col">Volume</th>
                    <th className={thR} scope="col">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {s.departments.map((d) => (
                    <tr key={d.departmentId}>
                      <td className="py-1.5 pr-3">{d.name}</td>
                      <td className="figure py-1.5 pr-3 text-right"><Num value={d.beds} /></td>
                      <td className="figure py-1.5 pr-3 text-right"><Num value={d.volume} /></td>
                      <td className="figure py-1.5 pr-3 text-right"><Money value={d.revenue} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {prevHasData ? (
          <section aria-labelledby="drivers" className="space-y-2">
            <h2 id="drivers" className="text-base font-semibold">
              What changed since {specLabel(prevSpec)}
            </h2>
            <VarianceView variance={explainVariance(prev, s)} />
          </section>
        ) : null}

        {s.issues.length ? (
          <section aria-labelledby="completeness" className="space-y-2">
            <h2 id="completeness" className="text-base font-semibold">Data still required</h2>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-soft">
              {s.issues.slice(0, 12).map((i) => (
                <li key={i.message}>{i.message}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="space-y-1 border-t border-line pt-4 text-xs text-muted">
          <p>Each month is calculated with the prices and costs in force that month; later price changes never alter earlier months.</p>
          <p>Gross revenue is not profit. Net value requires hospital cost data. Prices are this hospital&apos;s commercial terms, not reimbursement rates.</p>
          <p>Finalized and locked months can only be corrected by an Admin with a recorded reason (see the audit log).</p>
        </footer>
      </article>
    </>
  );
}
