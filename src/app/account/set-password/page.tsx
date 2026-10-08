import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getSession } from "@/server/auth/session";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Set password" };

export default async function SetPasswordPage() {
  const session = await getSession();
  if (session.status === "signed_out") redirect("/sign-in");
  const mustChange = session.status === "ok" && session.user.mustChangePassword;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Image src="/brand/rg-mark-color.png" alt="Respiratory Gate" width={56} height={56} />
        </div>
        <Card className="p-6">
          <h1 className="text-lg font-semibold text-ink">{mustChange ? "Choose your own password" : "Set a new password"}</h1>
          <p className="mt-1 text-sm text-muted">
            {mustChange
              ? "Your account was created with a temporary password. Replace it before continuing."
              : "This replaces your current password."}
          </p>
          <SetPasswordForm />
        </Card>
      </div>
    </main>
  );
}
