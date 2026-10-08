import type { Metadata } from "next";
import { currentMonth, describePriceVersion, monthLabel, timeline, versionFor, versionsOf } from "@/domain/hospital";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireHospital } from "@/server/hospitals/access";
import { loadDetail } from "@/server/hospitals/load";
import { PriceFormSection, PricingHistorySection } from "../_sections/config-sections";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage({ params }: PageProps<"/hospitals/[hospitalId]/pricing">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId);
  const detail = await loadDetail(hospitalId);
  const today = currentMonth();
  const services = detail.services.filter((s) => s.active || detail.config.priceVersions.some((v) => v.hospitalServiceId === s.id));

  return (
    <>
      <PageHeader
        title="Pricing"
        description={`${ctx.hospital.name}'s own prices. Every price has an effective month; adding a new price never changes months that came before it.`}
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Current prices · {monthLabel(today)}</CardTitle>
            <CardDescription>The price in force this month, the one before it and any scheduled change.</CardDescription>
          </CardHeader>
          <CardContent>
            {services.length === 0 ? (
              <p className="text-sm text-muted">Add services first.</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th scope="col" className="py-2 pr-3 font-medium">Service</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Current price</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Previous price</th>
                      <th scope="col" className="py-2 font-medium">Scheduled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {services.map((s) => {
                      const entries = timeline(versionsOf(detail.config.priceVersions, "hospitalServiceId", s.id));
                      const current = versionFor(versionsOf(detail.config.priceVersions, "hospitalServiceId", s.id), today);
                      const idx = current ? entries.findIndex((e) => e.version.id === current.id) : -1;
                      const previous = idx >= 0 ? entries[idx + 1]?.version : undefined;
                      const scheduled = entries.filter((e) => e.from > today).at(-1)?.version;
                      return (
                        <tr key={s.id}>
                          <td className="py-2.5 pr-3 font-medium text-ink">
                            {s.name} {s.active ? null : <Badge tone="neutral">Inactive</Badge>}
                          </td>
                          <td className="figure py-2.5 pr-3">{current ? describePriceVersion(current) : <span className="text-caution">No price in force</span>}</td>
                          <td className="figure py-2.5 pr-3 text-ink-soft">{previous ? describePriceVersion(previous) : "—"}</td>
                          <td className="figure py-2.5 text-ink-soft">{scheduled ? describePriceVersion(scheduled) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a price</CardTitle>
            <CardDescription>Use a new price for a change from a month on. Void a price only when it was entered by mistake.</CardDescription>
          </CardHeader>
          <CardContent>
            <PriceFormSection ctx={ctx} />
          </CardContent>
        </Card>

        <Card id="history">
          <CardHeader>
            <CardTitle>Pricing history</CardTitle>
            <CardDescription>All versions per service, newest first, including voided entries and their reasons.</CardDescription>
          </CardHeader>
          <CardContent>
            <PricingHistorySection ctx={ctx} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
