import Link from "next/link";
import type { ReactNode } from "react";
import { formatEgp, formatNumber, formatPercent } from "@/domain/format";
import type { Driver, MetricRow, VarianceSummary } from "@/domain/hospital";
import { cn } from "@/lib/cn";
import { Delta, TableWrap } from "./figures";

function fmt(row: MetricRow, v: number | null): ReactNode {
  if (v === null) return <span className="text-muted">—</span>;
  if (row.format === "money") return formatEgp(v);
  if (row.format === "percent") return formatPercent(v);
  return formatNumber(v);
}

/** A vs B, change and growth for each metric. "—" means the data is not available, never zero. */
export function MetricTable({ aLabel, bLabel, rows }: { aLabel: string; bLabel: string; rows: readonly MetricRow[] }) {
  return (
    <TableWrap>
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="py-2 pr-3 font-medium">Metric</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">{aLabel}</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">{bLabel}</th>
            <th scope="col" className="py-2 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">{r.label}</th>
              <td className="figure py-2 pr-3 text-right">{fmt(r, r.a)}</td>
              <td className="figure py-2 pr-3 text-right">{fmt(r, r.b)}</td>
              <td className="py-2 text-right">
                <Delta change={r.change} pct={r.format === "percent" ? null : r.changePct} higherIsBetter={r.higherIsBetter} format={r.format} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function describe(d: Driver): string {
  const n = (v: number | null) => (v === null ? "—" : d.unit === "EGP" ? formatEgp(v) : `${formatNumber(v)} ${d.unit}`);
  switch (d.kind) {
    case "service_volume":
      return `${d.subject}: volume ${n(d.from)} → ${n(d.to)}`;
    case "service_price":
      return `${d.subject}: price ${n(d.from)} → ${n(d.to)}`;
    case "service_new":
      return `${d.subject}: new revenue`;
    case "service_stopped":
      return `${d.subject}: no revenue any more`;
    case "service_fixed":
      return `${d.subject}: revenue ${n(d.from)} → ${n(d.to)}`;
    case "cost_quantity":
      return `${d.subject}: quantity ${n(d.from)} → ${n(d.to)}`;
    case "cost_rate":
      return `${d.subject}: cost ${n(d.from)} → ${n(d.to)}`;
    case "cost_new":
      return `${d.subject}: new cost`;
    case "cost_stopped":
      return `${d.subject}: cost ended`;
    case "savings":
      return `${d.subject} savings ${n(d.from)} → ${n(d.to)}`;
  }
}

const KIND_LABEL: Record<Driver["kind"], string> = {
  service_volume: "Volume",
  service_price: "Price",
  service_new: "New service",
  service_stopped: "Stopped",
  service_fixed: "Revenue",
  cost_quantity: "Quantity",
  cost_rate: "Unit cost",
  cost_new: "New cost",
  cost_stopped: "Cost ended",
  savings: "Savings",
};

/** Why B differs from A: each driver's effect on net value, largest first; effects add up to the change. */
export function VarianceView({ variance, link }: { variance: VarianceSummary; link?: (d: Driver) => string | null }) {
  const sum = (kinds: Driver["kind"][]) => variance.drivers.filter((d) => kinds.includes(d.kind)).reduce((s, d) => s + d.effect, 0);
  const volume = sum(["service_volume", "service_new", "service_stopped"]);
  const price = sum(["service_price"]);
  const fixed = sum(["service_fixed"]);
  return (
    <div className="space-y-4">
      {variance.revenueChange !== null ? (
        <p className="figure rounded-xl bg-surface px-3 py-2 text-sm text-ink-soft">
          Revenue change <strong className="text-ink">{variance.revenueChange >= 0 ? "+" : "−"}{formatEgp(Math.abs(variance.revenueChange))}</strong>
          {" = "}volume effect {volume >= 0 ? "+" : "−"}{formatEgp(Math.abs(volume))}
          {" + "}price effect {price >= 0 ? "+" : "−"}{formatEgp(Math.abs(price))}
          {fixed ? <> + other {fixed >= 0 ? "+" : "−"}{formatEgp(Math.abs(fixed))}</> : null}
        </p>
      ) : null}
      {variance.drivers.length === 0 ? (
        <p className="text-sm text-muted">No differences to explain between {variance.fromLabel} and {variance.toLabel}.</p>
      ) : (
        <ol className="divide-y divide-line rounded-xl border border-line text-sm">
          {variance.drivers.map((d, i) => {
            const href = link?.(d) ?? null;
            return (
              <li key={`${d.kind}-${d.subject}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="mr-2 inline-block rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-soft">{KIND_LABEL[d.kind]}</span>
                  {href ? (
                    <Link href={href} className="font-medium text-ink hover:underline">
                      {describe(d)}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink">{describe(d)}</span>
                  )}
                </span>
                <span className={cn("figure shrink-0 font-semibold", d.effect >= 0 ? "text-positive" : "text-caution")}>
                  {d.effect >= 0 ? "+" : "−"}
                  {formatEgp(Math.abs(d.effect))}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {variance.netChange !== null ? (
        <p className="figure text-sm text-ink-soft">
          Net value change: <strong className="text-ink">{variance.netChange >= 0 ? "+" : "−"}{formatEgp(Math.abs(variance.netChange))}</strong>
        </p>
      ) : (
        <p className="text-sm text-muted">Net value change needs operating cost data in both periods.</p>
      )}
      {variance.unexplained.length ? (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-caution">
          {variance.unexplained.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Tabs implemented as links (works without JavaScript). */
export function ModeTabs({ modes, current, href }: { modes: readonly { id: string; label: string }[]; current: string; href: (id: string) => string }) {
  return (
    <nav aria-label="Comparison type" className="no-print mb-5 flex flex-wrap gap-2 text-sm">
      {modes.map((m) => (
        <Link
          key={m.id}
          href={href(m.id)}
          aria-current={m.id === current ? "page" : undefined}
          className={cn(
            "rounded-full border px-3 py-1 font-medium",
            m.id === current ? "border-brand-orange bg-brand-orange-50 text-brand-orange-ink" : "border-line bg-card text-ink-soft hover:border-brand-blue",
          )}
        >
          {m.label}
        </Link>
      ))}
    </nav>
  );
}
