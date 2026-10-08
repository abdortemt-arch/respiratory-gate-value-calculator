import { formatPrice, monthLabel, timeline, versionsOf, type Month, type PriceVersion } from "@/domain/hospital";
import { Badge } from "@/components/ui/badge";
import type { Result } from "./forms";
import { VoidButton } from "./void-button";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Cairo" });

function status(from: Month, to: Month | null, today: Month): { label: string; tone: "orange" | "blue" | "neutral" } {
  if (from > today) return { label: "Scheduled", tone: "blue" };
  if (to === null || to >= today) return { label: "Current", tone: "orange" };
  return { label: "Past", tone: "neutral" };
}

/**
 * Every price a service has had: effective period, amount and billing unit,
 * who entered it and why — including voided entries, which never disappear.
 */
export function PricingHistory({
  services,
  versions,
  today,
  voidAction,
}: {
  services: readonly { id: string; name: string }[];
  versions: readonly PriceVersion[];
  today: Month;
  /** Bound per version by the page; omitted for read-only users. */
  voidAction?: (versionId: string, reason: string) => Promise<Result>;
}) {
  const withVersions = services.filter((s) => versions.some((v) => v.hospitalServiceId === s.id));
  if (withVersions.length === 0) return <p className="text-sm text-muted">No prices recorded yet.</p>;
  return (
    <div className="space-y-6">
      {withVersions.map((s) => {
        const own = versionsOf(versions, "hospitalServiceId", s.id);
        const entries = timeline(own);
        const voided = own.filter((v) => v.voided);
        return (
          <section key={s.id} aria-labelledby={`history-${s.id}`}>
            <h3 id={`history-${s.id}`} className="mb-2 text-sm font-semibold text-ink">
              {s.name}
            </h3>
            <div className="relative overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="bg-surface/60">
                  <tr className="text-left text-xs text-muted">
                    <th scope="col" className="px-3 py-2 font-medium">Effective</th>
                    <th scope="col" className="px-3 py-2 font-medium">Price</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 font-medium">Notes</th>
                    <th scope="col" className="px-3 py-2 font-medium">Entered</th>
                    <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {entries.map(({ version: v, from, to }) => {
                    const st = status(from, to, today);
                    return (
                      <tr key={v.id} className="align-top">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {monthLabel(from, "short")} – {to ? monthLabel(to, "short") : "onwards"}
                        </td>
                        <td className="figure px-3 py-2 font-medium whitespace-nowrap text-ink">{formatPrice(v.amount, v.currency, v.billingUnit)}</td>
                        <td className="px-3 py-2"><Badge tone={st.tone}>{st.label}</Badge></td>
                        <td className="px-3 py-2 text-xs text-ink-soft">
                          {v.notes}
                          {v.changeReason ? <span className="block text-caution">Correction: {v.changeReason}</span> : null}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap text-muted">
                          {v.createdByName ?? "System"}
                          {v.createdAt ? <span className="block">{dateFormat.format(new Date(v.createdAt))}</span> : null}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {voidAction ? <VoidButton label={`${s.name} price from ${monthLabel(from, "short")}`} action={voidAction.bind(null, v.id)} /> : null}
                        </td>
                      </tr>
                    );
                  })}
                  {voided.map((v) => (
                    <tr key={v.id} className="align-top text-muted">
                      <td className="px-3 py-2 whitespace-nowrap line-through">{monthLabel(v.effectiveFrom, "short")}</td>
                      <td className="figure px-3 py-2 whitespace-nowrap line-through">{formatPrice(v.amount, v.currency, v.billingUnit)}</td>
                      <td className="px-3 py-2"><Badge tone="neutral">Voided</Badge></td>
                      <td className="px-3 py-2 text-xs">Reason: {v.voidReason}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        Voided by {v.voidedByName ?? "System"}
                        {v.voidedAt ? <span className="block">{dateFormat.format(new Date(v.voidedAt))}</span> : null}
                      </td>
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
