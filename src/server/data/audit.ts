import "server-only";
import { monthOf } from "@/domain/hospital";
import { AUDIT_GROUPS, AUDIT_PAGE_SIZE, type AuditData, type AuditFilters } from "@/components/audit/audit-log";
import { createSupabaseServerClient } from "../supabase/server";

/** One page of the audit log with the names needed to display it (RLS applies). */
export async function loadAudit(filters: AuditFilters, hospitalId?: string): Promise<AuditData> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("changed_at", { ascending: false })
    .order("id", { ascending: false })
    .range((filters.page - 1) * AUDIT_PAGE_SIZE, filters.page * AUDIT_PAGE_SIZE - 1);
  if (filters.hospital) query = query.eq("hospital_id", filters.hospital);
  if (filters.group) query = query.in("entity_type", [...AUDIT_GROUPS[filters.group].types]);
  if (filters.key) query = query.eq("entity_type", "hospital_input").in("field_name", [filters.key, `${filters.key}.text`]);
  if (filters.corrections) query = query.eq("action", "correction");

  const periodsQuery = supabase.from("operating_periods").select("id, period_month");
  const [{ data: rows, count, error }, hospitals, periods, profiles] = await Promise.all([
    query,
    supabase.from("hospitals").select("id, name").order("name"),
    hospitalId ? periodsQuery.eq("hospital_id", hospitalId) : periodsQuery,
    supabase.from("profiles").select("id, full_name"),
  ]);
  if (error) throw error;
  return {
    rows,
    total: count ?? 0,
    hospitals: hospitals.data ?? [],
    periodMonths: Object.fromEntries((periods.data ?? []).map((p) => [p.id, monthOf(p.period_month)])),
    profileNames: Object.fromEntries((profiles.data ?? []).map((p) => [p.id, p.full_name])),
  };
}
