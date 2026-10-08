"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { DEPARTMENT_CATEGORIES, type DepartmentCategory } from "@/domain/hospital";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { ActionForm, Checkbox, Feedback, useActionRunner, type Result } from "./forms";

export interface DepartmentRow {
  readonly id: string;
  readonly name: string;
  readonly category: DepartmentCategory;
  readonly beds: number | null;
  readonly rtCoverage: boolean;
  readonly notes: string | null;
  readonly active: boolean;
}

function DepartmentFields({ initial, idPrefix }: { initial?: DepartmentRow; idPrefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem_auto]">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Department name</Label>
        <Input id={`${idPrefix}-name`} name="name" required maxLength={120} defaultValue={initial?.name} placeholder="e.g. AICU" autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-category`}>Type</Label>
        <Select id={`${idPrefix}-category`} name="category" defaultValue={initial?.category ?? "adult_icu"}>
          {Object.entries(DEPARTMENT_CATEGORIES).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-beds`}>Beds</Label>
        <Input id={`${idPrefix}-beds`} name="beds" inputMode="numeric" defaultValue={initial?.beds ?? ""} className="figure" placeholder="Unknown" />
      </div>
      <div className="flex items-end pb-2">
        <Checkbox name="rtCoverage" defaultChecked={initial?.rtCoverage ?? true} label="RT coverage" />
      </div>
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
        <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
        <Input id={`${idPrefix}-notes`} name="notes" maxLength={1000} defaultValue={initial?.notes ?? ""} placeholder="Optional" />
      </div>
    </div>
  );
}

export function DepartmentsManager({
  departments,
  canEdit,
  create,
  update,
  setActive,
}: {
  departments: readonly DepartmentRow[];
  canEdit: boolean;
  create: (form: FormData) => Promise<Result>;
  update: (departmentId: string, form: FormData) => Promise<Result>;
  setActive: (departmentId: string, active: boolean) => Promise<Result>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const runner = useActionRunner();
  const totalBeds = departments.filter((d) => d.active).reduce((s, d) => s + (d.beds ?? 0), 0);

  return (
    <div className="space-y-5">
      {canEdit ? (
        <ActionForm action={create} success={(_, f) => `${f.get("name")} added.`} className="rounded-xl border border-line bg-surface/60 p-4">
          {(pending) => (
            <>
              <DepartmentFields idPrefix="new-dept" />
              <Button type="submit" disabled={pending}>
                <Plus /> Add department
              </Button>
            </>
          )}
        </ActionForm>
      ) : null}

      {departments.length === 0 ? (
        <p className="text-sm text-muted">No departments yet{canEdit ? ". Add the units the respiratory service covers, e.g. AICU, PICU, NICU." : "."}</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Department</th>
                <th scope="col" className="py-2 pr-3 font-medium">Type</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Beds</th>
                <th scope="col" className="py-2 pr-3 font-medium">RT coverage</th>
                <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                <th scope="col" className="py-2 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {departments.map((d) =>
                editing === d.id ? (
                  <tr key={d.id}>
                    <td colSpan={6} className="py-3">
                      <ActionForm action={(f) => update(d.id, f)} resetOnSuccess={false} onDone={() => setEditing(null)} className="rounded-xl border border-brand-blue-100 p-3">
                        {(pending) => (
                          <>
                            <DepartmentFields initial={d} idPrefix={`edit-${d.id}`} />
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" disabled={pending}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                            </div>
                          </>
                        )}
                      </ActionForm>
                    </td>
                  </tr>
                ) : (
                  <tr key={d.id} className={d.active ? undefined : "text-muted"}>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-ink">{d.name}</span>
                      {d.notes ? <span className="block text-xs text-muted">{d.notes}</span> : null}
                    </td>
                    <td className="py-2.5 pr-3">{DEPARTMENT_CATEGORIES[d.category]}</td>
                    <td className="figure py-2.5 pr-3 text-right">{d.beds ?? <span className="text-caution">Unknown</span>}</td>
                    <td className="py-2.5 pr-3">{d.rtCoverage ? "Yes" : "No"}</td>
                    <td className="py-2.5 pr-3"><Badge tone={d.active ? "positive" : "neutral"}>{d.active ? "Active" : "Inactive"}</Badge></td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {canEdit ? (
                        <span className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(d.id)} aria-label={`Edit ${d.name}`}>
                            <Pencil /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={d.active ? "danger" : "secondary"}
                            disabled={runner.pending}
                            onClick={() => runner.run(() => setActive(d.id, !d.active), `${d.name} ${d.active ? "deactivated" : "reactivated"}.`)}
                          >
                            {d.active ? "Deactivate" : "Reactivate"}
                          </Button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-line text-xs text-muted">
                <td className="py-2 pr-3" colSpan={2}>Active departments</td>
                <td className="figure py-2 pr-3 text-right font-medium text-ink">{totalBeds}</td>
                <td colSpan={3} className="py-2">beds</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <Feedback error={runner.error} notice={runner.notice} />
    </div>
  );
}
