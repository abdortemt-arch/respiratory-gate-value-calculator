"use client";

import { createContext, use, useEffect, useMemo, useState, type ReactNode } from "react";
import { calculateModel, type ModelResult } from "@/domain/calculations";
import { OCCUPANCY_SCENARIO_KEYS, PRICE_SCENARIO_KEYS, type InputKey, type InputValues } from "@/domain/inputs/catalog";
import type { ScenarioSettings } from "@/domain/scenario";
import { isModified, SCENARIO_PARAM_KEYS, scenarioQuery, type SavedScenario } from "@/lib/scenario-params";

export interface ScenarioOption {
  readonly value: number;
  readonly label: string;
}

interface ScenarioContextValue {
  readonly values: InputValues;
  readonly texts: Partial<Record<InputKey, string | null>>;
  readonly scenarios: readonly SavedScenario[];
  readonly base: SavedScenario | null;
  readonly settings: ScenarioSettings;
  readonly model: ModelResult;
  readonly modified: boolean;
  readonly occupancyOptions: readonly ScenarioOption[];
  readonly priceOptions: readonly ScenarioOption[];
  readonly update: (patch: Partial<Pick<ScenarioSettings, "occupancyRate" | "packagePrice" | "savingsLevel">>) => void;
  readonly selectBase: (id: string) => void;
  readonly reset: () => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

const pct = (v: number) => `${Number((v * 100).toFixed(2))}%`;
const egp = (v: number) => `EGP ${v.toLocaleString("en-US")}`;

function withCurrent(options: ScenarioOption[], current: number, label: (v: number) => string): ScenarioOption[] {
  return options.some((o) => o.value === current)
    ? options
    : [...options, { value: current, label: `${label(current)} (custom)` }].sort((a, b) => a.value - b.value);
}

/**
 * Holds the scenario selection for a page and recalculates the model in the
 * browser on every change (the engine is pure and fast), so results update
 * immediately. The selection is mirrored into the URL for sharing and reload.
 */
export function ScenarioProvider({
  values,
  texts,
  scenarios,
  initialSettings,
  initialBaseId,
  children,
}: {
  values: InputValues;
  texts: Partial<Record<InputKey, string | null>>;
  scenarios: readonly SavedScenario[];
  initialSettings: ScenarioSettings;
  initialBaseId: string | null;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [baseId, setBaseId] = useState(initialBaseId);
  const base = scenarios.find((s) => s.id === baseId) ?? null;

  const model = useMemo(() => calculateModel(values, settings, texts), [values, settings, texts]);

  useEffect(() => {
    // Rewrite only the scenario parameters; keep any others (e.g. ?denied=1).
    const params = new URLSearchParams(window.location.search);
    for (const key of SCENARIO_PARAM_KEYS) params.delete(key);
    for (const [key, value] of new URLSearchParams(scenarioQuery(settings, base))) params.set(key, value);
    const search = params.size ? `?${params}` : "";
    if (search !== window.location.search) {
      window.history.replaceState(null, "", `${window.location.pathname}${search}${window.location.hash}`);
    }
  }, [settings, base]);

  const occupancyOptions = useMemo(() => {
    const grid = OCCUPANCY_SCENARIO_KEYS.map((k) => values[k]).filter((v): v is number => v !== null);
    const options = [...new Set(grid)].map((v) => ({ value: v, label: pct(v) }));
    const actual = values.icu_occupancy_rate_actual;
    if (actual !== null && actual > 0 && !grid.includes(actual)) {
      options.push({ value: actual, label: `${pct(actual)} (hospital actual)` });
    }
    return withCurrent(
      options.sort((a, b) => a.value - b.value),
      settings.occupancyRate,
      pct,
    );
  }, [values, settings.occupancyRate]);

  const priceOptions = useMemo(() => {
    const grid = PRICE_SCENARIO_KEYS.map((k) => values[k]).filter((v): v is number => v !== null);
    return withCurrent(
      [...new Set(grid)].sort((a, b) => a - b).map((v) => ({ value: v, label: egp(v) })),
      settings.packagePrice,
      egp,
    );
  }, [values, settings.packagePrice]);

  const value: ScenarioContextValue = {
    values,
    texts,
    scenarios,
    base,
    settings,
    model,
    modified: isModified(settings, base),
    occupancyOptions,
    priceOptions,
    update: (patch) => setSettings((s) => ({ ...s, ...patch })),
    selectBase: (id) => {
      const next = scenarios.find((s) => s.id === id);
      if (!next) return;
      setBaseId(id);
      setSettings(next.settings);
    },
    reset: () => {
      if (base) setSettings(base.settings);
    },
  };

  return <ScenarioContext value={value}>{children}</ScenarioContext>;
}

export function useScenario(): ScenarioContextValue {
  const ctx = use(ScenarioContext);
  if (!ctx) throw new Error("useScenario must be used inside ScenarioProvider");
  return ctx;
}
