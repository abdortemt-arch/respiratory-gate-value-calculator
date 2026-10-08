import Link from "next/link";
import { ROLE_LABELS, type AppRole } from "@/domain/access";
import { formatEgp, formatNumber, formatPercent } from "@/domain/format";
import { BILLING_UNITS, isOneOf, monthLabel, monthOf, PERIOD_STATUSES } from "@/domain/hospital";
import { getInputDefinition, isInputKey, type InputKey } from "@/domain/inputs/catalog";
import { formatInputValue } from "@/domain/inputs/display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/field";

const PAGE_SIZE = 50;

export const AUDIT_GROUPS = {
  hospital: { label: "Hospital & access", types: ["hospital", "hospital_member"] },
  configuration: { label: "Departments, services & equipment", types: ["department", "service", "hospital_service", "service_department", "equipment"] },
  pricing: { label: "Pricing", types: ["price_version"] },
  costs: { label: "Costs & staffing", types: ["cost_item", "cost_version"] },
  periods: { label: "Monthly periods", types: ["period", "service_activity", "period_stats", "cost_entry", "period_savings"] },
  workbook: { label: "Workbook model", types: ["hospital_input", "scenario_assumption"] },
  users: { label: "Users & organisation", types: ["profile", "organization"] },
} as const;
type Group = keyof typeof AUDIT_GROUPS;

const ENTITY_LABELS: Record<string, string> = {
  hospital_input: "Input",
  scenario_assumption: "Scenario",
  profile: "User",
  organization: "Organisation",
  hospital: "Hospital",
  hospital_member: "Access",
  department: "Department",
  service: "Service library",
  hospital_service: "Service",
  service_department: "Service in department",
  price_version: "Price",
  equipment: "Equipment",
  cost_item: "Cost item",
  cost_version: "Cost",
  period: "Period",
  service_activity: "Activity",
  period_stats: "Statistics",
  cost_entry: "Cost quantity",
  period_savings: "Savings",
};

const FIELD_LABELS: Record<string, string> = {
  created: "Created",
  deleted: "Deleted",
  name: "Name",
  code: "Code",
  hospital_type: "Type",
  total_beds: "Total beds",
  beds: "Beds",
  location: "Location",
  notes: "Notes",
  active: "Active",
  category: "Category",
  rt_coverage: "RT coverage",
  amount: "Amount",
  quantity: "Quantity",
  effective_from: "Effective from",
  voided: "Voided",
  void_reason: "Void reason",
  billing_unit: "Billing unit",
  status: "Status",
  role: "Role",
  patients: "Patients",
  admissions: "Admissions",
  occupied_bed_days: "Occupied bed-days",
  ventilator_days: "Ventilator days",
  description: "Description",
  ended_from: "Ended from",
  workbook_model_enabled: "Workbook model",
  full_name: "Name",
  ownership: "Ownership",
};

const SCENARIO_FIELDS: Record<string, { label: string; format?: (v: string) => string }> = {
  scenario_name: { label: "Name" },
  occupancy_rate: { label: "Occupancy", format: (v) => formatPercent(Number(v)) },
  package_price: { label: "Package price", format: (v) => formatEgp(Number(v)) },
  savings_level: { label: "Savings level" },
  low_savings_pct: { label: "Low sensitivity", format: (v) => formatPercent(Number(v)) },
  mid_savings_pct: { label: "Mid sensitivity", format: (v) => formatPercent(Number(v)) },
  high_savings_pct: { label: "High sensitivity", format: (v) => formatPercent(Number(v)) },
  is_default: { label: "Default scenario", format: (v) => (v === "true" ? "Yes" : "No") },
  status: { label: "Status" },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Cairo",
});

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

function plain(field: string, value: string): string {
  if (value === "true") return field === "voided" ? "Voided" : "Yes";
  if (value === "false") return field === "voided" ? "Not voided" : "No";
  if ((field === "effective_from" || field === "ended_from" || field === "period_month") && isDate(value)) return monthLabel(monthOf(value));
  if (field === "amount") return formatEgp(Number(value));
  if (field === "billing_unit" && isOneOf(BILLING_UNITS, value)) return BILLING_UNITS[value].label;
  if (field === "status" && isOneOf(PERIOD_STATUSES, value)) return PERIOD_STATUSES[value];
  if (/^-?\d+(\.\d+)?$/.test(value)) return formatNumber(Number(value));
  return value;
}

/** One-line summary of a created or deleted record (stored as JSON). */
function summarize(json: string): string {
  try {
    const r = JSON.parse(json) as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof r.amount === "number" || typeof r.amount === "string") parts.push(formatEgp(Number(r.amount)));
    if (typeof r.billing_unit === "string") parts.push(plain("billing_unit", r.billing_unit).toLowerCase());
    if (typeof r.effective_from === "string") parts.push(`from ${plain("effective_from", r.effective_from)}`);
    if (typeof r.period_month === "string") parts.push(plain("period_month", r.period_month));
    if (r.quantity !== undefined && r.quantity !== null) parts.push(`quantity ${formatNumber(Number(r.quantity))}`);
    if (typeof r.beds === "number") parts.push(`${r.beds} beds`);
    if (typeof r.role === "string") parts.push(ROLE_LABELS[r.role as AppRole] ?? r.role);
    if (typeof r.basis === "string") parts.push(r.basis.replace(/_/g, " "));
    return parts.join(" · ") || "Created";
  } catch {
    return json;
  }
}

function describe(entityType: string, field: string, value: string | null): string {
  if (value === null) return entityType === "hospital_input" ? "Blank (unknown)" : "—";
  if (field === "created" || field === "deleted") return summarize(value);
  if (entityType === "hospital_input") {
    const key = field.replace(/\.text$/, "");
    if (field.endsWith(".text") || !isInputKey(key)) return value;
    return formatInputValue(getInputDefinition(key), Number(value));
  }
  if (entityType === "scenario_assumption") return SCENARIO_FIELDS[field]?.format?.(value) ?? value;
  if (entityType === "profile" && field === "role") return ROLE_LABELS[value as AppRole] ?? value;
  if (entityType === "profile" && field === "active") return value === "true" ? "Active" : "Deactivated";
  return plain(field, value);
}

function fieldLabel(entityType: string, field: string): string {
  if (entityType === "hospital_input") {
    const key = field.replace(/\.text$/, "");
    const base = isInputKey(key) ? getInputDefinition(key).label : key;
    return field.endsWith(".text") ? `${base} — note` : base;
  }
  if (entityType === "scenario_assumption") return SCENARIO_FIELDS[field]?.label ?? field;
  if (entityType === "organization" && field === "name") return "Organisation name";
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

export interface AuditFilters {
  readonly group: Group | null;
  readonly key: InputKey | null;
  readonly corrections: boolean;
  /** Hospital chosen in the filter (global page) or the page's hospital. */
  readonly hospital: string | null;
  readonly page: number;
}

/** Read filters from the query string. */
export function auditFilters(sp: Record<string, string | string[] | undefined>, hospitalId?: string): AuditFilters {
  return {
    group: typeof sp.type === "string" && sp.type in AUDIT_GROUPS ? (sp.type as Group) : null,
    key: typeof sp.key === "string" && isInputKey(sp.key) ? sp.key : null,
    corrections: sp.corrections === "1",
    hospital: hospitalId ?? (typeof sp.hospital === "string" && /^[0-9a-f-]{36}$/i.test(sp.hospital) ? sp.hospital : null),
    page: Math.max(1, Number(sp.page) || 1),
  };
}

export const AUDIT_PAGE_SIZE = PAGE_SIZE;

export interface AuditRow {
  readonly id: number;
  readonly changed_at: string;
  readonly actor_name: string | null;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly entity_label: string | null;
  readonly field_name: string;
  readonly old_value: string | null;
  readonly new_value: string | null;
  readonly action: string;
  readonly reason: string | null;
  readonly hospital_id: string | null;
  readonly period_id: string | null;
}

export interface AuditData {
  readonly rows: readonly AuditRow[];
  readonly total: number;
  readonly hospitals: readonly { id: string; name: string }[];
  readonly periodMonths: Readonly<Record<string, string>>;
  readonly profileNames: Readonly<Record<string, string>>;
}

/**
 * The audit trail written by database triggers. Row-level security limits it
 * to what the viewer may see (Admins: everything; managers: their hospitals).
 */
export function AuditLog({
  basePath,
  hospitalId,
  filters,
  data,
}: {
  /** Page the filters and pagination link to. */
  basePath: string;
  /** Limit to one hospital (hospital audit page). */
  hospitalId?: string;
  filters: AuditFilters;
  data: AuditData;
}) {
  const { group, key, corrections, page } = filters;
  const filterHospital = filters.hospital;
  const { rows, total } = data;
  const hospitalNames = new Map(data.hospitals.map((h) => [h.id, h.name]));
  const periodMonths = new Map(Object.entries(data.periodMonths));
  const profileNames = new Map(Object.entries(data.profileNames));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (p: number) => {
    const q = new URLSearchParams();
    if (group) q.set("type", group);
    if (key) q.set("key", key);
    if (corrections) q.set("corrections", "1");
    if (!hospitalId && filterHospital) q.set("hospital", filterHospital);
    if (p > 1) q.set("page", String(p));
    return `${basePath}${q.size ? `?${q}` : ""}`;
  };
  const inputHistory = (hid: string | null, k: string) => (hid ? `/hospitals/${hid}/audit?key=${k}` : `${basePath}?key=${k}`);

  return (
    <>
      <form className="no-print mb-4 flex flex-wrap items-end gap-3" action={basePath}>
        <div className="space-y-1.5 text-sm font-medium">
          <label htmlFor="audit-type" className="block">
            Type
          </label>
          <Select id="audit-type" name="type" defaultValue={group ?? ""} className="w-60">
            <option value="">All changes</option>
            {Object.entries(AUDIT_GROUPS).map(([value, g]) => (
              <option key={value} value={value}>
                {g.label}
              </option>
            ))}
          </Select>
        </div>
        {!hospitalId && data.hospitals.length > 1 ? (
          <div className="space-y-1.5 text-sm font-medium">
            <label htmlFor="audit-hospital" className="block">
              Hospital
            </label>
            <Select id="audit-hospital" name="hospital" defaultValue={filterHospital ?? ""} className="w-56">
              <option value="">All hospitals</option>
              {data.hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="corrections" value="1" defaultChecked={corrections} className="size-4 accent-brand-blue" />
          Historical corrections only
        </label>
        {key ? <input type="hidden" name="key" value={key} /> : null}
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {key ? (
          <span className="flex items-center gap-2 text-sm text-muted">
            Showing <Badge tone="blue">{getInputDefinition(key).label}</Badge>
            <Link href={basePath} className="text-brand-blue-700 hover:underline">
              Clear
            </Link>
          </span>
        ) : null}
      </form>

      <Card>
        <CardContent className="relative overflow-x-auto pt-2">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No changes recorded yet.</p>
          ) : (
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="py-2.5 pr-3 font-medium">When (Cairo)</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Who</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">What changed</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Previous value</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">New value</th>
                  <th scope="col" className="py-2.5 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const inputKey = r.field_name.replace(/\.text$/, "");
                  const subject =
                    r.entity_label ??
                    (r.entity_type === "profile" ? (profileNames.get(r.entity_id) ?? "Removed user") : null);
                  const context = [
                    !hospitalId && r.hospital_id ? (hospitalNames.get(r.hospital_id) ?? "Hospital") : null,
                    r.period_id && periodMonths.has(r.period_id) ? monthLabel(periodMonths.get(r.period_id)!) : null,
                  ].filter(Boolean);
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="figure py-2.5 pr-3 whitespace-nowrap text-ink-soft">{dateFormat.format(new Date(r.changed_at))}</td>
                      <td className="py-2.5 pr-3 font-medium text-ink">{r.actor_name ?? "System"}</td>
                      <td className="py-2.5 pr-3">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge tone="neutral">{ENTITY_LABELS[r.entity_type] ?? r.entity_type}</Badge>
                          {r.entity_type === "hospital_input" && isInputKey(inputKey) ? (
                            <Link href={inputHistory(r.hospital_id, inputKey)} className="font-medium text-ink hover:underline">
                              {fieldLabel(r.entity_type, r.field_name)}
                            </Link>
                          ) : (
                            <span className="font-medium text-ink">{fieldLabel(r.entity_type, r.field_name)}</span>
                          )}
                          {r.action === "correction" ? <Badge tone="caution">Correction</Badge> : null}
                          {r.action === "status" ? <Badge tone="blue">Status</Badge> : null}
                          {r.action === "insert" && r.field_name !== "created" ? <Badge tone="blue">Created</Badge> : null}
                          {r.action === "delete" && r.field_name !== "deleted" ? <Badge tone="blue">Deleted</Badge> : null}
                        </span>
                        {subject ? <span className="mt-0.5 block text-xs text-ink-soft">{subject}</span> : null}
                        {context.length ? <span className="block text-xs text-muted">{context.join(" · ")}</span> : null}
                      </td>
                      <td className="figure max-w-60 py-2.5 pr-3 break-words text-ink-soft">{describe(r.entity_type, r.field_name, r.old_value)}</td>
                      <td className="figure max-w-60 py-2.5 pr-3 font-medium break-words text-ink">{describe(r.entity_type, r.field_name, r.new_value)}</td>
                      <td className="max-w-56 py-2.5 text-xs break-words text-ink-soft">{r.reason ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">
            {total} changes · page {page} of {pages}
          </span>
          <span className="flex gap-2">
            {page > 1 ? (
              <Link className="rounded-lg border border-line bg-card px-3 py-1.5" href={href(page - 1)}>
                Newer
              </Link>
            ) : null}
            {page < pages ? (
              <Link className="rounded-lg border border-line bg-card px-3 py-1.5" href={href(page + 1)}>
                Older
              </Link>
            ) : null}
          </span>
        </nav>
      ) : null}
    </>
  );
}
