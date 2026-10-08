import type { Metadata } from "next";
import { can, canEditInputSource } from "@/domain/access";
import { completeness } from "@/domain/calculations/completeness";
import { plausibilityWarnings } from "@/domain/calculations/validation";
import { definitionsInGroup, HOSPITAL_INPUT_GROUPS, INPUT_GROUPS, type InputKey } from "@/domain/inputs/catalog";
import { PageHeader } from "@/components/layout/app-shell";
import { InputField } from "@/components/inputs/input-field";
import { CompletenessBar } from "@/components/metrics/completeness";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { loadWorkspace } from "@/server/data/workspace";
import { updateInput } from "./actions";

export const metadata: Metadata = { title: "Hospital Inputs" };

export default async function InputsPage() {
  const user = await requireUser();
  const ws = await loadWorkspace(user);
  const c = completeness(ws.values);
  const warnings = new Map<InputKey, string>();
  for (const w of plausibilityWarnings(ws.values, ws.texts)) warnings.set(w.keys[0], w.message);
  const groups = INPUT_GROUPS.filter((g) => HOSPITAL_INPUT_GROUPS.includes(g.id));

  return (
    <>
      <PageHeader
        title="Hospital Inputs"
        description="Operational and financial data from the hospital. All figures are annual unless stated. Leave a field blank when the value is unknown — it stays visibly marked instead of being treated as zero. Enter 0 only when the true value is zero."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]">
        <Card className="p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink-soft">Model inputs entered</p>
              <p className="figure text-2xl font-semibold">
                {c.model.entered} <span className="text-base font-normal text-muted">of {c.model.total}</span>
              </p>
              <CompletenessBar count={c.model} />
              <p className="text-xs text-muted">Inputs that feed revenue, savings or the value bridge.</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink-soft">All requested data</p>
              <p className="figure text-2xl font-semibold">
                {c.all.entered} <span className="text-base font-normal text-muted">of {c.all.total}</span>
              </p>
              <CompletenessBar count={c.all} />
              <p className="text-xs text-muted">Includes informational data collected for later analysis.</p>
            </div>
          </div>
        </Card>
        <nav aria-label="Input groups" className="no-print flex flex-wrap content-start gap-2 md:max-w-xs">
          {groups.map((g) => {
            const gc = c.byGroup[g.id];
            return (
              <a
                key={g.id}
                href={`#group-${g.id}`}
                className="rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-ink-soft hover:border-brand-blue hover:text-brand-blue-700"
              >
                {g.label}
                {gc ? <span className="figure ml-1 text-muted">{gc.entered}/{gc.total}</span> : null}
              </a>
            );
          })}
        </nav>
      </div>

      {ws.missingRows.length > 0 ? (
        <Alert tone="danger" title="Database setup incomplete" className="mb-6">
          {ws.missingRows.length} inputs have no database row. Apply the latest Supabase migrations.
        </Alert>
      ) : null}

      <div className="space-y-6">
        {groups.map((g) => {
          const gc = c.byGroup[g.id];
          return (
            <Card key={g.id} id={`group-${g.id}`} className="scroll-mt-20">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{g.label}</CardTitle>
                  {gc ? (
                    <Badge tone={gc.entered === gc.total ? "positive" : "neutral"}>
                      {gc.entered} of {gc.total} entered
                    </Badge>
                  ) : null}
                </div>
                <CardDescription>{g.description}</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-line pt-1">
                {definitionsInGroup(g.id).map((def) => {
                  const key = def.key as InputKey;
                  const meta = ws.meta[key];
                  return (
                    <InputField
                      key={key}
                      inputKey={key}
                      value={ws.values[key]}
                      text={ws.texts[key] ?? null}
                      editable={Boolean(meta) && canEditInputSource(user.role, def.source)}
                      updatedAt={meta?.updatedAt ?? null}
                      updatedByName={meta?.updatedByName ?? null}
                      warning={warnings.get(key)}
                      auditHref={can(user.role, "view_audit") ? `/audit?key=${key}` : undefined}
                      save={updateInput}
                    />
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
