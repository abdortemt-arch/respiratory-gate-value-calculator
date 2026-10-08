"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { establishSession } from "./actions";

export function SessionFromHash({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState(initialError);

  useEffect(() => {
    if (initialError) return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    // Remove tokens from the address bar and history immediately.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const run = async () => {
      const result = hash.get("error")
        ? { error: hash.get("error_description") ?? "This link is invalid or has expired." }
        : await establishSession(hash.get("access_token") ?? "", hash.get("refresh_token") ?? "");
      if (result.error) setError(result.error);
      else router.replace(next);
    };
    void run();
  }, [initialError, next, router]);

  return (
    <Card className="p-6">
      {error ? (
        <Alert tone="danger" title="We could not sign you in">
          <p>{error}</p>
          <p className="mt-2">
            <Link href="/sign-in">Go to sign in</Link>
          </p>
        </Alert>
      ) : (
        <p className="text-sm text-ink-soft" aria-live="polite">
          Signing you in…
        </p>
      )}
    </Card>
  );
}
