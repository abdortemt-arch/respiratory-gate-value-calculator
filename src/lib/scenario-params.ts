/**
 * Scenario selection <-> URL query (?scenario=<id>&occ=0.8&price=1000&level=mid).
 * Shared by server pages (initial state) and the client scenario bar, so a
 * link always reproduces the same figures.
 */
import { isSavingsLevel, WORKBOOK_DEFAULT_SCENARIO, type SavingsLevel, type ScenarioSettings } from "@/domain/scenario";

export interface SavedScenario {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly status: "draft" | "approved" | "archived";
  readonly approvedAt: string | null;
  readonly approvedByName: string | null;
  readonly createdByName: string | null;
  readonly updatedAt: string;
  readonly settings: ScenarioSettings;
}

export interface ScenarioParams {
  readonly scenarioId?: string;
  readonly occupancyRate?: number;
  readonly packagePrice?: number;
  readonly savingsLevel?: SavingsLevel;
}

type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;

function get(sp: SearchParamsLike, key: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export function parseScenarioParams(sp: SearchParamsLike): ScenarioParams {
  const occ = Number(get(sp, "occ"));
  const price = Number(get(sp, "price"));
  const level = get(sp, "level");
  const scenarioId = get(sp, "scenario");
  return {
    scenarioId: scenarioId && /^[0-9a-f-]{36}$/i.test(scenarioId) ? scenarioId : undefined,
    occupancyRate: occ > 0 && occ <= 1 ? occ : undefined,
    packagePrice: price > 0 && Number.isFinite(price) ? price : undefined,
    savingsLevel: isSavingsLevel(level) ? level : undefined,
  };
}

export interface ResolvedScenario {
  readonly settings: ScenarioSettings;
  /** Saved scenario the selection starts from (sensitivities come from it). */
  readonly base: SavedScenario | null;
}

export function resolveScenario(params: ScenarioParams, scenarios: readonly SavedScenario[]): ResolvedScenario {
  const base =
    scenarios.find((s) => s.id === params.scenarioId) ?? scenarios.find((s) => s.isDefault) ?? scenarios[0] ?? null;
  const start = base?.settings ?? WORKBOOK_DEFAULT_SCENARIO;
  return {
    base,
    settings: {
      occupancyRate: params.occupancyRate ?? start.occupancyRate,
      packagePrice: params.packagePrice ?? start.packagePrice,
      savingsLevel: params.savingsLevel ?? start.savingsLevel,
      sensitivities: start.sensitivities,
    },
  };
}

/** Query string for a selection; omits values equal to the base scenario. */
export function scenarioQuery(settings: ScenarioSettings, base: SavedScenario | null): string {
  const q = new URLSearchParams();
  if (base && !base.isDefault) q.set("scenario", base.id);
  const start = base?.settings ?? WORKBOOK_DEFAULT_SCENARIO;
  if (settings.occupancyRate !== start.occupancyRate) q.set("occ", String(settings.occupancyRate));
  if (settings.packagePrice !== start.packagePrice) q.set("price", String(settings.packagePrice));
  if (settings.savingsLevel !== start.savingsLevel) q.set("level", settings.savingsLevel);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** True when the selection differs from its saved base scenario. */
export function isModified(settings: ScenarioSettings, base: SavedScenario | null): boolean {
  if (!base) return true;
  const b = base.settings;
  return (
    settings.occupancyRate !== b.occupancyRate ||
    settings.packagePrice !== b.packagePrice ||
    settings.savingsLevel !== b.savingsLevel
  );
}
