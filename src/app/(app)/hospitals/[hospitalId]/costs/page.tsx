import type { Metadata } from "next";
import Link from "next/link";
import { COST_CATEGORIES, monthLabel, type CostCategory } from "@/domain/hospital";
import { Money } from "@/components/hospital/figures";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireHospital } from "@/server/hospitals/access";
import { loadAnalytics } from "@/server/hospitals/load";
import { CostSection } from "../_sections/cost-section";

export const metadata: Metadata = { title: "Costs" };

export default async function CostsPage({ params }: PageProps<"/hospitals/[hospitalId]/costs">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId);
  const { monthly } = await loadAnalytics(hospitalId);
  const latest = monthly.at(-1);
  return (
    <>
      <PageHeader
        title="Costs"
        description="Consumables, equipment, maintenance, contracts and other recurring costs. Every cost is versioned by month: a new cost applies from its month on, and earlier months keep theirs."
      />
      <div className="space-y-6">
        {latest ? (
          <Card>
            <CardHeader>
              <CardTitle>Operating cost by category · {monthLabel(latest.months[0])}</CardTitle>
              <CardDescription>
                Including <Link href={`/hospitals/${hospitalId}/staffing`} className="text-brand-blue-700 hover:underline">staffing</Link> and{" "}
                <Link href={`/hospitals/${hospitalId}/equipment`} className="text-brand-blue-700 hover:underline">equipment</Link>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(latest.costsByCategory).length === 0 ? (
                <p className="text-sm text-caution">No operating cost recorded for this month yet.</p>
              ) : (
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  {(Object.entries(latest.costsByCategory) as [CostCategory, number][]).map(([cat, v]) => (
                    <div key={cat} className="flex justify-between gap-3 border-b border-line py-1.5">
                      <dt className="text-muted">{COST_CATEGORIES[cat]}</dt>
                      <dd className="font-medium"><Money value={v} /></dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Cost items</CardTitle>
            <CardDescription>Open an item to see its cost history, add a new cost from a month, or end it.</CardDescription>
          </CardHeader>
          <CardContent>
            <CostSection ctx={ctx} variant="costs" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
