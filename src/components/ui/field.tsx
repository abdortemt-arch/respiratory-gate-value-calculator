import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-ink", className)} {...props} />;
}

const control =
  "h-10 w-full rounded-lg border border-line-strong bg-card px-3 text-sm text-ink placeholder:text-muted/70 " +
  "focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "pr-8", className)} {...props} />;
}

export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return <p role="alert" className={cn("text-sm text-danger", className)} {...props} />;
}

export function FieldHint({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-xs text-muted", className)} {...props} />;
}
