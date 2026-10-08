import { WorkbookLink } from "@/components/scenario/workbook-link";
import type { ReactNode } from "react";
import { getInputDefinition, type InputKey } from "@/domain/inputs/catalog";
import { missingInputs, type Quantity } from "@/domain/calculations/quantity";
import { formatEgp, formatEgpCompact } from "@/domain/format";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";

/** Value of a quantity, or its workbook status label when not quantified. Never a fake zero. */
export function QuantityValue({
  quantity,
  compact = true,
  className,
}: {
  quantity: Quantity;
  compact?: boolean;
  className?: string;
}) {
  if (quantity.kind === "missing") {
    return <span className={cn("font-semibold text-caution sm:whitespace-nowrap", className)}>{quantity.label}</span>;
  }
  return (
    <span className={cn("font-semibold", className)} title={formatEgp(quantity.value)}>
      {compact ? formatEgpCompact(quantity.value) : formatEgp(quantity.value)}
    </span>
  );
}

export function QuantityStatus({
  quantity,
  calculatedLabel = "Calculated",
  partialLabel = "Partial",
}: {
  quantity: Quantity;
  calculatedLabel?: string;
  partialLabel?: string;
}) {
  if (quantity.kind === "calculated") return <Badge tone="blue">{calculatedLabel}</Badge>;
  if (quantity.kind === "partial") return <Badge tone="caution">{partialLabel}</Badge>;
  return <Badge tone="caution">{quantity.label}</Badge>;
}

export function inputLabel(key: InputKey): string {
  return getInputDefinition(key).label;
}

/** "Required input: Oxygen spend" with links to the Inputs form. */
export function MissingInputs({
  keys,
  prefix,
  className,
  max = 4,
}: {
  keys: readonly InputKey[];
  prefix?: ReactNode;
  className?: string;
  max?: number;
}) {
  if (keys.length === 0) return null;
  const shown = keys.slice(0, max);
  const rest = keys.length - shown.length;
  return (
    <p className={cn("text-xs text-muted", className)}>
      {prefix ?? (keys.length === 1 ? "Required input: " : "Required inputs: ")}
      {shown.map((k, i) => (
        <span key={k}>
          {i > 0 ? ", " : ""}
          <WorkbookLink to={`inputs#${k}`} className="font-medium text-brand-blue-700 underline-offset-2 hover:underline">
            {inputLabel(k)}
          </WorkbookLink>
        </span>
      ))}
      {rest > 0 ? ` and ${rest} more` : ""}
    </p>
  );
}

export function QuantityMissing({ quantity, className }: { quantity: Quantity; className?: string }) {
  const keys = missingInputs(quantity);
  if (keys.length === 0) return null;
  return (
    <MissingInputs
      keys={keys}
      className={className}
      prefix={quantity.kind === "partial" ? "Not yet entered: " : undefined}
    />
  );
}
