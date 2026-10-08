import { formatEgp, formatEgpCompact } from "@/domain/format";
import { monthLabel, type Month } from "@/domain/hospital";
import { CHART } from "@/components/charts/chart-tokens";

export interface TrendPoint {
  readonly month: Month;
  readonly revenue: number | null;
  readonly costs: number | null;
  readonly net: number | null;
}

/** Monthly revenue and operating cost bars (plain HTML, with a data table for screen readers). */
export function TrendChart({ points, selected }: { points: readonly TrendPoint[]; selected?: Month }) {
  if (points.length === 0) return <p className="text-sm text-muted">No months recorded yet.</p>;
  const max = Math.max(1, ...points.flatMap((p) => [p.revenue ?? 0, p.costs ?? 0]));
  return (
    <figure className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-ink-soft" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: CHART.revenue }} /> Revenue</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: CHART.cost }} /> Operating cost</span>
      </div>
      <div className="relative overflow-x-auto" aria-hidden>
        <div className="flex h-44 min-w-max items-end gap-3 border-b border-line pb-px">
          {points.map((p) => (
            <div key={p.month} className="flex w-12 flex-col items-center gap-1">
              <div className="flex h-36 items-end gap-1">
                <div
                  className="w-4 rounded-t-sm"
                  style={{ height: `${((p.revenue ?? 0) / max) * 100}%`, background: CHART.revenue, opacity: selected && selected !== p.month ? 0.55 : 1 }}
                  title={p.revenue === null ? "Revenue: data required" : `Revenue ${formatEgp(p.revenue)}`}
                />
                <div
                  className="w-4 rounded-t-sm"
                  style={{ height: `${((p.costs ?? 0) / max) * 100}%`, background: CHART.cost, opacity: selected && selected !== p.month ? 0.55 : 1 }}
                  title={p.costs === null ? "Operating cost: data required" : `Operating cost ${formatEgp(p.costs)}`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex min-w-max gap-3 pt-1">
          {points.map((p) => (
            <span key={p.month} className={`w-12 text-center text-[11px] ${selected === p.month ? "font-semibold text-ink" : "text-muted"}`}>
              {monthLabel(p.month, "short").replace(" 20", " ’")}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Revenue and operating cost by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Revenue</th>
            <th scope="col">Operating cost</th>
            <th scope="col">Net value</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month}>
              <th scope="row">{monthLabel(p.month)}</th>
              <td>{p.revenue === null ? "Data required" : formatEgpCompact(p.revenue)}</td>
              <td>{p.costs === null ? "Data required" : formatEgpCompact(p.costs)}</td>
              <td>{p.net === null ? "Data required" : formatEgpCompact(p.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
