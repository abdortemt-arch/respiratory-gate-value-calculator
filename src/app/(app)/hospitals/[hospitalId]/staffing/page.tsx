import type { Metadata } from "next";
import { formatNumber } from "@/domain/format";
import { monthLabel } from "@/domain/hospital";
import { Money } from "@/components/hospital/figures";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireHospital } from "@/server/hospitals/access";
import { loadAnalytics } from "@/server/hospitals/load";
import { CostSection } from "../_sections/cost-section";

export const metadata: Metadata = { title: "Staffing" };

export default async function StaffingPage({ params }: PageProps<"/hospitals/[hospitalId]/staffing">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId);
  const { monthly } = await loadAnalytics(hospitalId);
  const latest = monthly.at(-1);
  const staffLines = latest?.costLines.filter((c) => c.category === "staffing") ?? [];
  return (
    <>
      <PageHeader
        title="Staffing"
        description="Roles with their monthly cost per FTE (salary and on-costs), versioned by month. FTE counts are entered in each monthly period."
      />
      <div className="space-y-6">
        {latest && staffLines.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Staffing · {monthLabel(latest.months[0])}</CardTitle>
              <CardDescription>
                {latest.kpis.rtFte !== null ? `${formatNumber(latest.kpis.rtFte)} respiratory therapist FTE · ` : ""}
                Revenue per RT: <Money value={latest.kpis.revenuePerRt} />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-line text-sm">
                {staffLines.map((l) => (
                  <li key={l.costItemId} className="flex justify-between gap-3 py-2">
                    <span>
                      <span className="font-medium text-ink">{l.name}</span>
                      <span className="block text-xs text-muted">{l.quantity === null ? "FTE not entered" : `${formatNumber(l.quantity)} FTE`}</span>
                    </span>
                    {l.amount.value === null ? <span className="text-caution">Data required</span> : <Money value={l.amount.value} />}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <CostSection ctx={ctx} variant="staffing" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
