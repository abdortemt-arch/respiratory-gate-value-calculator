"use client";

import { useState, useTransition } from "react";
import { formatPercent } from "@/domain/format";
import type { SavingsSensitivities } from "@/domain/scenario";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";

type Result = { ok: boolean; error?: string };

export function OrganizationNameForm({ name, save }: { name: string; save: (name: string) => Promise<Result> }) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await save(value);
          setError(r.ok ? null : (r.error ?? "Could not save."));
          setDone(r.ok);
        });
      }}
    >
      <div className="min-w-60 flex-1 space-y-1.5">
        <Label htmlFor="org-name">Hospital / organisation name</Label>
        <Input id="org-name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} />
      </div>
      <Button type="submit" disabled={pending || value.trim() === name}>
        Save
      </Button>
      {error ? <FieldError className="w-full">{error}</FieldError> : null}
      {done ? <p className="w-full text-sm text-positive">Saved.</p> : null}
    </form>
  );
}

export function SensitivitiesForm({
  sensitivities,
  editable,
  save,
}: {
  sensitivities: SavingsSensitivities;
  editable: boolean;
  save: (low: string, mid: string, high: string) => Promise<Result>;
}) {
  const asText = (v: number) => String(Number((v * 100).toPrecision(12)));
  const [values, setValues] = useState({ low: asText(sensitivities.low), mid: asText(sensitivities.mid), high: asText(sensitivities.high) });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!editable) {
    return (
      <p className="figure text-sm text-ink">
        Low {formatPercent(sensitivities.low)} · Mid {formatPercent(sensitivities.mid)} · High {formatPercent(sensitivities.high)}
      </p>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await save(values.low, values.mid, values.high);
          setError(r.ok ? null : (r.error ?? "Could not save."));
          setDone(r.ok);
        });
      }}
    >
      {(["low", "mid", "high"] as const).map((level) => (
        <div key={level} className="w-28 space-y-1.5">
          <Label htmlFor={`sens-${level}`} className="capitalize">
            {level} (%)
          </Label>
          <Input
            id={`sens-${level}`}
            inputMode="decimal"
            value={values[level]}
            onChange={(e) => setValues((v) => ({ ...v, [level]: e.target.value }))}
            className="figure text-right"
          />
        </div>
      ))}
      <Button type="submit" disabled={pending}>
        Save sensitivities
      </Button>
      {error ? <FieldError className="w-full">{error}</FieldError> : null}
      {done ? <p className="w-full text-sm text-positive">Saved. Dashboards now use the new sensitivities.</p> : null}
    </form>
  );
}
