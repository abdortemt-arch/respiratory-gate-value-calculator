"use server";

import { revalidatePath } from "next/cache";
import { getInputDefinition, isInputKey } from "@/domain/inputs/catalog";
import { parseInputText } from "@/domain/calculations/validation";
import { authorize } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/supabase/server";

export interface UpdateInputResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly value?: number | null;
}

/**
 * Save one input. Values are parsed and validated with the same domain rules
 * the engine uses; RLS and column grants enforce role limits again in the
 * database, and a trigger writes the audit entry.
 */
export async function updateInput(key: string, rawValue: string, rawText?: string | null): Promise<UpdateInputResult> {
  if (!isInputKey(key)) return { ok: false, error: "Unknown input." };
  const def = getInputDefinition(key);
  const auth = await authorize(def.source === "rg_assumption" ? "edit_assumptions" : "edit_hospital_inputs");
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = parseInputText(def, rawValue);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const update: { numeric_value: number | null; text_value?: string | null } = { numeric_value: parsed.value };
  if (def.textQualifier && rawText !== undefined) {
    const text = (rawText ?? "").trim();
    if (text.length > 200) return { ok: false, error: "Keep the note under 200 characters." };
    update.text_value = text || null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hospital_inputs")
    .update(update)
    .eq("organization_id", auth.user.organizationId)
    .eq("key", key)
    .select("id");
  if (error) {
    return { ok: false, error: error.code === "23514" ? "The database rejected this value." : "Could not save. Try again." };
  }
  if (!data || data.length === 0) return { ok: false, error: "Your role does not allow changing this input." };

  revalidatePath("/", "layout");
  return { ok: true, value: parsed.value };
}
