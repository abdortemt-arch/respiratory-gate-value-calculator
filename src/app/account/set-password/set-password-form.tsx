"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { setPassword, type SetPasswordState } from "./actions";

export function SetPasswordForm() {
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(setPassword, {});
  return (
    <form action={action} className="mt-5 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        <FieldHint>At least 10 characters, with letters and numbers.</FieldHint>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      </div>
      {state.error ? <FieldError>{state.error}</FieldError> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
