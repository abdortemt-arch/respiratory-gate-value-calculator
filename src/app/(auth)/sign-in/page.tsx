import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const notice = sp.reset === "1" ? "Password updated. Sign in with your new password." : undefined;
  return <SignInForm next={next} notice={notice} />;
}
