import type { LeverResult } from "@/domain/calculations/savings";
import type { SavingsLevel } from "@/domain/scenario";
import { formatEgp, formatEgpCompact } from "@/domain/format";
import { Badge } from "@/components/ui/badge";
import { QuantityMissing } from "@/components/metrics/quantity";
import { CHART } from "./chart-tokens";

/**
 * Cost avoidance by lever for one sensitivity level. One series, one colour;
 * levers without a baseline get no bar (never a zero-length "0").
 */
export function LeverBars({ levers, level }: { levers: readonly LeverResult[]; level: SavingsLevel }) {
  const values = levers.map((l) => l.savings[level]).map((q) => (q.kind === "missing" ? 0 : q.value));
  const max = Math.max(...values, 0);

  return (
    <ul className="divide-y divide-line">
      {levers.map(({ lever, savings }) => {
        const q = savings[level];
        const width = q.kind !== "missing" && max > 0 ? Math.max((q.value / max) * 100, 0.8) : 0;
        return (
          <li key={lever.id} className="grid gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_8.5rem] sm:items-center">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{lever.label}</p>
              <p className="text-xs text-muted">{lever.basisLabel}</p>
            </div>
            <div className="min-w-0">
              {q.kind === "missing" ? (
                <div className="space-y-0.5">
                  <Badge tone="caution">{q.label}</Badge>
                  <QuantityMissing quantity={q} />
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="h-3 w-full rounded-full bg-surface" title={`${lever.label}: ${formatEgp(q.value)}`}>
                    <div className="h-3 rounded-r-[4px] rounded-l-[2px]" style={{ width: `${width}%`, background: CHART.costAvoidance }} />
                  </div>
                  {q.kind === "partial" ? <QuantityMissing quantity={q} /> : null}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              {q.kind === "missing" ? (
                <span className="text-sm text-muted">Not quantified</span>
              ) : (
                <>
                  {q.kind === "partial" ? <Badge tone="caution">Partial</Badge> : null}
                  <span className="figure text-sm font-semibold text-ink" title={formatEgp(q.value)}>
                    {formatEgpCompact(q.value)}
                  </span>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
