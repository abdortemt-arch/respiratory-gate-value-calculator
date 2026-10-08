import type { ValueBridge, BridgeStep } from "@/domain/calculations/valueBridge";
import { hasValue } from "@/domain/calculations/quantity";
import { formatEgp, formatEgpCompact } from "@/domain/format";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { CHART } from "./chart-tokens";

interface Row {
  readonly key: string;
  readonly label: string;
  readonly kind: "revenue" | "cost" | "cost_avoidance" | "subtotal" | "net" | "excluded" | "net-missing";
  readonly start: number;
  readonly end: number;
  readonly value: number;
  readonly partial?: boolean;
  readonly statusLabel?: string;
}

const COLOR: Record<string, string> = {
  revenue: CHART.revenue,
  subtotal: CHART.revenue,
  cost: CHART.cost,
  cost_avoidance: CHART.costAvoidance,
  net: CHART.net,
};

function buildRows(bridge: ValueBridge, showExcluded: boolean): Row[] {
  const rows: Row[] = [];
  let running = 0;
  const push = (s: BridgeStep, sign: 1 | -1) => {
    if (!hasValue(s.amount)) {
      if (showExcluded) rows.push({ key: s.id, label: s.label, kind: "excluded", start: 0, end: 0, value: 0, statusLabel: s.amount.label });
      return;
    }
    const start = running;
    running += sign * s.amount.value;
    rows.push({ key: s.id, label: s.label, kind: s.type, start, end: running, value: sign * s.amount.value, partial: s.amount.kind === "partial" });
  };

  bridge.steps.filter((s) => s.type === "revenue").forEach((s) => push(s, 1));
  rows.push({ key: "gross", label: "Gross revenue", kind: "subtotal", start: 0, end: running, value: running });
  const cost = bridge.steps.find((s) => s.type === "cost");
  if (cost) push(cost, -1);
  bridge.steps.filter((s) => s.type === "cost_avoidance").forEach((s) => push(s, 1));

  if (hasValue(bridge.net)) {
    rows.push({ key: "net", label: "Net respiratory service-line value", kind: "net", start: 0, end: bridge.net.value, value: bridge.net.value, partial: bridge.net.kind === "partial" });
  } else {
    rows.push({ key: "net", label: "Net respiratory service-line value", kind: "net-missing", start: 0, end: 0, value: 0, statusLabel: bridge.net.label });
  }
  return rows;
}

const LEGEND = [
  { label: "Revenue", color: CHART.revenue },
  { label: "RT operating cost", color: CHART.cost },
  { label: "Cost avoidance", color: CHART.costAvoidance },
  { label: "Net value", color: CHART.net },
];

/**
 * Horizontal value bridge: gross revenue − RT operating cost + cost avoidance =
 * net service-line value. No net bar is drawn until operating cost exists.
 */
export function ValueBridgeChart({ bridge, showExcluded = true }: { bridge: ValueBridge; showExcluded?: boolean }) {
  const rows = buildRows(bridge, showExcluded);
  const points = rows.flatMap((r) => [r.start, r.end]);
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const span = max - min || 1;
  const x = (v: number) => ((v - min) / span) * 100;

  return (
    <figure className="space-y-3">
      <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        {LEGEND.map((l) => (
          <li key={l.label} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ background: l.color }} />
            {l.label}
          </li>
        ))}
      </ul>
      <ol className="space-y-1">
        {rows.map((r) => {
          const emphasized = r.kind === "subtotal" || r.kind === "net" || r.kind === "net-missing";
          return (
            <li
              key={r.key}
              className={cn(
                "grid gap-x-3 gap-y-1 rounded-md px-1 py-1.5 hover:bg-surface sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_10.5rem] sm:items-center",
                emphasized && "border-t border-line pt-2.5",
              )}
            >
              <span className={cn("text-sm", emphasized ? "font-semibold text-ink" : "text-ink-soft", r.kind === "excluded" && "text-muted")}>
                {r.label}
              </span>
              <span className="relative block h-4" aria-hidden>
                {min < 0 ? <span className="absolute inset-y-0 w-px" style={{ left: `${x(0)}%`, background: CHART.baseline }} /> : null}
                {r.kind !== "excluded" && r.kind !== "net-missing" && r.value !== 0 ? (
                  <span
                    className="absolute inset-y-0.5 rounded-[3px]"
                    title={`${r.label}: ${formatEgp(r.value)}`}
                    style={{
                      left: `${x(Math.min(r.start, r.end))}%`,
                      width: `${Math.max(Math.abs(x(r.end) - x(r.start)), 0.6)}%`,
                      background: COLOR[r.kind],
                    }}
                  />
                ) : null}
              </span>
              <span className="flex items-center gap-1.5 sm:justify-end">
                {r.kind === "excluded" ? (
                  <span className="text-xs whitespace-nowrap text-muted">{r.statusLabel} · excluded</span>
                ) : r.kind === "net-missing" ? (
                  <Badge tone="caution">{r.statusLabel}</Badge>
                ) : (
                  <>
                    {r.partial ? <Badge tone="caution">{r.kind === "net" ? "Provisional" : "Partial"}</Badge> : null}
                    <span className={cn("figure text-sm text-ink", emphasized && "font-semibold")} title={formatEgp(r.value)}>
                      {r.value < 0 ? "−" : r.kind === "subtotal" || r.kind === "net" ? "" : "+"}
                      {formatEgpCompact(Math.abs(r.value)).replace("−", "")}
                    </span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {!hasValue(bridge.net) ? (
        <figcaption className="text-xs text-caution">
          No net value is shown until RT operating cost is entered — gross revenue alone is not value.
        </figcaption>
      ) : null}
    </figure>
  );
}
