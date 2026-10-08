"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { SERVICE_CATEGORIES, type ServiceCategory } from "@/domain/hospital";
import { ActionForm, Feedback, useActionRunner, type Result } from "@/components/hospital/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

export interface LibraryRow {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly category: ServiceCategory;
  readonly description: string | null;
  readonly active: boolean;
  /** Hospitals providing it. */
  readonly hospitals: number;
}

function Fields({ initial, idPrefix }: { initial?: LibraryRow; idPrefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_8rem_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.2fr)_8rem_minmax(0,1fr)_minmax(0,2fr)]">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Service</Label>
        <Input id={`${idPrefix}-name`} name="name" required maxLength={120} defaultValue={initial?.name} autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-code`}>Code</Label>
        <Input id={`${idPrefix}-code`} name="code" maxLength={20} defaultValue={initial?.code ?? ""} className="uppercase" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-category`}>Category</Label>
        <Select id={`${idPrefix}-category`} name="category" defaultValue={initial?.category ?? "other"}>
          {Object.entries(SERVICE_CATEGORIES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-3 lg:col-span-1">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Input id={`${idPrefix}-description`} name="description" maxLength={1000} defaultValue={initial?.description ?? ""} />
      </div>
    </div>
  );
}

/** The organisation's respiratory service library, shared by all hospitals so services can be compared. */
export function ServiceLibrary({
  rows,
  canAdd,
  canEdit,
  create,
  update,
  setActive,
}: {
  rows: readonly LibraryRow[];
  canAdd: boolean;
  canEdit: boolean;
  create: (form: FormData) => Promise<Result>;
  update: (id: string, form: FormData) => Promise<Result>;
  setActive: (id: string, active: boolean) => Promise<Result>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const runner = useActionRunner();
  return (
    <div className="space-y-4">
      {canAdd ? (
        <ActionForm action={create} success={(_, f) => `${f.get("name")} added to the library.`} className="rounded-xl border border-line bg-surface/60 p-4">
          {(pending) => (
            <>
              <Fields idPrefix="lib-new" />
              <Button type="submit" disabled={pending}>
                <Plus /> Add to library
              </Button>
            </>
          )}
        </ActionForm>
      ) : null}
      <ul className="divide-y divide-line rounded-xl border border-line text-sm">
        {rows.map((r) =>
          editing === r.id ? (
            <li key={r.id} className="p-3">
              <ActionForm action={(f) => update(r.id, f)} resetOnSuccess={false} onDone={() => setEditing(null)}>
                {(pending) => (
                  <>
                    <Fields initial={r} idPrefix={`lib-${r.id}`} />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={pending}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </>
                )}
              </ActionForm>
            </li>
          ) : (
            <li key={r.id} className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2 ${r.active ? "" : "text-muted"}`}>
              <span className="min-w-0">
                <span className="font-medium text-ink">{r.name}</span> {r.code ? <span className="figure text-xs text-muted">{r.code}</span> : null}{" "}
                {r.active ? null : <Badge tone="neutral">Retired</Badge>}
                <span className="block text-xs text-muted">
                  {SERVICE_CATEGORIES[r.category]} · {r.hospitals ? `${r.hospitals} hospital${r.hospitals === 1 ? "" : "s"}` : "not used yet"}
                  {r.description ? ` · ${r.description}` : ""}
                </span>
              </span>
              {canEdit ? (
                <span className="inline-flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r.id)} aria-label={`Edit ${r.name}`}>
                    <Pencil /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" disabled={runner.pending} onClick={() => runner.run(() => setActive(r.id, !r.active), `${r.name} ${r.active ? "retired" : "restored"}.`)}>
                    {r.active ? "Retire" : "Restore"}
                  </Button>
                </span>
              ) : null}
            </li>
          ),
        )}
      </ul>
      <Feedback error={runner.error} notice={runner.notice} />
    </div>
  );
}
