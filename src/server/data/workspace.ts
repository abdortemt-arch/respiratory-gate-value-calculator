import "server-only";
import { cache } from "react";
import { INPUT_DEFINITIONS, isInputKey, type InputKey, type InputValues } from "@/domain/inputs/catalog";
import type { ScenarioSettings } from "@/domain/scenario";
import type { SavedScenario } from "@/lib/scenario-params";
import { createSupabaseServerClient } from "../supabase/server";

export interface InputMeta {
  readonly id: string;
  /** Per-hospital metadata (the catalog describes Elite's workbook). */
  readonly owner: string | null;
  readonly note: string | null;
  readonly source: "hospital_data" | "verified_public" | "rg_assumption";
  readonly updatedAt: string | null;
  readonly updatedByName: string | null;
}

export interface Workspace {
  readonly values: InputValues;
  readonly texts: Partial<Record<InputKey, string | null>>;
  readonly meta: Partial<Record<InputKey, InputMeta>>;
  /** Catalog keys with no database row (should be empty; signals a missing migration). */
  readonly missingRows: readonly InputKey[];
  readonly scenarios: readonly SavedScenario[];
  /** user_id -> full name, for "last changed by" and approvals. */
  readonly people: Readonly<Record<string, string>>;
}

const toNumber = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/**
 * Everything the Workbook Value Model pages need for one hospital, read with
 * the user's session (RLS applies). Memoised per request.
 */
export const loadWorkspace = cache(async (hospitalId: string): Promise<Workspace> => {
  const supabase = await createSupabaseServerClient();
  const [inputs, scenarios, profiles] = await Promise.all([
    supabase
      .from("hospital_inputs")
      .select("id, key, numeric_value, text_value, data_owner, note, source_type, updated_at, updated_by")
      .eq("hospital_id", hospitalId),
    supabase
      .from("scenario_assumptions")
      .select("*")
      .eq("hospital_id", hospitalId)
      .neq("status", "archived")
      .order("is_default", { ascending: false })
      .order("scenario_name"),
    supabase.from("profiles").select("user_id, full_name"),
  ]);
  if (inputs.error) throw inputs.error;
  if (scenarios.error) throw scenarios.error;

  const people: Record<string, string> = {};
  for (const p of profiles.data ?? []) people[p.user_id] = p.full_name;

  // Start from "not provided"; only database rows supply values.
  const values = Object.fromEntries(INPUT_DEFINITIONS.map((d) => [d.key, null])) as InputValues;
  const texts: Partial<Record<InputKey, string | null>> = {};
  const meta: Partial<Record<InputKey, InputMeta>> = {};
  for (const row of inputs.data) {
    if (!isInputKey(row.key)) continue;
    values[row.key] = toNumber(row.numeric_value);
    texts[row.key] = row.text_value;
    meta[row.key] = {
      id: row.id,
      owner: row.data_owner,
      note: row.note,
      source: row.source_type,
      updatedAt: row.updated_by ? row.updated_at : null,
      updatedByName: row.updated_by ? (people[row.updated_by] ?? "Former user") : null,
    };
  }
  const missingRows = INPUT_DEFINITIONS.map((d) => d.key as InputKey).filter((k) => !meta[k]);

  return {
    values,
    texts,
    meta,
    missingRows,
    scenarios: scenarios.data.map((s) => ({
      id: s.id,
      name: s.scenario_name,
      isDefault: s.is_default,
      status: s.status,
      approvedAt: s.approved_at,
      approvedByName: s.approved_by ? (people[s.approved_by] ?? "Former user") : null,
      createdByName: s.created_by ? (people[s.created_by] ?? "Former user") : null,
      updatedAt: s.updated_at,
      settings: {
        occupancyRate: Number(s.occupancy_rate),
        packagePrice: Number(s.package_price),
        savingsLevel: s.savings_level,
        sensitivities: { low: Number(s.low_savings_pct), mid: Number(s.mid_savings_pct), high: Number(s.high_savings_pct) },
      } satisfies ScenarioSettings,
    })),
    people,
  };
});
