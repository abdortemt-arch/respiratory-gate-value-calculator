import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { defaultWorkbookHospital } from "@/server/hospitals/access";

/**
 * The single-hospital routes from before the multi-hospital platform
 * (/overview, /inputs, …) now open the Workbook Value Model of the default
 * workbook hospital, keeping the query string (scenario selection).
 */
export async function redirectToWorkbook(sub: string, searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<never> {
  await requireUser();
  const hospital = await defaultWorkbookHospital();
  if (!hospital) redirect("/hospitals");
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === "string") query.set(k, v);
  }
  const qs = query.toString();
  redirect(`/hospitals/${hospital.id}/workbook${sub}${qs ? `?${qs}` : ""}`);
}
