"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/field";
import { signIn, type SignInState } from "./actions";

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold text-ink">Sign in</h1>
      {notice ? <p className="mt-1 text-sm text-positive">{notice}</p> : null}
      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-brand-blue-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state.error ? <FieldError>{state.error}</FieldError> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-xs text-muted">Accounts are created by your Admin. There is no self sign-up.</p>
    </Card>
  );
}
