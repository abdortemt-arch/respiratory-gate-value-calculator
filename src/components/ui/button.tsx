import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand-blue text-white shadow-sm hover:bg-brand-blue-700",
        secondary: "border border-line-strong bg-card text-ink hover:bg-surface",
        ghost: "text-ink-soft hover:bg-brand-blue-50 hover:text-ink",
        danger: "border border-danger/30 bg-card text-danger hover:bg-danger-50",
        accent: "bg-brand-orange text-white shadow-sm hover:brightness-95",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

type LinkButtonProps = ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

export function LinkButton({ className, variant, size, ...props }: LinkButtonProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
