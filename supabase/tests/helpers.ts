import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Remove a test organisation and everything under it (service role; tests only —
 * the app itself never deletes hospitals, configuration or versions).
 */
export async function cleanupOrganization(service: SupabaseClient, orgId: string, userIds: readonly string[]): Promise<void> {
  const { data: hospitals } = await service.from("hospitals").select("id").eq("organization_id", orgId);
  const ids = (hospitals ?? []).map((h) => h.id as string);
  if (ids.length) {
    // Reopen closed periods so their entries can be removed.
    await service.from("operating_periods").update({ status: "draft" }).in("hospital_id", ids);
    for (const table of [
      "service_activity",
      "period_stats",
      "period_cost_entries",
      "period_savings",
      "operating_periods",
      "cost_versions",
      "cost_items",
      "equipment",
      "service_price_versions",
      "hospital_service_departments",
      "hospital_services",
      "hospital_departments",
      "hospital_members",
      "scenario_assumptions",
      "hospital_inputs",
    ]) {
      await service.from(table).delete().in("hospital_id", ids);
    }
    await service.from("hospitals").delete().in("id", ids);
  }
  await service.from("services").delete().eq("organization_id", orgId);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
  await service.from("audit_log").delete().eq("organization_id", orgId);
  await service.from("profiles").delete().eq("organization_id", orgId);
  await service.from("organizations").delete().eq("id", orgId);
}
