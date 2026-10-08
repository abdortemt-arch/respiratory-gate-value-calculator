"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Feedback, useActionRunner, type Result } from "./forms";

/** Void a version entered by mistake, with a reason. It stays visible in the history. */
export function VoidButton({ action, label }: { action: (reason: string) => Promise<Result>; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const runner = useActionRunner();
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Void ${label}`}>
        Void
      </Button>
    );
  }
  return (
    <form
      className="flex min-w-60 flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        runner.run(() => action(reason), undefined, () => setOpen(false));
      }}
    >
      <Input aria-label={`Reason for voiding ${label}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className="h-8 text-xs" autoFocus />
      <span className="flex gap-1">
        <Button type="submit" size="sm" variant="danger" disabled={runner.pending || reason.trim().length < 3}>
          Void
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </span>
      <Feedback error={runner.error} notice={null} />
    </form>
  );
}
