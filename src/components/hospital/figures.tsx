import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import type { Figure } from "@/domain/hospital";
import { formatEgp, formatEgpCompact, formatNumber, formatPercent } from "@/domain/format";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** A money figure, or a clear "data required" label — never a fake zero. */
export function FigureValue({
  figure,
  compact = false,
  missingLabel = "Data required",
  className,
}: {
  figure: Figure | null | undefined;
  compact?: boolean;
  missingLabel?: string;
  className?: string;
}) {
  if (!figure || figure.value === null || figure.status === "missing") {
    return <span className={cn("font-medium text-caution", className)}>{missingLabel}</span>;
  }
  return <span className={cn("figure font-semibold", className)}>{compact ? formatEgpCompact(figure.value) : formatEgp(figure.value)}</span>;
}

export function FigureStatusBadge({
  figure,
  completeLabel = "Calculated",
  missingLabel,
}: {
  figure: Figure | null | undefined;
  completeLabel?: string;
  /** A neutral label for figures where "missing" means "none recorded". */
  missingLabel?: string;
}) {
  if (!figure || figure.status === "missing") return missingLabel ? <Badge tone="neutral">{missingLabel}</Badge> : <Badge tone="caution">Data required</Badge>;
  if (figure.status === "partial") return <Badge tone="caution">Partial data</Badge>;
  return <Badge tone="blue">{completeLabel}</Badge>;
}

/** Change against a comparison value: arrow, amount and percentage. */
export function Delta({
  change,
  pct,
  higherIsBetter = true,
  format = "money",
  suffix,
  className,
}: {
  change: number | null;
  pct?: number | null;
  higherIsBetter?: boolean;
  format?: "money" | "number" | "percent";
  suffix?: ReactNode;
  className?: string;
}) {
  if (change === null) return <span className={cn("text-xs text-muted", className)}>No comparison{suffix ? <> {suffix}</> : null}</span>;
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  const good = change === 0 ? null : change > 0 === higherIsBetter;
  const amount =
    format === "money" ? formatEgpCompact(Math.abs(change)) : format === "percent" ? `${Number((Math.abs(change) * 100).toFixed(1))} pts` : formatNumber(Math.abs(change));
  return (
    <span
      className={cn(
        "figure inline-flex items-center gap-0.5 text-xs font-medium",
        good === null ? "text-muted" : good ? "text-positive" : "text-caution",
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      <span className="sr-only">{change > 0 ? "up" : change < 0 ? "down" : "unchanged"}</span>
      {change === 0 ? "No change" : `${change > 0 ? "+" : "−"}${amount}`}
      {pct !== null && pct !== undefined && change !== 0 ? <span className="text-muted">({pct > 0 ? "+" : "−"}{formatPercent(Math.abs(pct))})</span> : null}
      {suffix ? <span className="ml-1 font-normal text-muted">{suffix}</span> : null}
    </span>
  );
}

/** Value + calculation basis + completeness, for one financial figure. */
export function FigureCard({
  title,
  figure,
  basis,
  footer,
  accent,
  value,
  status,
  missingLabel,
  className,
}: {
  title: string;
  figure?: Figure | null;
  /** Pre-formatted value for non-money metrics. */
  value?: ReactNode;
  basis?: ReactNode;
  footer?: ReactNode;
  status?: ReactNode;
  accent?: "orange" | "blue";
  /** Shown instead of the value when the figure is missing. */
  missingLabel?: string;
  className?: string;
}) {
  const issues = figure?.issues ?? [];
  return (
    <Card
      className={cn(
        "flex flex-col gap-1.5 p-4 sm:p-5",
        accent === "orange" && "border-brand-orange-100 bg-gradient-to-b from-brand-orange-50/70 to-card",
        accent === "blue" && "border-brand-blue-100",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-ink-soft">{title}</h3>
        {status ?? (figure !== undefined ? <FigureStatusBadge figure={figure} missingLabel={missingLabel} /> : null)}
      </div>
      <div className="text-2xl leading-tight">{value ?? <FigureValue figure={figure} compact missingLabel={missingLabel} className={!figure || figure.status === "missing" ? "text-lg" : undefined} />}</div>
      {basis ? <p className="figure text-xs leading-relaxed text-muted">{basis}</p> : null}
      {issues.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-caution">
          {issues.slice(0, 2).map((i) => (
            <li key={i.message}>{i.message}</li>
          ))}
          {issues.length > 2 ? <li>and {issues.length - 2} more</li> : null}
        </ul>
      ) : null}
      {footer}
    </Card>
  );
}

export function Money({ value, compact = false, missing = "—" }: { value: number | null | undefined; compact?: boolean; missing?: string }) {
  if (value === null || value === undefined) return <span className="text-muted">{missing}</span>;
  return <span className="figure">{compact ? formatEgpCompact(value) : formatEgp(value)}</span>;
}

export function Num({ value, missing = "—" }: { value: number | null | undefined; missing?: string }) {
  if (value === null || value === undefined) return <span className="text-muted">{missing}</span>;
  return <span className="figure">{formatNumber(value)}</span>;
}

/** Wrapper that lets wide tables scroll inside the card instead of the page. */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative overflow-x-auto", className)}>{children}</div>;
}

export const th = "px-3 py-2 text-left text-xs font-semibold text-muted whitespace-nowrap";
export const thNum = "px-3 py-2 text-right text-xs font-semibold text-muted whitespace-nowrap";
export const td = "px-3 py-2 align-top";
export const tdNum = "px-3 py-2 text-right align-top whitespace-nowrap";
