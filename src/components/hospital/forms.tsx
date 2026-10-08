"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field";

export type Result = { ok: boolean; error?: string; id?: string };

/** Runs Server Actions with pending state, error and success messages; refreshes the page on success. */
export function useActionRunner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>, success?: string | ((r: Result) => string | null), after?: (r: Result) => void) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? "Something went wrong.");
        return;
      }
      const message = typeof success === "function" ? success(r) : success;
      if (message) setNotice(message);
      after?.(r);
      router.refresh();
    });
  };
  return { pending, error, notice, run, setError, clear: () => (setError(null), setNotice(null)) };
}

/** A form that submits its FormData to a Server Action and reports the outcome. */
export function ActionForm({
  action,
  success,
  resetOnSuccess = true,
  onDone,
  className,
  children,
}: {
  action: (form: FormData) => Promise<Result>;
  success?: string | ((r: Result, form: FormData) => string | null);
  resetOnSuccess?: boolean;
  onDone?: (r: Result) => void;
  className?: string;
  children: ReactNode | ((pending: boolean) => ReactNode);
}) {
  const { pending, error, notice, run } = useActionRunner();
  return (
    <form
      className={cn("space-y-3", className)}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        run(
          () => action(data),
          (r) => (typeof success === "function" ? success(r, data) : (success ?? null)),
          (r) => {
            if (resetOnSuccess) form.reset();
            onDone?.(r);
          },
        );
      }}
    >
      {typeof children === "function" ? children(pending) : children}
      <Feedback error={error} notice={notice} />
    </form>
  );
}

export function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error ? <FieldError>{error}</FieldError> : null}
      {notice ? (
        <Alert tone="positive" className="py-2">
          {notice}
        </Alert>
      ) : null}
    </>
  );
}

export function Checkbox({ label, className, ...props }: React.ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm text-ink", className)}>
      <input type="checkbox" className="size-4 accent-brand-blue" {...props} />
      {label}
    </label>
  );
}
