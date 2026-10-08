import type { Metadata } from "next";
import {
  addMonths,
  compareDepartments,
  compareServices,
  compareSummaries,
  currentMonth,
  daysInMonth,
  explainVariance,
  monthLabel,
  parseSpec,
  priorYear,
  quartersOf,
  specLabel,
  specMonths,
  specToString,
  summarizeSpec,
  yearsOf,
  type PeriodSpec,
} from "@/domain/hospital";
import { MetricTable, ModeTabs, VarianceView } from "@/components/hospital/comparison";
import { PageHeader } from "@/components/layout/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { requireHospital } from "@/server/hospitals/access";
import { loadAnalytics } from "@/server/hospitals/load";

export const metadata: Metadata = { title: "Comparisons" };

const MODES = [
  { id: "month", label: "Month vs month" },
  { id: "months", label: "Selected months" },
  { id: "quarter", label: "Quarter vs quarter" },
  { id: "year", label: "Year vs year" },
  { id: "ytd", label: "Year to date" },
  { id: "department", label: "Department vs department" },
  { id: "service", label: "Service vs service" },
] as const;
type Mode = (typeof MODES)[number]["id"];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

function SpecSelect({ name, label, value, options }: { name: string; label: string; value: string; options: readonly { value: string; label: string }[] }) {
  return (
    <div className="space-y-1.5 text-sm font-medium">
      <label htmlFor={`cmp-${name}`} className="block">
        {label}
      </label>
      <Select id={`cmp-${name}`} name={name} defaultValue={value} className="w-52">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export default async function ComparisonsPage({ params, searchParams }: PageProps<"/hospitals/[hospitalId]/comparisons">) {
  const { hospitalId } = await params;
  const sp = await searchParams;
  const ctx = await requireHospital(hospitalId);
  const { detail, periods, monthly } = await loadAnalytics(hospitalId);
  const config = detail.config;
  const months = periods.map((p) => p.input.month).sort().reverse();
  const latest = months[0] ?? currentMonth();
  const mode: Mode = MODES.some((m) => m.id === one(sp.mode)) ? (one(sp.mode) as Mode) : "month";
  const base = `/hospitals/${hospitalId}/comparisons`;

  const monthOptions = months.map((m) => ({ value: m, label: monthLabel(m) }));
  const quarterOptions = quartersOf(months).map((q) => ({ value: q, label: specLabel(parseSpec(q)!) }));
  const yearOptions = yearsOf(months).map((y) => ({ value: y, label: y }));
  const spanOptions = [...monthOptions, ...quarterOptions, ...yearOptions];

  let a: PeriodSpec | null = null;
  let b: PeriodSpec | null = null;
  if (mode === "month") {
    b = parseSpec(one(sp.b)) ?? { kind: "month", month: latest };
    a = parseSpec(one(sp.a)) ?? { kind: "month", month: addMonths(b.kind === "month" ? b.month : latest, -1) };
  } else if (mode === "months") {
    const am = many(sp.am).filter((m) => months.includes(m));
    const bm = many(sp.bm).filter((m) => months.includes(m));
    a = am.length ? (am.length === 1 ? { kind: "month", month: am[0] } : { kind: "months", months: am.sort() }) : null;
    b = bm.length ? (bm.length === 1 ? { kind: "month", month: bm[0] } : { kind: "months", months: bm.sort() }) : null;
  } else if (mode === "quarter") {
    b = parseSpec(one(sp.b)) ?? parseSpec(quarterOptions[0]?.value) ?? null;
    a = parseSpec(one(sp.a)) ?? parseSpec(quarterOptions[1]?.value) ?? null;
  } else if (mode === "year") {
    b = parseSpec(one(sp.b)) ?? parseSpec(yearOptions[0]?.value) ?? null;
    a = parseSpec(one(sp.a)) ?? (b ? priorYear(b) : null);
  } else if (mode === "ytd") {
    const m = one(sp.a) ?? latest;
    b = parseSpec(`ytd:${m}`);
    a = b ? priorYear(b) : null;
  }
  const span = parseSpec(one(sp.p)) ?? { kind: "month", month: latest };

  const summaryA = a ? summarizeSpec(config, monthly, a) : null;
  const summaryB = b ? summarizeSpec(config, monthly, b) : null;

  // Department / service modes compare within one span.
  const spanSummary = summarizeSpec(config, monthly, span);
  const spanDays = specMonths(span).reduce((s, m) => s + daysInMonth(m), 0);
  const departments = detail.departments;
  const da = one(sp.da) ?? departments[0]?.id;
  const db = one(sp.db) ?? departments[1]?.id ?? departments[0]?.id;
  const services = detail.services;
  const sa = one(sp.sa) ?? services[0]?.id;
  const sb = one(sp.sb) ?? services[1]?.id ?? services[0]?.id;

  const emptyDept = (id: string | undefined) => {
    const d = departments.find((x) => x.id === id);
    return d ? { departmentId: d.id, name: d.name, beds: d.beds, volume: null, revenue: null, stats: { patients: null, admissions: null, occupiedBedDays: null, ventilatorDays: null } } : null;
  };
  const deptA = spanSummary.departments.find((d) => d.departmentId === da) ?? emptyDept(da);
  const deptB = spanSummary.departments.find((d) => d.departmentId === db) ?? emptyDept(db);
  const svcA = spanSummary.services.find((s) => s.hospitalServiceId === sa);
  const svcB = spanSummary.services.find((s) => s.hospitalServiceId === sb);
  const serviceName = (id: string | undefined) => services.find((s) => s.id === id)?.name ?? "Service";

  return (
    <>
      <PageHeader
        title="Comparisons"
        description={`Compare ${ctx.hospital.name} across months, quarters and years, or departments and services side by side — and see what drove the difference.`}
      />
      <ModeTabs modes={MODES} current={mode} href={(id) => `${base}?mode=${id}`} />

      {months.length === 0 ? (
        <Alert tone="info" title="No monthly periods yet">Create periods and enter activity to compare them.</Alert>
      ) : (
        <div className="space-y-6">
          <Card className="no-print">
            <CardContent className="pt-5">
              <form action={base} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="mode" value={mode} />
                {mode === "month" ? (
                  <>
                    <SpecSelect name="a" label="Compare" value={a ? specToString(a) : ""} options={monthOptions} />
                    <SpecSelect name="b" label="With" value={b ? specToString(b) : ""} options={monthOptions} />
                  </>
                ) : null}
                {mode === "quarter" ? (
                  <>
                    <SpecSelect name="a" label="Compare" value={a ? specToString(a) : ""} options={quarterOptions} />
                    <SpecSelect name="b" label="With" value={b ? specToString(b) : ""} options={quarterOptions} />
                  </>
                ) : null}
                {mode === "year" ? (
                  <>
                    <SpecSelect name="a" label="Compare" value={a ? specToString(a) : ""} options={[...yearOptions, ...(a && !yearOptions.some((y) => y.value === specToString(a!)) ? [{ value: specToString(a), label: specLabel(a) }] : [])]} />
                    <SpecSelect name="b" label="With" value={b ? specToString(b) : ""} options={yearOptions} />
                  </>
                ) : null}
                {mode === "ytd" ? <SpecSelect name="a" label="Year to date through" value={b?.kind === "ytd" ? b.month : latest} options={monthOptions} /> : null}
                {mode === "months" ? (
                  <div className="grid w-full gap-4 sm:grid-cols-2">
                    {(["am", "bm"] as const).map((name, i) => (
                      <fieldset key={name} className="space-y-1.5">
                        <legend className="text-sm font-medium">{i === 0 ? "Months A" : "Months B"}</legend>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {months
                            .slice()
                            .reverse()
                            .map((m) => (
                              <label key={m} className="inline-flex items-center gap-2 text-sm">
                                <input type="checkbox" name={name} value={m} defaultChecked={many(sp[name]).includes(m)} className="size-4 accent-brand-blue" />
                                {monthLabel(m, "short")}
                              </label>
                            ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                ) : null}
                {mode === "department" || mode === "service" ? (
                  <SpecSelect name="p" label="Period" value={specToString(span)} options={spanOptions} />
                ) : null}
                {mode === "department" ? (
                  <>
                    <SpecSelect name="da" label="Department A" value={da ?? ""} options={departments.map((d) => ({ value: d.id, label: d.name }))} />
                    <SpecSelect name="db" label="Department B" value={db ?? ""} options={departments.map((d) => ({ value: d.id, label: d.name }))} />
                  </>
                ) : null}
                {mode === "service" ? (
                  <>
                    <SpecSelect name="sa" label="Service A" value={sa ?? ""} options={services.map((s) => ({ value: s.id, label: s.name }))} />
                    <SpecSelect name="sb" label="Service B" value={sb ?? ""} options={services.map((s) => ({ value: s.id, label: s.name }))} />
                  </>
                ) : null}
                <Button type="submit">Compare</Button>
              </form>
            </CardContent>
          </Card>

          {["month", "months", "quarter", "year", "ytd"].includes(mode) ? (
            summaryA && summaryB ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {summaryA.label} vs {summaryB.label}
                    </CardTitle>
                    <CardDescription>Each month uses its own prices and costs. Spans with missing months are marked as partial.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MetricTable aLabel={summaryA.label} bLabel={summaryB.label} rows={compareSummaries(summaryA, summaryB)} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Why {summaryB.label} differs from {summaryA.label}
                    </CardTitle>
                    <CardDescription>
                      Revenue change split into volume effect (Δvolume × earlier price) and price effect (Δprice × later volume); costs into quantity and unit-cost effects.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <VarianceView variance={explainVariance(summaryA, summaryB)} />
                  </CardContent>
                </Card>
              </>
            ) : (
              <p className="text-sm text-muted">Choose what to compare.</p>
            )
          ) : null}

          {mode === "department" ? (
            deptA && deptB ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {deptA.name} vs {deptB.name} · {specLabel(span)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MetricTable aLabel={deptA.name} bLabel={deptB.name} rows={compareDepartments(deptA, deptB, spanDays)} />
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted">Add departments to compare them.</p>
            )
          ) : null}

          {mode === "service" ? (
            svcA && svcB ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {svcA.name} vs {svcB.name} · {specLabel(span)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MetricTable aLabel={svcA.name} bLabel={svcB.name} rows={compareServices(svcA, svcB)} />
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted">
                {!svcA ? serviceName(sa) : serviceName(sb)} has no price or activity in {specLabel(span)}.
              </p>
            )
          ) : null}
        </div>
      )}
    </>
  );
}
