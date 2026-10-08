import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface text-ink-soft",
        blue: "border-brand-blue-100 bg-brand-blue-50 text-brand-blue-700",
        orange: "border-brand-orange-100 bg-brand-orange-50 text-brand-orange-ink",
        positive: "border-positive/20 bg-positive-50 text-positive",
        caution: "border-caution-200 bg-caution-50 text-caution",
        danger: "border-danger/20 bg-danger-50 text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
