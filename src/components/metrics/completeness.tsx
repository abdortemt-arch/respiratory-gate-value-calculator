import Link from "next/link";
import type { CompletenessCount } from "@/domain/calculations/completeness";
import { ratio } from "@/domain/calculations/completeness";
import { cn } from "@/lib/cn";

/** Progress bar: amber while incomplete, green only when every input is entered. */
export function CompletenessBar({ count, className }: { count: CompletenessCount; className?: string }) {
  const pct = Math.round(ratio(count) * 100);
  const complete = count.entered === count.total;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={count.total}
      aria-valuenow={count.entered}
      aria-label={`${count.entered} of ${count.total} inputs entered`}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-line", className)}
    >
      <div
        className={cn("h-full rounded-full", complete ? "bg-positive" : "bg-brand-orange")}
        style={{ width: `${Math.max(pct, count.entered > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}

export function CompletenessPill({ count }: { count: CompletenessCount }) {
  const complete = count.entered === count.total;
  return (
    <Link
      href="/inputs"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        complete ? "border-positive/20 bg-positive-50 text-positive" : "border-caution-200 bg-caution-50 text-caution",
      )}
      title="Hospital inputs that feed a calculation"
    >
      <span className="figure">
        {count.entered}/{count.total}
      </span>
      model inputs entered
    </Link>
  );
}
