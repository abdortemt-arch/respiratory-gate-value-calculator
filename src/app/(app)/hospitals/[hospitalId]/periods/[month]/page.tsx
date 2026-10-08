import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, GitCompareArrows } from "lucide-react";
import {
  addMonths,
  COST_BASES,
  COST_CATEGORIES,
  costItemApplies,
  formatPrice,
  isMonth,
  monthLabel,
  PERIOD_STATUSES,
  versionFor,
  versionsOf,
  volumeUnit,
} from "@/domain/hospital";
import { formatEgp, formatMoney } from "@/domain/format";
import { Delta, FigureCard, Money } from "@/components/hospital/figures";
import {
  ActivityEditor,
  CostQuantityEditor,
  CreatePeriodForm,
  PeriodStatusControls,
  SavingsEditor,
  StatsEditor,
  type ActivitySlot,
} from "@/components/hospital/period-editors";
import { PageHeader } from "@/components/layout/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canInHospital, requireHospital } from "@/server/hospitals/access";
import { loadAnalytics, loadPeopleCached } from "@/server/hospitals/load";
import {
  addSavings,
  createPeriod,
  removeSavings,
  saveActivity,
  saveCostQuantities,
  saveStats,
  setPeriodStatus,
} from "../../../_actions/periods";

export const metadata: Metadata = { title: "Monthly period" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" });

export default async function PeriodPage({ params }: PageProps<"/hospitals/[hospitalId]/periods/[month]">) {
  const { hospitalId, month } = await params;
  if (!isMonth(month)) notFound();
  const ctx = await requireHospital(hospitalId);
  const [{ detail, periods, monthly }, people] = await Promise.all([loadAnalytics(hospitalId), loadPeopleCached()]);
  const record = periods.find((p) => p.input.month === month);
  const canEnter = canInHospital(ctx, "enter_period_data");
  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const nav = (
    <span className="flex gap-2">
      <Link href={`/hospitals/${hospitalId}/periods/${prevMonth}`} className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-card px-3 text-sm hover:bg-surface">
        <ArrowLeft aria-hidden className="size-4" /> {monthLabel(prevMonth, "short")}
      </Link>
      <Link href={`/hospitals/${hospitalId}/periods/${nextMonth}`} className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-card px-3 text-sm hover:bg-surface">
        {monthLabel(nextMonth, "short")} <ArrowRight aria-hidden className="size-4" />
      </Link>
    </span>
  );

  if (!record) {
    return (
      <>
        <PageHeader title={monthLabel(month)} description={`${ctx.hospital.name} has no operating period for this month.`} actions={nav} />
        <Card>
          <CardContent className="pt-5">
            {canEnter ? (
              <CreatePeriodForm hospitalId={hospitalId} defaultMonth={month} create={createPeriod.bind(null, hospitalId)} />
            ) : (
              <p className="text-sm text-muted">No data was recorded for {monthLabel(month)}.</p>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  const period = record.input;
  const summary = monthly.find((m) => m.months[0] === month)!;
  const previous = monthly.find((m) => m.months[0] === prevMonth) ?? null;
  const closed = period.status === "finalized" || period.status === "locked";
  const editable = canEnter && (!closed || ctx.role === "admin");
  const correction = closed && ctx.role === "admin";
  const config = detail.config;

  // Activity slots: each active service in each department that provides it (or the whole hospital).
  const deptName = new Map(detail.departments.map((d) => [d.id, d.name]));
  const slots: ActivitySlot[] = [];
  for (const s of detail.services) {
    const entered = period.activity.filter((a) => a.hospitalServiceId === s.id);
    if (!s.active && entered.length === 0) continue;
    const departmentIds = new Set<string | null>(s.departmentIds);
    for (const a of entered) departmentIds.add(a.departmentId);
    if (departmentIds.size === 0) departmentIds.add(null);
    const price = versionFor(versionsOf(config.priceVersions, "hospitalServiceId", s.id), month);
    const svcSummary = summary.services.find((x) => x.hospitalServiceId === s.id);
    for (const d of departmentIds) {
      const slice = svcSummary?.byDepartment.find((b) => b.departmentId === d);
      slots.push({
        hospitalServiceId: s.id,
        departmentId: d,
        serviceName: s.name,
        departmentName: d ? (deptName.get(d) ?? "Department") : "Whole hospital",
        price: price ? formatPrice(price.amount, price.currency, price.billingUnit) : null,
        volumeUnit: volumeUnit(price?.billingUnit ?? null),
        quantity: entered.find((a) => a.departmentId === d)?.quantity ?? null,
        revenue: slice?.revenue ?? null,
      });
    }
  }

  const statsDepartments = detail.departments.filter((d) => d.active || period.stats.some((s) => s.departmentId === d.id));
  const statsRows = [null, ...statsDepartments.map((d) => d.id)].map((id) => {
    const e = period.stats.find((s) => s.departmentId === id);
    return {
      departmentId: id,
      name: id ? (deptName.get(id) ?? "Department") : "Whole hospital",
      patients: e?.patients ?? null,
      admissions: e?.admissions ?? null,
      occupiedBedDays: e?.occupiedBedDays ?? null,
      ventilatorDays: e?.ventilatorDays ?? null,
    };
  });

  const costRows = detail.costItems
    .filter((c) => c.basis === "per_unit")
    .filter((c) => {
      const v = versionFor(versionsOf(config.costVersions, "costItemId", c.id), month);
      return costItemApplies(c, v !== null, month) || period.costEntries.some((e) => e.costItemId === c.id);
    })
    .map((c) => {
      const v = versionFor(versionsOf(config.costVersions, "costItemId", c.id), month);
      return {
        costItemId: c.id,
        name: c.name,
        category: COST_CATEGORIES[c.category],
        unitCost: v ? formatMoney(v.amount, ctx.hospital.currency) : null,
        unitLabel: c.unitLabel,
        quantity: period.costEntries.find((e) => e.costItemId === c.id)?.quantity ?? null,
        amount: summary.costLines.find((l) => l.costItemId === c.id)?.amount.value ?? null,
      };
    });
  const otherCosts = summary.costLines.filter((l) => l.basis !== "per_unit");
  const changedSinceFinalized =
    record.snapshot && typeof record.snapshot.revenue === "number" && summary.revenue.value !== null && record.snapshot.revenue !== summary.revenue.value;

  return (
    <>
      <PageHeader
        title={monthLabel(month)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={period.status === "draft" ? "neutral" : period.status === "in_review" ? "caution" : "blue"}>{PERIOD_STATUSES[period.status]}</Badge>
            <span>{ctx.hospital.name} · monthly operating period</span>
          </span>
        }
        actions={nav}
      />

      <div className="space-y-6">
        <section aria-label="Results" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FigureCard
            title="Revenue"
            figure={summary.revenue}
            accent="blue"
            basis="Σ volume × price in force this month"
            footer={<Delta change={previous && previous.revenue.value !== null && summary.revenue.value !== null ? summary.revenue.value - previous.revenue.value : null} suffix={`vs ${monthLabel(prevMonth, "short")}`} />}
          />
          <FigureCard
            title="Operating cost"
            figure={summary.costs}
            basis="Cost items at this month's versions"
            footer={<Delta change={previous && previous.costs.value !== null && summary.costs.value !== null ? summary.costs.value - previous.costs.value : null} higherIsBetter={false} suffix={`vs ${monthLabel(prevMonth, "short")}`} />}
          />
          <FigureCard title="Documented savings" figure={summary.savings} missingLabel="None recorded" basis="Recorded cost avoidance" status={summary.savings.status === "missing" ? <Badge tone="neutral">None recorded</Badge> : undefined} />
          <FigureCard
            title="Net service-line value"
            figure={summary.net}
            accent="orange"
            basis="Revenue − operating cost + savings"
            footer={<Delta change={previous && previous.net.value !== null && summary.net.value !== null ? summary.net.value - previous.net.value : null} suffix={`vs ${monthLabel(prevMonth, "short")}`} />}
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>
              Draft → In review → Finalized → Locked. Finalized and locked months are protected: only an Admin can correct them, with a reason that is kept in the audit log.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {record.finalizedAt ? (
              <p className="text-sm text-ink-soft">
                Finalized {dateFormat.format(new Date(record.finalizedAt))} by {record.finalizedBy ? (people[record.finalizedBy] ?? "Former user") : "System"}
                {record.lockedAt ? ` · locked ${dateFormat.format(new Date(record.lockedAt))} by ${record.lockedBy ? (people[record.lockedBy] ?? "Former user") : "System"}` : ""}
                {record.snapshot && typeof record.snapshot.revenue === "number" ? ` · revenue at finalization ${formatEgp(record.snapshot.revenue)}` : ""}
              </p>
            ) : null}
            {changedSinceFinalized ? (
              <Alert tone="caution" title="Corrected after finalization">
                Revenue now differs from the figure stored when this month was finalized. See the audit log for the correction and its reason.
              </Alert>
            ) : null}
            <PeriodStatusControls status={period.status} role={ctx.role} canWrite={ctx.canWrite} setStatus={setPeriodStatus.bind(null, hospitalId, period.id)} />
            {previous ? (
              <Link
                href={`/hospitals/${hospitalId}/comparisons?mode=month&a=${prevMonth}&b=${month}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue-700 hover:underline"
              >
                <GitCompareArrows aria-hidden className="size-4" /> Why did {monthLabel(month, "short")} differ from {monthLabel(prevMonth, "short")}?
              </Link>
            ) : null}
          </CardContent>
        </Card>

        {correction ? (
          <Alert tone="caution" title={`This month is ${PERIOD_STATUSES[period.status].toLowerCase()}`}>
            Changes here are historical corrections: each needs a reason and is recorded in the audit log with the previous and new value.
          </Alert>
        ) : null}
        {closed && !correction ? (
          <Alert tone="info" title={`This month is ${PERIOD_STATUSES[period.status].toLowerCase()}`}>
            Its figures are protected. Ask an Admin if a correction is needed.
          </Alert>
        ) : null}

        <Card id="activity">
          <CardHeader>
            <CardTitle>Service activity</CardTitle>
            <CardDescription>Volumes per service and department. Leave a cell blank when unknown — it is not counted as zero.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityEditor slots={slots} editable={editable} correction={correction} save={saveActivity.bind(null, hospitalId, period.id)} />
          </CardContent>
        </Card>

        <Card id="statistics">
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>
              Patients, admissions, occupied bed-days and ventilator days. A whole-hospital row overrides the department totals. Used for occupancy and cost per patient / ventilator day.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatsEditor rows={statsRows} editable={editable} correction={correction} save={saveStats.bind(null, hospitalId, period.id)} />
          </CardContent>
        </Card>

        <Card id="costs">
          <CardHeader>
            <CardTitle>Cost quantities</CardTitle>
            <CardDescription>Consumables used and staff (FTE) this month. Unit costs come from the cost versions in force this month.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CostQuantityEditor rows={costRows} editable={editable} correction={correction} save={saveCostQuantities.bind(null, hospitalId, period.id)} />
            {otherCosts.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Fixed and volume-linked costs this month</h3>
                <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                  {otherCosts.map((c) => (
                    <li key={c.costItemId} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>
                        <span className="font-medium text-ink">{c.name}</span>
                        <span className="block text-xs text-muted">
                          {COST_CATEGORIES[c.category]} · {COST_BASES[c.basis]}
                        </span>
                      </span>
                      {c.amount.value === null ? <span className="text-sm text-caution">Data required</span> : <Money value={c.amount.value} />}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card id="savings">
          <CardHeader>
            <CardTitle>Documented savings</CardTitle>
            <CardDescription>Realised cost avoidance this month. Kept separate from revenue; savings levers may overlap, so record each saving once.</CardDescription>
          </CardHeader>
          <CardContent>
            <SavingsEditor
              rows={period.savings}
              editable={editable}
              correction={correction}
              add={addSavings.bind(null, hospitalId, period.id)}
              remove={removeSavings.bind(null, hospitalId)}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
