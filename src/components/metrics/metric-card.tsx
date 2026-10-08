import type { ReactNode } from "react";
import type { Quantity } from "@/domain/calculations/quantity";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { QuantityMissing, QuantityStatus, QuantityValue } from "./quantity";

interface MetricCardProps {
  readonly title: string;
  readonly quantity?: Quantity;
  /** Pre-formatted value for non-money metrics (beds, %). */
  readonly value?: ReactNode;
  /** Calculation basis; defaults to the quantity's own basis. */
  readonly basis?: ReactNode;
  readonly status?: ReactNode;
  readonly calculatedLabel?: string;
  readonly partialLabel?: string;
  readonly accent?: "orange" | "blue";
  readonly footer?: ReactNode;
  /** List the inputs still missing (off for aggregates, where the list would be long). */
  readonly showMissing?: boolean;
  readonly className?: string;
}

/** Value + calculation basis + confidence, as required for every major output. */
export function MetricCard({
  title,
  quantity,
  value,
  basis,
  status,
  calculatedLabel,
  partialLabel,
  accent,
  footer,
  showMissing = true,
  className,
}: MetricCardProps) {
  const shownBasis = basis ?? (quantity && quantity.kind !== "missing" ? quantity.basis : null);
  return (
    <Card
      className={cn(
        "flex flex-col gap-2 p-4 sm:p-5",
        accent === "orange" && "border-brand-orange-100 bg-gradient-to-b from-brand-orange-50/70 to-card",
        accent === "blue" && "border-brand-blue-100",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-ink-soft">{title}</h3>
        {status ?? (quantity ? <QuantityStatus quantity={quantity} calculatedLabel={calculatedLabel} partialLabel={partialLabel} /> : null)}
      </div>
      <div className="text-2xl leading-tight sm:text-[1.7rem]">
        {quantity ? (
          <QuantityValue quantity={quantity} className={quantity.kind === "missing" ? "text-xl" : undefined} />
        ) : (
          <span className="font-semibold">{value}</span>
        )}
      </div>
      {shownBasis ? <p className="figure text-xs leading-relaxed text-muted">{shownBasis}</p> : null}
      {quantity && showMissing ? <QuantityMissing quantity={quantity} /> : null}
      {footer}
    </Card>
  );
}
