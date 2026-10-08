"use client";

import { Check, Lock } from "lucide-react";
import { useState, useTransition } from "react";
import { getInputDefinition, type InputKey } from "@/domain/inputs/catalog";
import { formatInputValue, inputAdornment, missingLabel, toEditableText } from "@/domain/inputs/display";
import { parseInputText } from "@/domain/calculations/validation";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/field";

export interface InputFieldProps {
  readonly inputKey: InputKey;
  readonly value: number | null;
  readonly text: string | null;
  readonly editable: boolean;
  readonly updatedAt: string | null;
  readonly updatedByName: string | null;
  readonly warning?: string;
  /** Link to this input's change history (only for roles that may view the audit log). */
  readonly auditHref?: string;
  readonly save: (key: string, value: string, text?: string | null) => Promise<{ ok: boolean; error?: string }>;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function InputField({ inputKey, value, text, editable, updatedAt, updatedByName, warning, auditHref, save }: InputFieldProps) {
  const def = getInputDefinition(inputKey);
  const initial = toEditableText(def, value);
  const [draft, setDraft] = useState(initial);
  const [textDraft, setTextDraft] = useState(text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const { prefix, suffix } = inputAdornment(def);
  const dirty = draft !== initial || (def.textQualifier ? textDraft !== (text ?? "") : false);
  const missing = value === null;

  const submit = () => {
    const parsed = parseInputText(def, draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await save(inputKey, draft, def.textQualifier ? textDraft : undefined);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else setError(result.error ?? "Could not save.");
    });
  };

  const errorId = `${inputKey}-error`;
  return (
    <div id={inputKey} className="scroll-mt-24 grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:gap-6">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${inputKey}-input`} className="text-sm font-medium text-ink">
            {def.label}
          </label>
          {missing ? (
            <Badge tone={def.usage === "informational" ? "neutral" : "caution"}>{missingLabel(def)}</Badge>
          ) : null}
          {def.source === "verified_public" ? <Badge tone="blue">Verified public source</Badge> : null}
          {def.source === "rg_assumption" ? <Badge tone="orange">Respiratory Gate assumption</Badge> : null}
          {def.usage === "informational" ? <Badge tone="neutral">Informational — not used in calculations</Badge> : null}
        </div>
        <p className="text-xs text-muted">
          <span className="font-medium text-ink-soft">{def.unit}</span> · Owner: {def.owner}
          {def.note ? <> · {def.note}</> : null}
        </p>
        {updatedAt ? (
          <p className="text-xs text-muted">
            Last changed {dateFormat.format(new Date(updatedAt))} by {updatedByName}
            {auditHref ? (
              <>
                {" · "}
                <a href={auditHref} className="text-brand-blue-700 hover:underline">
                  History
                </a>
              </>
            ) : null}
          </p>
        ) : null}
        {warning ? <p className="text-xs font-medium text-caution">{warning}</p> : null}
      </div>

      {editable ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              {prefix ? (
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted">{prefix}</span>
              ) : null}
              <Input
                id={`${inputKey}-input`}
                inputMode="decimal"
                autoComplete="off"
                value={draft}
                placeholder="Enter value"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError(null);
                }}
                className={cn("figure text-right", prefix && "pl-11", suffix && "pr-8")}
              />
              {suffix ? (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">{suffix}</span>
              ) : null}
            </div>
            <Button type="submit" size="sm" variant={dirty ? "primary" : "secondary"} disabled={!dirty || pending} className="w-16">
              {pending ? "…" : saved && !dirty ? <Check aria-label="Saved" /> : "Save"}
            </Button>
          </div>
          {def.textQualifier ? (
            <Input
              aria-label={`${def.label}: ${def.textQualifier}`}
              placeholder={def.textQualifier}
              value={textDraft}
              maxLength={200}
              onChange={(e) => setTextDraft(e.target.value)}
              className="h-9 text-xs"
            />
          ) : null}
          {error ? <FieldError id={errorId}>{error}</FieldError> : null}
          {!missing && draft.trim() === "" && dirty ? (
            <p className="text-xs text-muted">Saving an empty value marks this input as unknown again.</p>
          ) : null}
        </form>
      ) : (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className={cn("figure font-semibold", missing ? "text-caution" : "text-ink")}>{formatInputValue(def, value)}</span>
          {def.textQualifier && text ? <span className="text-xs text-muted">({text})</span> : null}
          <Lock aria-label="Read only for your role" className="size-3.5 text-muted" />
        </div>
      )}
    </div>
  );
}
