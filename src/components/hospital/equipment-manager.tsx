"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { EQUIPMENT_CATEGORIES, OWNERSHIP_TYPES, isOneOf } from "@/domain/hospital";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { ActionForm, Feedback, useActionRunner, type Result } from "./forms";

export interface EquipmentRow {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly departmentId: string | null;
  readonly quantity: number;
  readonly ownership: string;
  readonly acquiredOn: string | null;
  readonly notes: string | null;
  readonly active: boolean;
}

function Fields({ initial, idPrefix, departments }: { initial?: EquipmentRow; idPrefix: string; departments: readonly { id: string; name: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_6rem_minmax(0,1fr)_minmax(0,1fr)_10rem]">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Equipment</Label>
        <Input id={`${idPrefix}-name`} name="name" required maxLength={160} defaultValue={initial?.name} placeholder="e.g. ICU ventilator" autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-category`}>Type</Label>
        <Select id={`${idPrefix}-category`} name="category" defaultValue={initial?.category ?? "ventilator"}>
          {Object.entries(EQUIPMENT_CATEGORIES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-qty`}>Quantity</Label>
        <Input id={`${idPrefix}-qty`} name="quantity" required inputMode="numeric" defaultValue={initial?.quantity ?? 1} className="figure text-right" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-ownership`}>Ownership</Label>
        <Select id={`${idPrefix}-ownership`} name="ownership" defaultValue={initial?.ownership ?? "owned"}>
          {Object.entries(OWNERSHIP_TYPES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-dept`}>Department</Label>
        <Select id={`${idPrefix}-dept`} name="departmentId" defaultValue={initial?.departmentId ?? ""}>
          <option value="">Shared / whole hospital</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-acquired`}>Acquired</Label>
        <Input id={`${idPrefix}-acquired`} name="acquiredOn" type="date" defaultValue={initial?.acquiredOn ?? ""} />
      </div>
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-6">
        <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
        <Input id={`${idPrefix}-notes`} name="notes" maxLength={1000} defaultValue={initial?.notes ?? ""} placeholder="Model, vendor, contract reference" />
      </div>
    </div>
  );
}

export function EquipmentManager({
  rows,
  departments,
  canEdit,
  create,
  update,
  setActive,
}: {
  rows: readonly EquipmentRow[];
  departments: readonly { id: string; name: string }[];
  canEdit: boolean;
  create: (form: FormData) => Promise<Result>;
  update: (id: string, form: FormData) => Promise<Result>;
  setActive: (id: string, active: boolean) => Promise<Result>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const runner = useActionRunner();
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  return (
    <div className="space-y-5">
      {canEdit ? (
        <ActionForm action={create} success={(_, f) => `${f.get("name")} added.`} className="rounded-xl border border-line bg-surface/60 p-4">
          {(pending) => (
            <>
              <Fields idPrefix="new-eq" departments={departments} />
              <Button type="submit" disabled={pending}>
                <Plus /> Add equipment
              </Button>
            </>
          )}
        </ActionForm>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No equipment registered yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {rows.map((e) =>
            editing === e.id ? (
              <li key={e.id} className="p-3">
                <ActionForm action={(f) => update(e.id, f)} resetOnSuccess={false} onDone={() => setEditing(null)}>
                  {(pending) => (
                    <>
                      <Fields initial={e} idPrefix={`eq-${e.id}`} departments={departments} />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={pending}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                      </div>
                    </>
                  )}
                </ActionForm>
              </li>
            ) : (
              <li key={e.id} className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 ${e.active ? "" : "text-muted"}`}>
                <span className="min-w-0">
                  <span className="font-medium text-ink">
                    {e.quantity} × {e.name}
                  </span>{" "}
                  {e.active ? null : <Badge tone="neutral">Retired</Badge>}
                  <span className="block text-xs text-muted">
                    {isOneOf(EQUIPMENT_CATEGORIES, e.category) ? EQUIPMENT_CATEGORIES[e.category] : e.category} ·{" "}
                    {isOneOf(OWNERSHIP_TYPES, e.ownership) ? OWNERSHIP_TYPES[e.ownership] : e.ownership} · {e.departmentId ? (deptName.get(e.departmentId) ?? "Department") : "Shared"}
                    {e.notes ? ` · ${e.notes}` : ""}
                  </span>
                </span>
                {canEdit ? (
                  <span className="inline-flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(e.id)} aria-label={`Edit ${e.name}`}>
                      <Pencil /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={e.active ? "danger" : "secondary"}
                      disabled={runner.pending}
                      onClick={() => runner.run(() => setActive(e.id, !e.active), `${e.name} ${e.active ? "retired" : "back in service"}.`)}
                    >
                      {e.active ? "Retire" : "Reactivate"}
                    </Button>
                  </span>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}
      <Feedback error={runner.error} notice={runner.notice} />
    </div>
  );
}
