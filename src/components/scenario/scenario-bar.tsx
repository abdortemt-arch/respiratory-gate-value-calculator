"use client";

import { RotateCcw, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { SAVINGS_LEVELS, SAVINGS_LEVEL_LABELS, type ScenarioSettings } from "@/domain/scenario";
import { formatPercent } from "@/domain/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useScenario } from "./scenario-provider";

type SaveAction = (name: string, settings: ScenarioSettings) => Promise<{ ok: boolean; error?: string; id?: string }>;

/** One row of scenario controls above the content it scopes. Changes recalculate instantly. */
export function ScenarioBar({ canSave, saveAction }: { canSave: boolean; saveAction?: SaveAction }) {
  const { scenarios, base, settings, modified, occupancyOptions, priceOptions, update, selectBase, reset } = useScenario();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [savedName, setSavedName] = useState<string | null>(null);

  const submit = () => {
    if (!saveAction) return;
    startTransition(async () => {
      const result = await saveAction(name, settings);
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      setSavedName(name.trim());
      setSaving(false);
      setName("");
      setError(null);
    });
  };

  return (
    <section aria-label="Scenario controls" className="no-print mb-6 rounded-[var(--radius-card)] border border-line bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="scenario-base">Scenario</Label>
          <Select id="scenario-base" value={base?.id ?? ""} onChange={(e) => selectBase(e.target.value)}>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isDefault ? " (default)" : ""}
                {s.status === "approved" ? " · approved" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scenario-occupancy">ICU occupancy</Label>
          <Select
            id="scenario-occupancy"
            value={String(settings.occupancyRate)}
            onChange={(e) => update({ occupancyRate: Number(e.target.value) })}
          >
            {occupancyOptions.map((o) => (
              <option key={o.value} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scenario-price">Package price / patient-day</Label>
          <Select id="scenario-price" value={String(settings.packagePrice)} onChange={(e) => update({ packagePrice: Number(e.target.value) })}>
            {priceOptions.map((o) => (
              <option key={o.value} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-ink">Savings sensitivity</span>
          <Segmented
            label="Savings sensitivity"
            value={settings.savingsLevel}
            onChange={(level) => update({ savingsLevel: level })}
            options={SAVINGS_LEVELS.map((level) => ({
              value: level,
              label: `${SAVINGS_LEVEL_LABELS[level]} ${formatPercent(settings.sensitivities[level])}`,
            }))}
            className="flex w-full"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        {modified ? (
          <>
            <Badge tone="orange">Modified</Badge>
            <span>Changed from “{base?.name ?? "workbook default"}” — not saved.</span>
            {base ? (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw /> Reset
              </Button>
            ) : null}
          </>
        ) : (
          <span>
            {base?.status === "approved" && base.approvedAt
              ? `Approved scenario${base.approvedByName ? ` (by ${base.approvedByName})` : ""}.`
              : "Package price and savings percentages are assumptions and sensitivities, not forecasts."}
          </span>
        )}
        {savedName ? <span className="text-positive">Saved “{savedName}” as a draft.</span> : null}
        {canSave && saveAction ? (
          <div className="ml-auto">
            {saving ? (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <Input
                  aria-label="Scenario name"
                  placeholder="Scenario name"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 w-48"
                  autoFocus
                />
                <Button type="submit" size="sm" disabled={pending || name.trim().length < 2}>
                  {pending ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSaving(false)}>
                  Cancel
                </Button>
                {error ? <FieldError className="w-full">{error}</FieldError> : null}
              </form>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setSaving(true)}>
                <Save /> Save as scenario
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
