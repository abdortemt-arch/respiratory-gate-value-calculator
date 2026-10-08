"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { COST_BASES, COST_CATEGORIES, type CostBasis, type CostCategory } from "@/domain/hospital";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select } from "@/components/ui/field";
import { ActionForm, Checkbox, Feedback, useActionRunner, type Result } from "./forms";
import { VoidButton } from "./void-button";

export interface CostHistoryEntry {
  readonly id: string;
  readonly period: string;
  readonly amount: string;
  readonly status: "Current" | "Scheduled" | "Past" | "Voided";
  readonly notes: string | null;
  readonly changeReason: string | null;
  readonly entered: string;
  readonly voidReason: string | null;
}

export interface CostItemView {
  readonly id: string;
  readonly name: string;
  readonly category: CostCategory;
  readonly basis: CostBasis;
  readonly unitLabel: string;
  readonly active: boolean;
  readonly endedFrom: string | null;
  readonly isRtStaff: boolean;
  readonly linked: string | null;
  /** e.g. "EGP 450 per circuit since Jan 2026" */
  readonly current: string | null;
  readonly history: readonly CostHistoryEntry[];
}

type Variant = "costs" | "staffing" | "equipment";

const AMOUNT_LABEL: Record<CostBasis, string> = {
  per_unit: "Unit cost",
  monthly: "Monthly amount",
  per_service_unit: "Cost per service unit",
};

function NewCostItem({
  variant,
  services,
  departments,
  equipment,
  defaultMonth,
  create,
}: {
  variant: Variant;
  services: readonly { id: string; name: string }[];
  departments: readonly { id: string; name: string }[];
  equipment: readonly { id: string; name: string }[];
  defaultMonth: string;
  create: (form: FormData) => Promise<Result>;
}) {
  const staffing = variant === "staffing";
  const [basis, setBasis] = useState<CostBasis>(staffing ? "per_unit" : variant === "equipment" ? "monthly" : "per_unit");
  const categories = Object.entries(COST_CATEGORIES).filter(([c]) =>
    staffing ? c === "staffing" : variant === "equipment" ? c === "equipment" || c === "maintenance" || c === "contract" : c !== "staffing",
  );
  return (
    <ActionForm action={create} success={(_, f) => `${f.get("name")} added.`} className="rounded-xl border border-line bg-surface/60 p-4">
      {(pending) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor={`ci-${variant}-name`}>{staffing ? "Role / position" : "Cost item"}</Label>
              <Input
                id={`ci-${variant}-name`}
                name="name"
                required
                maxLength={160}
                autoComplete="off"
                placeholder={staffing ? "e.g. Respiratory therapist" : variant === "equipment" ? "e.g. Ventilator rental" : "e.g. Ventilator circuit"}
              />
            </div>
            {staffing ? (
              <input type="hidden" name="category" value="staffing" />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={`ci-${variant}-category`}>Category</Label>
                <Select id={`ci-${variant}-category`} name="category" defaultValue={categories[0][0]}>
                  {categories.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {staffing ? (
              <input type="hidden" name="basis" value="per_unit" />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={`ci-${variant}-basis`}>How it is costed</Label>
                <Select id={`ci-${variant}-basis`} name="basis" value={basis} onChange={(e) => setBasis(e.target.value as CostBasis)}>
                  {Object.entries(COST_BASES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {staffing ? (
              <input type="hidden" name="unitLabel" value="FTE" />
            ) : basis !== "monthly" ? (
              <div className="space-y-1.5">
                <Label htmlFor={`ci-${variant}-unit`}>Unit</Label>
                <Input id={`ci-${variant}-unit`} name="unitLabel" maxLength={40} placeholder="e.g. circuit, mask, cylinder" />
              </div>
            ) : null}
            {basis === "per_service_unit" ? (
              <div className="space-y-1.5">
                <Label htmlFor={`ci-${variant}-service`}>Linked service</Label>
                <Select id={`ci-${variant}-service`} name="hospitalServiceId" required defaultValue="">
                  <option value="" disabled>
                    Choose…
                  </option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            {departments.length ? (
              <div className="space-y-1.5">
                <Label htmlFor={`ci-${variant}-dept`}>Department</Label>
                <Select id={`ci-${variant}-dept`} name="departmentId" defaultValue="">
                  <option value="">Whole hospital</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            {variant === "equipment" && equipment.length ? (
              <div className="space-y-1.5">
                <Label htmlFor={`ci-${variant}-equipment`}>Equipment</Label>
                <Select id={`ci-${variant}-equipment`} name="equipmentId" defaultValue="">
                  <option value="">Not linked</option>
                  {equipment.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor={`ci-${variant}-amount`}>{staffing ? "Monthly cost per FTE (EGP)" : `${AMOUNT_LABEL[basis]} (EGP)`}</Label>
              <Input id={`ci-${variant}-amount`} name="amount" inputMode="decimal" className="figure text-right" placeholder="Unknown" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ci-${variant}-from`}>Effective from</Label>
              <Input id={`ci-${variant}-from`} name="effectiveFrom" type="month" defaultValue={defaultMonth} />
            </div>
          </div>
          {staffing ? <Checkbox name="isRtStaff" defaultChecked label="Counts as respiratory therapist (for revenue per RT)" /> : null}
          <FieldHint>
            {staffing
              ? "Salary and on-costs per FTE per month. The number of FTEs is entered in each monthly period."
              : basis === "per_unit"
                ? "The quantity used is entered in each monthly period."
                : basis === "monthly"
                  ? "Charged every month the item is active."
                  : "Multiplied by the linked service's volume each month."}{" "}
            Leave the cost blank if it is not known yet — it shows as data required.
          </FieldHint>
          <Button type="submit" disabled={pending}>
            <Plus /> {staffing ? "Add role" : "Add cost item"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

function CostItemRow({
  item,
  canEdit,
  defaultMonth,
  addVersion,
  setActive,
  voidVersion,
}: {
  item: CostItemView;
  canEdit: boolean;
  defaultMonth: string;
  addVersion: (form: FormData) => Promise<Result>;
  setActive: (costItemId: string, active: boolean, endedFrom?: string) => Promise<Result>;
  voidVersion: (versionId: string, reason: string) => Promise<Result>;
}) {
  const [open, setOpen] = useState(false);
  const [stopMonth, setStopMonth] = useState(defaultMonth);
  const runner = useActionRunner();
  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 items-start gap-2 text-left">
          {open ? <ChevronDown aria-hidden className="mt-0.5 size-4 shrink-0" /> : <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0" />}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{item.name}</span>
              {item.active ? null : <Badge tone="neutral">Ended {item.endedFrom ?? ""}</Badge>}
              {item.isRtStaff ? <Badge tone="blue">RT</Badge> : null}
            </span>
            <span className="block text-xs text-muted">
              {COST_CATEGORIES[item.category]} · {COST_BASES[item.basis]}
              {item.linked ? ` · ${item.linked}` : ""}
            </span>
          </span>
        </button>
        <span className="figure text-sm">{item.current ?? <span className="text-caution">Cost required</span>}</span>
      </div>
      {open ? (
        <div className="mt-4 space-y-4 pl-6">
          <div className="relative overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-surface/60">
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Effective</th>
                  <th scope="col" className="px-3 py-2 font-medium">Cost</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Notes</th>
                  <th scope="col" className="px-3 py-2 font-medium">Entered</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {item.history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-sm text-muted">No cost recorded yet.</td>
                  </tr>
                ) : (
                  item.history.map((h) => (
                    <tr key={h.id} className={h.status === "Voided" ? "text-muted" : undefined}>
                      <td className={`px-3 py-2 whitespace-nowrap ${h.status === "Voided" ? "line-through" : ""}`}>{h.period}</td>
                      <td className={`figure px-3 py-2 whitespace-nowrap ${h.status === "Voided" ? "line-through" : "font-medium"}`}>{h.amount}</td>
                      <td className="px-3 py-2">
                        <Badge tone={h.status === "Current" ? "orange" : h.status === "Scheduled" ? "blue" : "neutral"}>{h.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {h.notes}
                        {h.changeReason ? <span className="block text-caution">Correction: {h.changeReason}</span> : null}
                        {h.voidReason ? <span className="block">Void reason: {h.voidReason}</span> : null}
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted">{h.entered}</td>
                      <td className="px-3 py-2 text-right">
                        {canEdit && h.status !== "Voided" ? <VoidButton label={`${item.name} cost (${h.period})`} action={(reason) => voidVersion(h.id, reason)} /> : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {canEdit ? (
            <>
              <ActionForm action={addVersion} success="New cost recorded. Earlier months keep their own costs." className="rounded-xl border border-line p-3">
                {(pending) => (
                  <>
                    <input type="hidden" name="costItemId" value={item.id} />
                    <div className="grid gap-3 sm:grid-cols-[9rem_11rem_minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="space-y-1.5">
                        <Label htmlFor={`cv-${item.id}-amount`}>New cost (EGP)</Label>
                        <Input id={`cv-${item.id}-amount`} name="amount" required inputMode="decimal" className="figure text-right" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`cv-${item.id}-from`}>Effective from</Label>
                        <Input id={`cv-${item.id}-from`} name="effectiveFrom" type="month" required defaultValue={defaultMonth} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`cv-${item.id}-notes`}>Notes</Label>
                        <Input id={`cv-${item.id}-notes`} name="notes" maxLength={1000} placeholder="e.g. New supplier contract" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`cv-${item.id}-reason`}>Reason (corrections)</Label>
                        <Input id={`cv-${item.id}-reason`} name="changeReason" maxLength={500} placeholder="If it changes a finalized month" />
                      </div>
                    </div>
                    <Button type="submit" size="sm" disabled={pending}>
                      Add cost version
                    </Button>
                  </>
                )}
              </ActionForm>
              <div className="flex flex-wrap items-end gap-2">
                {item.active ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor={`stop-${item.id}`}>No longer applies from</Label>
                      <Input id={`stop-${item.id}`} type="month" value={stopMonth} onChange={(e) => setStopMonth(e.target.value)} className="h-9 w-44" />
                    </div>
                    <Button size="sm" variant="danger" disabled={runner.pending} onClick={() => runner.run(() => setActive(item.id, false, stopMonth), `${item.name} ends from ${stopMonth}.`)}>
                      End this cost
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" disabled={runner.pending} onClick={() => runner.run(() => setActive(item.id, true), `${item.name} resumed.`)}>
                    Resume
                  </Button>
                )}
              </div>
              <Feedback error={runner.error} notice={runner.notice} />
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function CostItemsManager({
  variant,
  items,
  canEdit,
  defaultMonth,
  services,
  departments,
  equipment,
  create,
  addVersion,
  setActive,
  voidVersion,
}: {
  variant: Variant;
  items: readonly CostItemView[];
  canEdit: boolean;
  defaultMonth: string;
  services: readonly { id: string; name: string }[];
  departments: readonly { id: string; name: string }[];
  equipment: readonly { id: string; name: string }[];
  create: (form: FormData) => Promise<Result>;
  addVersion: (form: FormData) => Promise<Result>;
  setActive: (costItemId: string, active: boolean, endedFrom?: string) => Promise<Result>;
  voidVersion: (versionId: string, reason: string) => Promise<Result>;
}) {
  return (
    <div className="space-y-5">
      {canEdit ? <NewCostItem variant={variant} services={services} departments={departments} equipment={equipment} defaultMonth={defaultMonth} create={create} /> : null}
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing recorded yet. Operating cost stays “data required” until costs are entered — net value is never shown without it.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {items.map((item) => (
            <CostItemRow key={item.id} item={item} canEdit={canEdit} defaultMonth={defaultMonth} addVersion={addVersion} setActive={setActive} voidVersion={voidVersion} />
          ))}
        </ul>
      )}
    </div>
  );
}
