"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { PERIOD_STATUSES, SAVINGS_CATEGORIES, type PeriodStatus, type SavingsCategory } from "@/domain/hospital";
import { formatEgp } from "@/domain/format";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select } from "@/components/ui/field";
import { ActionForm, Feedback, useActionRunner, type Result } from "./forms";

// ── Generic grid ─────────────────────────────────────────────────────────────

export interface GridColumn {
  readonly key: string;
  readonly label: string;
  /** Integer-only column (patients, admissions). */
  readonly integer?: boolean;
}

export interface GridRow {
  readonly id: string;
  /** Accessible name of the row, e.g. "NIV — AICU". */
  readonly name: string;
  readonly labels: readonly ReactNode[];
  readonly values: Readonly<Record<string, number | null>>;
  /** Read-only cells after the inputs (e.g. calculated revenue). */
  readonly extra?: readonly ReactNode[];
}

const toText = (v: number | null) => (v === null ? "" : String(v));

function NumberGrid({
  labelHeaders,
  columns,
  extraHeaders = [],
  rows,
  editable,
  correction,
  saveLabel,
  onSave,
  footer,
}: {
  labelHeaders: readonly string[];
  columns: readonly GridColumn[];
  extraHeaders?: readonly string[];
  rows: readonly GridRow[];
  editable: boolean;
  /** Closed period: an Admin correction that needs a reason. */
  correction: boolean;
  saveLabel: string;
  onSave: (changes: { id: string; values: Record<string, string> }[], reason: string) => Promise<Result>;
  footer?: ReactNode;
}) {
  const initial = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.id, Object.fromEntries(columns.map((c) => [c.key, toText(r.values[c.key] ?? null)]))])),
    [rows, columns],
  );
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>(initial);
  const [reason, setReason] = useState("");
  const runner = useActionRunner();
  // Re-sync when the saved values change (after a save and refresh).
  const initialKey = JSON.stringify(initial);
  const [seenKey, setSeenKey] = useState(initialKey);
  if (seenKey !== initialKey) {
    setSeenKey(initialKey);
    setDraft(initial);
  }
  const changed = rows.filter((r) => columns.some((c) => (draft[r.id]?.[c.key] ?? "") !== initial[r.id][c.key]));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        runner.run(
          () => onSave(changed.map((r) => ({ id: r.id, values: draft[r.id] })), reason),
          "Saved. Figures recalculated.",
          () => setReason(""),
        );
      }}
    >
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              {labelHeaders.map((h) => (
                <th key={h} scope="col" className="py-2 pr-3 font-medium">
                  {h}
                </th>
              ))}
              {columns.map((c) => (
                <th key={c.key} scope="col" className="py-2 pr-3 text-right font-medium">
                  {c.label}
                </th>
              ))}
              {extraHeaders.map((h) => (
                <th key={h} scope="col" className="py-2 pr-3 text-right font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="align-middle">
                {r.labels.map((l, i) => (
                  <td key={i} className="py-2 pr-3">
                    {l}
                  </td>
                ))}
                {columns.map((c) => (
                  <td key={c.key} className="py-1.5 pr-3 text-right">
                    <Input
                      aria-label={`${r.name} ${c.label}`}
                      inputMode={c.integer ? "numeric" : "decimal"}
                      value={draft[r.id]?.[c.key] ?? ""}
                      disabled={!editable || runner.pending}
                      placeholder={editable ? "—" : "Not entered"}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.id]: { ...d[r.id], [c.key]: e.target.value } }))}
                      className="figure ml-auto h-9 w-28 text-right"
                    />
                  </td>
                ))}
                {(r.extra ?? []).map((x, i) => (
                  <td key={`x${i}`} className="figure py-2 pr-3 text-right whitespace-nowrap">
                    {x}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer ? <tfoot>{footer}</tfoot> : null}
        </table>
      </div>
      {editable ? (
        <div className="flex flex-wrap items-end gap-3">
          {correction ? (
            <div className="min-w-64 flex-1 space-y-1.5">
              <Label htmlFor={`reason-${saveLabel}`}>Reason for correction</Label>
              <Input id={`reason-${saveLabel}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Required: why this closed month changes" />
            </div>
          ) : null}
          <Button type="submit" disabled={runner.pending || changed.length === 0 || (correction && reason.trim().length < 3)}>
            {runner.pending ? "Saving…" : saveLabel}
          </Button>
          {changed.length ? <span className="text-xs text-muted">{changed.length} row{changed.length === 1 ? "" : "s"} changed</span> : null}
        </div>
      ) : null}
      <Feedback error={runner.error} notice={runner.notice} />
    </form>
  );
}

// ── Activity ─────────────────────────────────────────────────────────────────

export interface ActivitySlot {
  readonly hospitalServiceId: string;
  readonly departmentId: string | null;
  readonly serviceName: string;
  readonly departmentName: string;
  /** Price in force this month, as text; null when none. */
  readonly price: string | null;
  readonly volumeUnit: string;
  readonly quantity: number | null;
  readonly revenue: number | null;
}

export function ActivityEditor({
  slots,
  editable,
  correction,
  save,
}: {
  slots: readonly ActivitySlot[];
  editable: boolean;
  correction: boolean;
  save: (changes: { hospitalServiceId: string; departmentId: string | null; quantity: string }[], reason?: string) => Promise<Result>;
}) {
  if (slots.length === 0) return <p className="text-sm text-muted">No active services. Add services in Services.</p>;
  const total = slots.reduce((s, x) => s + (x.revenue ?? 0), 0);
  return (
    <NumberGrid
      labelHeaders={["Service", "Department", "Price in force"]}
      columns={[{ key: "quantity", label: "Volume" }]}
      extraHeaders={["Revenue"]}
      rows={slots.map((s) => ({
        id: `${s.hospitalServiceId}:${s.departmentId ?? ""}`,
        name: `${s.serviceName} — ${s.departmentName}`,
        labels: [
          <span key="s" className="font-medium text-ink">{s.serviceName}</span>,
          s.departmentName,
          s.price ? <span key="p" className="figure text-xs text-ink-soft">{s.price}</span> : <span key="p" className="text-xs text-caution">No price for this month</span>,
        ],
        values: { quantity: s.quantity },
        extra: [s.revenue === null ? <span key="r" className="text-muted">—</span> : formatEgp(s.revenue)],
      }))}
      editable={editable}
      correction={correction}
      saveLabel="Save volumes"
      onSave={(changes, reason) =>
        save(
          changes.map((c) => {
            const [hospitalServiceId, departmentId] = c.id.split(":");
            return { hospitalServiceId, departmentId: departmentId || null, quantity: c.values.quantity };
          }),
          reason,
        )
      }
      footer={
        <tr className="border-t border-line">
          <td colSpan={4} className="py-2 pr-3 text-xs text-muted">Revenue = volume × the price in force this month</td>
          <td className="figure py-2 pr-3 text-right font-semibold">{formatEgp(total)}</td>
        </tr>
      }
    />
  );
}

// ── Statistics ───────────────────────────────────────────────────────────────

export interface StatsRow {
  readonly departmentId: string | null;
  readonly name: string;
  readonly patients: number | null;
  readonly admissions: number | null;
  readonly occupiedBedDays: number | null;
  readonly ventilatorDays: number | null;
}

export function StatsEditor({
  rows,
  editable,
  correction,
  save,
}: {
  rows: readonly StatsRow[];
  editable: boolean;
  correction: boolean;
  save: (changes: { departmentId: string | null; patients: string; admissions: string; occupiedBedDays: string; ventilatorDays: string }[], reason?: string) => Promise<Result>;
}) {
  return (
    <NumberGrid
      labelHeaders={["Unit"]}
      columns={[
        { key: "patients", label: "Patients", integer: true },
        { key: "admissions", label: "Admissions", integer: true },
        { key: "occupiedBedDays", label: "Occupied bed-days" },
        { key: "ventilatorDays", label: "Ventilator days" },
      ]}
      rows={rows.map((r) => ({
        id: r.departmentId ?? "hospital",
        name: r.name,
        labels: [<span key="n" className="font-medium text-ink">{r.name}</span>],
        values: { patients: r.patients, admissions: r.admissions, occupiedBedDays: r.occupiedBedDays, ventilatorDays: r.ventilatorDays },
      }))}
      editable={editable}
      correction={correction}
      saveLabel="Save statistics"
      onSave={(changes, reason) =>
        save(
          changes.map((c) => ({
            departmentId: c.id === "hospital" ? null : c.id,
            patients: c.values.patients,
            admissions: c.values.admissions,
            occupiedBedDays: c.values.occupiedBedDays,
            ventilatorDays: c.values.ventilatorDays,
          })),
          reason,
        )
      }
    />
  );
}

// ── Cost quantities ──────────────────────────────────────────────────────────

export interface CostQuantityRow {
  readonly costItemId: string;
  readonly name: string;
  readonly category: string;
  /** Unit cost in force this month, as text. */
  readonly unitCost: string | null;
  readonly unitLabel: string;
  readonly quantity: number | null;
  readonly amount: number | null;
}

export function CostQuantityEditor({
  rows,
  editable,
  correction,
  save,
}: {
  rows: readonly CostQuantityRow[];
  editable: boolean;
  correction: boolean;
  save: (changes: { costItemId: string; quantity: string }[], reason?: string) => Promise<Result>;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">No per-unit cost items apply this month. Add consumables or staffing in Costs and Staffing.</p>;
  return (
    <NumberGrid
      labelHeaders={["Cost item", "Category", "Unit cost in force"]}
      columns={[{ key: "quantity", label: "Quantity" }]}
      extraHeaders={["Cost"]}
      rows={rows.map((r) => ({
        id: r.costItemId,
        name: r.name,
        labels: [
          <span key="n" className="font-medium text-ink">{r.name}</span>,
          r.category,
          r.unitCost ? <span key="u" className="figure text-xs text-ink-soft">{r.unitCost} / {r.unitLabel}</span> : <span key="u" className="text-xs text-caution">No cost for this month</span>,
        ],
        values: { quantity: r.quantity },
        extra: [r.amount === null ? <span key="a" className="text-caution">Data required</span> : formatEgp(r.amount)],
      }))}
      editable={editable}
      correction={correction}
      saveLabel="Save quantities"
      onSave={(changes, reason) => save(changes.map((c) => ({ costItemId: c.id, quantity: c.values.quantity })), reason)}
    />
  );
}

// ── Savings ──────────────────────────────────────────────────────────────────

export interface SavingsRow {
  readonly id: string;
  readonly category: SavingsCategory;
  readonly description: string;
  readonly amount: number;
}

export function SavingsEditor({
  rows,
  editable,
  correction,
  add,
  remove,
}: {
  rows: readonly SavingsRow[];
  editable: boolean;
  correction: boolean;
  add: (form: FormData) => Promise<Result>;
  remove: (id: string) => Promise<Result>;
}) {
  const runner = useActionRunner();
  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No documented savings this month. Savings are counted only when recorded — never estimated.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="font-medium text-ink">{r.description}</span>
                <span className="block text-xs text-muted">{SAVINGS_CATEGORIES[r.category]}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="figure font-medium">{formatEgp(r.amount)}</span>
                {editable && !correction ? (
                  <Button size="icon" variant="ghost" aria-label={`Remove ${r.description}`} disabled={runner.pending} onClick={() => runner.run(() => remove(r.id), "Removed.")}>
                    <Trash2 />
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Feedback error={runner.error} notice={runner.notice} />
      {editable ? (
        <ActionForm action={add} success="Saving recorded." className="rounded-xl border border-line bg-surface/60 p-4">
          {(pending) => (
            <>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_9rem]">
                <div className="space-y-1.5">
                  <Label htmlFor="sv-category">Category</Label>
                  <Select id="sv-category" name="category" defaultValue="oxygen_stewardship">
                    {Object.entries(SAVINGS_CATEGORIES).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sv-description">What was saved</Label>
                  <Input id="sv-description" name="description" required maxLength={300} placeholder="e.g. Oxygen flow protocol, 12 cylinders avoided" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sv-amount">Amount (EGP)</Label>
                  <Input id="sv-amount" name="amount" required inputMode="decimal" className="figure text-right" />
                </div>
                {correction ? (
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label htmlFor="sv-reason">Reason for correction</Label>
                    <Input id="sv-reason" name="changeReason" required minLength={3} maxLength={500} />
                  </div>
                ) : null}
              </div>
              <FieldHint>Record realised cost avoidance with its evidence. Workbook savings percentages are sensitivities, not entries here.</FieldHint>
              <Button type="submit" disabled={pending}>
                Add saving
              </Button>
            </>
          )}
        </ActionForm>
      ) : null}
    </div>
  );
}

// ── Status workflow ──────────────────────────────────────────────────────────

const TRANSITIONS: Record<PeriodStatus, { to: PeriodStatus; label: string; admin?: boolean; reason?: boolean; variant?: "primary" | "secondary" | "accent" }[]> = {
  draft: [{ to: "in_review", label: "Submit for review", variant: "secondary" }, { to: "finalized", label: "Finalize month", variant: "primary" }],
  in_review: [{ to: "draft", label: "Back to draft", variant: "secondary" }, { to: "finalized", label: "Finalize month", variant: "primary" }],
  finalized: [{ to: "locked", label: "Lock month", admin: true, variant: "primary" }, { to: "draft", label: "Reopen", admin: true, reason: true, variant: "secondary" }],
  locked: [{ to: "finalized", label: "Unlock", admin: true, reason: true, variant: "secondary" }],
};

export function PeriodStatusControls({
  status,
  role,
  canWrite,
  setStatus,
}: {
  status: PeriodStatus;
  role: "admin" | "manager" | "viewer";
  canWrite: boolean;
  setStatus: (status: string, reason?: string) => Promise<Result>;
}) {
  const router = useRouter();
  const runner = useActionRunner();
  const [asking, setAsking] = useState<PeriodStatus | null>(null);
  const [reason, setReason] = useState("");
  if (role === "viewer" || !canWrite) return null;
  const options = TRANSITIONS[status].filter((t) => !t.admin || role === "admin");
  if (options.length === 0) return <p className="text-xs text-muted">Only an Admin can lock, reopen or correct a {PERIOD_STATUSES[status].toLowerCase()} month.</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((t) => (
          <Button
            key={t.to}
            size="sm"
            variant={t.variant}
            disabled={runner.pending}
            onClick={() => {
              if (t.reason) {
                setAsking(t.to);
                return;
              }
              runner.run(() => setStatus(t.to), `Status changed to ${PERIOD_STATUSES[t.to].toLowerCase()}.`, () => router.refresh());
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {asking ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            runner.run(() => setStatus(asking, reason), `Status changed to ${PERIOD_STATUSES[asking].toLowerCase()}.`, () => {
              setAsking(null);
              setReason("");
            });
          }}
        >
          <div className="min-w-64 flex-1 space-y-1.5">
            <Label htmlFor="status-reason">Reason</Label>
            <Input id="status-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Why this month is being reopened" autoFocus />
          </div>
          <Button type="submit" size="sm" disabled={runner.pending || reason.trim().length < 3}>
            Confirm
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
            Cancel
          </Button>
        </form>
      ) : null}
      <Feedback error={runner.error} notice={runner.notice} />
    </div>
  );
}

// ── Create period ────────────────────────────────────────────────────────────

export function CreatePeriodForm({ hospitalId, defaultMonth, create }: { hospitalId: string; defaultMonth: string; create: (month: string) => Promise<Result> }) {
  const router = useRouter();
  const [month, setMonth] = useState(defaultMonth);
  const runner = useActionRunner();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        runner.run(() => create(month), undefined, () => router.push(`/hospitals/${hospitalId}/periods/${month}`));
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="period-month">Month</Label>
        <Input id="period-month" type="month" required value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" />
      </div>
      <Button type="submit" disabled={runner.pending || !month}>
        {runner.pending ? "Creating…" : "Create period"}
      </Button>
      <Feedback error={runner.error} notice={null} />
    </form>
  );
}
