import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getServiceRoleKey, getSupabasePublicEnv } from "@/server/env";

export const metadata: Metadata = { title: "Setup required" };
export const dynamic = "force-dynamic";

/** Shown until Supabase environment variables are configured. Reveals only which names are set. */
export default function SetupPage() {
  const configured = getSupabasePublicEnv() !== null;
  if (configured) redirect("/sign-in");
  const vars = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    {
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    },
    { name: "SUPABASE_SERVICE_ROLE_KEY", set: getServiceRoleKey() !== null },
  ];
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-center">
          <Image src="/brand/rg-logo-color.png" alt="Respiratory Gate" width={96} height={111} />
        </div>
        <Card className="space-y-4 p-6">
          <h1 className="text-lg font-semibold">Connect Supabase to finish setup</h1>
          <p className="text-sm text-ink-soft">
            Add these environment variables in Vercel (Project → Settings → Environment Variables) or in{" "}
            <code>.env.local</code> for local development, then redeploy. See the README for the full checklist.
          </p>
          <ul className="space-y-2 text-sm">
            {vars.map((v) => (
              <li key={v.name} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <code className="text-xs">{v.name}</code>
                <span className={v.set ? "text-positive" : "text-caution"}>{v.set ? "Set" : "Missing"}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
