import Image from "next/image";
import { safeNext } from "@/server/auth/redirects";
import { SessionFromHash } from "./session-from-hash";

export default async function ConfirmSessionPage({ searchParams }: PageProps<"/auth/confirm/session">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Image src="/brand/rg-mark-color.png" alt="Respiratory Gate" width={56} height={56} />
        </div>
        <SessionFromHash next={safeNext(sp.next)} initialError={error} />
      </div>
    </main>
  );
}
