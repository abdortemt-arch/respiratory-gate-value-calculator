"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/field";
import { requestPasswordReset, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, {});
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold text-ink">Reset your password</h1>
      {state.sent ? (
        <Alert tone="positive" className="mt-4" title="Check your email">
          If an account exists for that address, a reset link is on its way. Open it in this browser.
        </Alert>
      ) : (
        <form action={action} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required />
          </div>
          {state.error ? <FieldError>{state.error}</FieldError> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mt-4 text-sm">
        <Link href="/sign-in" className="font-medium text-brand-blue-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
