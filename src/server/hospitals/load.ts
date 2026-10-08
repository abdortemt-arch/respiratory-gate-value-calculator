import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { monthlySummaries, type FinancialSummary, type HospitalData } from "@/domain/hospital";
import type { SessionUser } from "../auth/session";
import { createSupabaseServerClient } from "../supabase/server";
import { loadHospitalsWithRoles } from "./access";
import { loadHospitalDetail, loadPeople, loadPeriods, type HospitalDetail, type PeriodRecord } from "./repository";

/** user_id → full name in the caller's organisation. Memoised per request. */
export const loadPeopleCached = cache(async (): Promise<Record<string, string>> => loadPeople(await createSupabaseServerClient()));

/** One hospital's configuration (RLS applies). 404 when it is not visible. Memoised per request. */
export const loadDetail = cache(async (hospitalId: string): Promise<HospitalDetail> => {
  const supabase = await createSupabaseServerClient();
  const detail = await loadHospitalDetail(supabase, hospitalId, await loadPeopleCached());
  if (!detail) notFound();
  return detail;
});

/** Every operating period of a hospital with its data. Memoised per request. */
export const loadAllPeriods = cache(async (hospitalId: string): Promise<PeriodRecord[]> => loadPeriods(await createSupabaseServerClient(), hospitalId));

export interface HospitalAnalytics {
  readonly detail: HospitalDetail;
  readonly periods: readonly PeriodRecord[];
  /** Calculated months, oldest first; each month uses its own prices and costs. */
  readonly monthly: readonly FinancialSummary[];
}

export const loadAnalytics = cache(async (hospitalId: string): Promise<HospitalAnalytics> => {
  const [detail, periods] = await Promise.all([loadDetail(hospitalId), loadAllPeriods(hospitalId)]);
  return { detail, periods, monthly: monthlySummaries(detail.config, periods.map((p) => p.input)) };
});

/** Configuration and periods of every visible hospital, for the portfolio and comparisons. */
export const loadPortfolioData = cache(async (user: SessionUser): Promise<HospitalData[]> => {
  const hospitals = await loadHospitalsWithRoles(user);
  const supabase = await createSupabaseServerClient();
  const people = await loadPeopleCached();
  return Promise.all(
    hospitals.map(async (h) => {
      const [detail, periods] = await Promise.all([loadHospitalDetail(supabase, h.id, people), loadPeriods(supabase, h.id)]);
      return { config: detail!.config, active: h.active, periods: periods.map((p) => p.input) };
    }),
  );
});
