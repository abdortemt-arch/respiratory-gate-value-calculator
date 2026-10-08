"use server";

import { revalidatePath } from "next/cache";
import { calculateModel } from "@/domain/calculations";
import { buildScenarioSnapshot } from "@/domain/calculations/snapshot";
import { validateScenario } from "@/domain/calculations/validation";
import { isSavingsLevel, type ScenarioSettings } from "@/domain/scenario";
import { loadWorkspace } from "@/server/data/workspace";
import { authorizeHospital } from "@/server/hospitals/access";
import { createSupabaseServerClient } from "@/server/supabase/server";

export interface ScenarioActionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly id?: string;
}

const UUID = /^[0-9a-f-]{36}$/i;

function cleanSettings(s: ScenarioSettings): ScenarioSettings | null {
  if (!s || !isSavingsLevel(s.savingsLevel)) return null;
  const settings: ScenarioSettings = {
    occupancyRate: Number(s.occupancyRate),
    packagePrice: Number(s.packagePrice),
    savingsLevel: s.savingsLevel,
    sensitivities: { low: Number(s.sensitivities?.low), mid: Number(s.sensitivities?.mid), high: Number(s.sensitivities?.high) },
  };
  return validateScenario(settings).length === 0 ? settings : null;
}

/** Save the current selection as a named draft scenario (Admin, Manager). */
export async function saveScenario(hospitalId: string, name: string, input: ScenarioSettings): Promise<ScenarioActionResult> {
  const auth = await authorizeHospital(hospitalId, "save_scenarios");
  if (!auth.ok) return { ok: false, error: auth.error };
  const scenarioName = name.trim();
  if (scenarioName.length < 2 || scenarioName.length > 120) return { ok: false, error: "Use a name of 2–120 characters." };
  const settings = cleanSettings(input);
  if (!settings) return { ok: false, error: "The scenario settings are not valid." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scenario_assumptions")
    .insert({
      organization_id: auth.ctx.user.organizationId,
      hospital_id: auth.ctx.hospital.id,
      scenario_name: scenarioName,
      occupancy_rate: settings.occupancyRate,
      package_price: settings.packagePrice,
      savings_level: settings.savingsLevel,
      low_savings_pct: settings.sensitivities.low,
      mid_savings_pct: settings.sensitivities.mid,
      high_savings_pct: settings.sensitivities.high,
    })
    .select("id")
    .single();
  if (error) {
    return { ok: false, error: error.code === "23505" ? "A scenario with this name already exists." : "Could not save the scenario." };
  }
  revalidatePath("/", "layout");
  return { ok: true, id: data.id };
}

/** Approve a scenario (Admin). Freezes the inputs and results at approval time. */
export async function approveScenario(hospitalId: string, id: string): Promise<ScenarioActionResult> {
  const auth = await authorizeHospital(hospitalId, "approve_scenarios");
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!UUID.test(id)) return { ok: false, error: "Unknown scenario." };

  const ws = await loadWorkspace(auth.ctx.hospital.id);
  const scenario = ws.scenarios.find((s) => s.id === id);
  if (!scenario) return { ok: false, error: "Unknown scenario." };
  const model = calculateModel(ws.values, scenario.settings, ws.texts);
  const snapshot = buildScenarioSnapshot(ws.values, scenario.settings, model, new Date().toISOString());

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scenario_assumptions")
    .update({ status: "approved", approved_snapshot: JSON.parse(JSON.stringify(snapshot)) })
    .eq("id", id)
    .eq("hospital_id", auth.ctx.hospital.id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Could not approve the scenario." };
  revalidatePath("/", "layout");
  return { ok: true, id };
}

/** Make a scenario the hospital's default (Admin). */
export async function setDefaultScenario(hospitalId: string, id: string): Promise<ScenarioActionResult> {
  const auth = await authorizeHospital(hospitalId, "approve_scenarios");
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!UUID.test(id)) return { ok: false, error: "Unknown scenario." };
  const ws = await loadWorkspace(auth.ctx.hospital.id);
  if (!ws.scenarios.some((s) => s.id === id)) return { ok: false, error: "Unknown scenario." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_default_scenario", { scenario_id: id });
  if (error) return { ok: false, error: "Could not change the default scenario." };
  revalidatePath("/", "layout");
  return { ok: true, id };
}

/** Archive a scenario (Admin). The default scenario cannot be archived. */
export async function archiveScenario(hospitalId: string, id: string): Promise<ScenarioActionResult> {
  const auth = await authorizeHospital(hospitalId, "approve_scenarios");
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!UUID.test(id)) return { ok: false, error: "Unknown scenario." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scenario_assumptions")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("hospital_id", auth.ctx.hospital.id)
    .eq("is_default", false)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Could not archive (the default scenario cannot be archived)." };
  revalidatePath("/", "layout");
  return { ok: true, id };
}
