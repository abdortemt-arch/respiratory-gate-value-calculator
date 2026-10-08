import type { Metadata } from "next";
import Link from "next/link";
import { getInputDefinition, isInputKey } from "@/domain/inputs/catalog";
import { formatInputValue } from "@/domain/inputs/display";
import { ROLE_LABELS, type AppRole } from "@/domain/access";
import { formatEgp, formatPercent } from "@/domain/format";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Audit" };

const PAGE_SIZE = 50;
const ENTITY_LABELS = {
  hospital_input: "Input",
  scenario_assumption: "Scenario",
  profile: "User",
  organization: "Organisation",
} as const;
type EntityType = keyof typeof ENTITY_LABELS;

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

function describe(entityType: string, field: string, value: string | null): string {
  if (value === null) return entityType === "hospital_input" ? "Blank (unknown)" : "—";
  if (entityType === "hospital_input") {
    const key = field.replace(/\.text$/, "");
    if (field.endsWith(".text") || !isInputKey(key)) return value;
    return formatInputValue(getInputDefinition(key), Number(value));
  }
  if (entityType === "scenario_assumption") return SCENARIO_FIELDS[field]?.format?.(value) ?? value;
  if (entityType === "profile" && field === "role") return ROLE_LABELS[value as AppRole] ?? value;
  if (entityType === "profile" && field === "active") return value === "true" ? "Active" : "Deactivated";
  return value;
}

function fieldLabel(entityType: string, field: string): string {
  if (entityType === "hospital_input") {
    const key = field.replace(/\.text$/, "");
    const base = isInputKey(key) ? getInputDefinition(key).label : key;
    return field.endsWith(".text") ? `${base} — note` : base;
  }
  if (entityType === "scenario_assumption") return SCENARIO_FIELDS[field]?.label ?? field;
  if (entityType === "profile") return { role: "Role", active: "Access", full_name: "Name" }[field] ?? field;
  return field === "name" ? "Organisation name" : field;
}

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const user = await requireUser("view_audit");
  const sp = await searchParams;
  const type = typeof sp.type === "string" && sp.type in ENTITY_LABELS ? (sp.type as EntityType) : null;
  const key = typeof sp.key === "string" && isInputKey(sp.key) ? sp.key : null;
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .eq("organization_id", user.organizationId)
    .order("changed_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (type) query = query.eq("entity_type", type);
  if (key) query = query.in("field_name", [key, `${key}.text`]);

  const [{ data: rows, count, error }, scenarios, profiles] = await Promise.all([
    query,
    supabase.from("scenario_assumptions").select("id, scenario_name").eq("organization_id", user.organizationId),
    supabase.from("profiles").select("id, full_name").eq("organization_id", user.organizationId),
  ]);
  if (error) throw error;
  const scenarioNames = new Map((scenarios.data ?? []).map((s) => [s.id, s.scenario_name]));
  const profileNames = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name]));
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const subject = (entityType: string, entityId: string) => {
    if (entityType === "scenario_assumption") return scenarioNames.get(entityId) ?? "Deleted scenario";
    if (entityType === "profile") return profileNames.get(entityId) ?? "Removed user";
    return null;
  };
  const href = (p: number) => {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (key) q.set("key", key);
    if (p > 1) q.set("page", String(p));
    return `/audit${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Audit"
        description="Every change to hospital inputs, assumptions, scenarios and user access — who, when, previous value and new value. Entries are written by the database and cannot be edited."
      />
      <form className="no-print mb-4 flex flex-wrap items-end gap-3" action="/audit">
        <label className="space-y-1.5 text-sm font-medium">
          <span className="block">Type</span>
          <Select name="type" defaultValue={type ?? ""} className="w-48">
            <option value="">All changes</option>
            {Object.entries(ENTITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        {key ? <input type="hidden" name="key" value={key} /> : null}
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {key ? (
          <span className="flex items-center gap-2 text-sm text-muted">
            Showing <Badge tone="blue">{getInputDefinition(key).label}</Badge>
            <Link href="/audit" className="text-brand-blue-700 hover:underline">
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
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="py-2.5 pr-3 font-medium">When (Cairo)</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Who</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">What changed</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Previous value</th>
                  <th scope="col" className="py-2.5 font-medium">New value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const subj = subject(r.entity_type, r.entity_id);
                  const inputKey = r.field_name.replace(/\.text$/, "");
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="figure py-2.5 pr-3 whitespace-nowrap text-ink-soft">{dateFormat.format(new Date(r.changed_at))}</td>
                      <td className="py-2.5 pr-3 font-medium text-ink">{r.actor_name ?? "System"}</td>
                      <td className="py-2.5 pr-3">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge tone="neutral">{ENTITY_LABELS[r.entity_type as EntityType] ?? r.entity_type}</Badge>
                          {r.entity_type === "hospital_input" && isInputKey(inputKey) ? (
                            <Link href={`/audit?key=${inputKey}`} className="font-medium text-ink hover:underline">
                              {fieldLabel(r.entity_type, r.field_name)}
                            </Link>
                          ) : (
                            <span className="font-medium text-ink">{fieldLabel(r.entity_type, r.field_name)}</span>
                          )}
                          {r.action !== "update" ? <Badge tone="blue">{r.action === "insert" ? "Created" : "Deleted"}</Badge> : null}
                        </span>
                        {subj ? <span className="mt-0.5 block text-xs text-muted">{subj}</span> : null}
                      </td>
                      <td className="figure py-2.5 pr-3 text-ink-soft">{describe(r.entity_type, r.field_name, r.old_value)}</td>
                      <td className="figure py-2.5 font-medium text-ink">{describe(r.entity_type, r.field_name, r.new_value)}</td>
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
