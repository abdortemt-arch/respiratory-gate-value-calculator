import "server-only";
import { revalidatePath } from "next/cache";
import { isMonth, type Month } from "@/domain/hospital";

export interface ActionResult {
  readonly ok: boolean;
  readonly error?: string;
  /** Id of a created record. */
  readonly id?: string;
}

export const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * Turn a database error into a message for the user. Messages raised by our own
 * triggers (P0001, and 42501 with our wording) are written for users already.
 */
export function dbError(error: { code?: string; message?: string } | null | undefined, fallback: string, duplicate?: string): string {
  if (!error) return fallback;
  if (error.code === "23505") return duplicate ?? "This already exists.";
  if (error.code === "23514") return "The database rejected a value. Check the numbers and try again.";
  if (error.code === "23503") return "That record belongs to another hospital or no longer exists.";
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") {
    return error.message && !error.message.startsWith("new row violates") && !error.message.startsWith("permission denied")
      ? error.message
      : "Your role does not allow this change.";
  }
  return fallback;
}

export function text(form: FormData, name: string, max = 2000): string | null {
  const v = String(form.get(name) ?? "").trim();
  return v ? v.slice(0, max) : null;
}

/**
 * Parse a non-negative number typed by a user ("1,500", "1500.5"). Returns
 * undefined for blank (unknown) and NaN for invalid input.
 */
export function parseAmount(raw: unknown): number | undefined {
  const s = String(raw ?? "").replace(/[,\s]/g, "").replace(/^EGP/i, "");
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN;
}

export function parseMonth(raw: unknown): Month | null {
  const s = String(raw ?? "").trim();
  return isMonth(s) ? s : null;
}

/** Refresh every page of a hospital (and the portfolio that summarises it). */
export function refreshHospital(hospitalId: string) {
  revalidatePath(`/hospitals/${hospitalId}`, "layout");
  revalidatePath("/hospitals");
}
