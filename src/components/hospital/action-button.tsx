"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";

type Result = { ok: boolean; error?: string };

/** Runs a bound Server Action, shows its error and refreshes the page on success. */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
  className,
}: {
  action: () => Promise<Result>;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md";
  /** Ask before running (for consequential actions). */
  confirm?: string;
  className?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        size={size}
        disabled={pending}
        className={className}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          startTransition(async () => {
            const r = await action();
            if (r.ok) router.refresh();
            else setError(r.error ?? "Something went wrong.");
          });
        }}
      >
        {pending ? "Working…" : children}
      </Button>
      {error ? <FieldError>{error}</FieldError> : null}
    </span>
  );
}
