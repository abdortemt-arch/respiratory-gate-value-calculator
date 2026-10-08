"use client";

import { cn } from "@/lib/cn";

interface SegmentedProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
  readonly className?: string;
}

/** Accessible single-choice control (radio group semantics). */
export function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border border-line-strong bg-card p-0.5", className)}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 flex-1 rounded-md px-3 text-sm font-medium transition-colors",
              selected ? "bg-brand-orange text-white shadow-sm" : "text-ink-soft hover:bg-surface",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
