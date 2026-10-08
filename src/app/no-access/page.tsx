import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/sign-in/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "No access" };

const MESSAGES = {
  no_profile: "Your account is not linked to a hospital profile yet. Ask your Admin to finish setting it up.",
  inactive: "Your account has been deactivated. Contact your Admin if you need access again.",
  reserved_role: "Your role does not have access to the internal financial platform.",
} as const;

export default async function NoAccessPage() {
  const session = await getSession();
  if (session.status === "signed_out") redirect("/sign-in");
  if (session.status === "ok") redirect("/hospitals");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Image src="/brand/rg-mark-color.png" alt="Respiratory Gate" width={56} height={56} />
        </div>
        <Card className="space-y-4 p-6">
          <Alert tone="caution" title="No access">
            {MESSAGES[session.reason]}
          </Alert>
          <p className="text-sm text-muted">Signed in as {session.email || "unknown"}.</p>
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
