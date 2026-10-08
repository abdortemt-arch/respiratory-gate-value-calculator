"use client";

import Link from "next/link";
import { BarChart3, Plus } from "lucide-react";
import { useState } from "react";
import { SERVICE_CATEGORIES, type ServiceCategory } from "@/domain/hospital";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select } from "@/components/ui/field";
import { ActionForm, Checkbox, Feedback, useActionRunner, type Result } from "./forms";

export interface ServiceRow {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly category: ServiceCategory;
  readonly active: boolean;
  readonly departmentIds: readonly string[];
  /** e.g. "EGP 1,800 per day from Feb 2026" */
  readonly currentPrice: string | null;
}

export interface LibraryService {
  readonly id: string;
  readonly name: string;
  readonly category: ServiceCategory;
  readonly provided: boolean;
}

interface DepartmentOption {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

function ServiceDepartments({
  service,
  departments,
  canEdit,
  save,
}: {
  service: ServiceRow;
  departments: readonly DepartmentOption[];
  canEdit: boolean;
  save: (ids: string[]) => Promise<Result>;
}) {
  const [selected, setSelected] = useState<string[]>([...service.departmentIds]);
  const runner = useActionRunner();
  const dirty = [...selected].sort().join() !== [...service.departmentIds].sort().join();
  const shown = departments.filter((d) => d.active || service.departmentIds.includes(d.id));
  if (shown.length === 0) return <p className="text-xs text-muted">Add departments first to assign this service.</p>;
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Departments providing {service.name}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {shown.map((d) => (
          <Checkbox
            key={d.id}
            label={`${d.name}${d.active ? "" : " (inactive)"}`}
            aria-label={`${service.name} in ${d.name}`}
            checked={selected.includes(d.id)}
            disabled={!canEdit || runner.pending}
            onChange={(e) => setSelected((s) => (e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id)))}
          />
        ))}
      </div>
      {canEdit && dirty ? (
        <Button size="sm" disabled={runner.pending} onClick={() => runner.run(() => save(selected), `Departments saved for ${service.name}.`)}>
          Save departments
        </Button>
      ) : null}
      <Feedback error={runner.error} notice={runner.notice} />
    </fieldset>
  );
}

export function ServicesManager({
  hospitalId,
  services,
  library,
  departments,
  canEdit,
  add,
  setDepartments,
  setActive,
}: {
  hospitalId: string;
  services: readonly ServiceRow[];
  library: readonly LibraryService[];
  departments: readonly DepartmentOption[];
  canEdit: boolean;
  add: (form: FormData) => Promise<Result>;
  setDepartments: (hospitalServiceId: string, departmentIds: string[]) => Promise<Result>;
  setActive: (hospitalServiceId: string, active: boolean) => Promise<Result>;
}) {
  const [choice, setChoice] = useState("");
  const runner = useActionRunner();
  const available = library.filter((s) => !s.provided);
  const activeDepartments = departments.filter((d) => d.active);

  return (
    <div className="space-y-5">
      {canEdit ? (
        <ActionForm
          action={add}
          success={(_, f) => `${f.get("serviceId") === "custom" ? f.get("customName") : (library.find((s) => s.id === f.get("serviceId"))?.name ?? "Service")} added.`}
          onDone={() => setChoice("")}
          className="rounded-xl border border-line bg-surface/60 p-4"
        >
          {(pending) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="add-service">Service</Label>
                  <Select id="add-service" name="serviceId" required value={choice} onChange={(e) => setChoice(e.target.value)}>
                    <option value="" disabled>
                      Choose a service…
                    </option>
                    {Object.entries(SERVICE_CATEGORIES).map(([cat, label]) => {
                      const items = available.filter((s) => s.category === cat);
                      return items.length ? (
                        <optgroup key={cat} label={label}>
                          {items.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </optgroup>
                      ) : null;
                    })}
                    <option value="custom">Custom service…</option>
                  </Select>
                </div>
                {choice === "custom" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-name">Custom service name</Label>
                      <Input id="custom-name" name="customName" required maxLength={120} autoComplete="off" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-category">Category</Label>
                      <Select id="custom-category" name="customCategory" defaultValue="other">
                        {Object.entries(SERVICE_CATEGORIES).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-description">Description</Label>
                      <Input id="custom-description" name="customDescription" maxLength={1000} placeholder="Optional" />
                    </div>
                  </>
                ) : null}
              </div>
              {activeDepartments.length ? (
                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium text-ink">Provided in</legend>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {activeDepartments.map((d) => (
                      <Checkbox key={d.id} name="departmentIds" value={d.id} label={d.name} />
                    ))}
                  </div>
                  <FieldHint>Volumes are entered per department each month. Leave all unchecked to record the service for the whole hospital.</FieldHint>
                </fieldset>
              ) : null}
              <Button type="submit" disabled={pending || !choice}>
                <Plus /> Add service
              </Button>
            </>
          )}
        </ActionForm>
      ) : null}

      {services.length === 0 ? (
        <p className="text-sm text-muted">No services yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {services.map((s) => (
            <li key={s.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] md:items-start">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{s.name}</span>
                  {s.active ? null : <Badge tone="neutral">Inactive</Badge>}
                </p>
                <p className="text-xs text-muted">{SERVICE_CATEGORIES[s.category]}</p>
                <p className="mt-1 text-xs">{s.currentPrice ? <span className="figure text-ink-soft">{s.currentPrice}</span> : <span className="text-caution">No price yet</span>}</p>
              </div>
              <ServiceDepartments service={s} departments={departments} canEdit={canEdit && s.active} save={(ids) => setDepartments(s.id, ids)} />
              <div className="flex flex-wrap gap-1 md:justify-end">
                <Link
                  href={`/hospitals/${hospitalId}/services/${s.id}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-brand-blue-700 hover:bg-brand-blue-50"
                >
                  <BarChart3 aria-hidden className="size-4" /> Analytics
                </Link>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant={s.active ? "danger" : "secondary"}
                    disabled={runner.pending}
                    onClick={() => runner.run(() => setActive(s.id, !s.active), `${s.name} ${s.active ? "deactivated" : "reactivated"}.`)}
                  >
                    {s.active ? "Deactivate" : "Reactivate"}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Feedback error={runner.error} notice={runner.notice} />
    </div>
  );
}
