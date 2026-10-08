"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatEgp, formatPercent } from "@/domain/format";
import { SAVINGS_LEVEL_LABELS } from "@/domain/scenario";
import { scenarioQuery, type SavedScenario } from "@/lib/scenario-params";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";

type Result = { ok: boolean; error?: string };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function ScenarioAdmin({
  scenarios,
  canApprove,
  approve,
  makeDefault,
  archive,
}: {
  scenarios: readonly SavedScenario[];
  canApprove: boolean;
  approve: (id: string) => Promise<Result>;
  makeDefault: (id: string) => Promise<Result>;
  archive: (id: string) => Promise<Result>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
    });
  };

  return (
    <div className="space-y-3">
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">Scenario</th>
              <th scope="col" className="py-2 pr-3 font-medium">Selection</th>
              <th scope="col" className="py-2 pr-3 font-medium">Sensitivities</th>
              <th scope="col" className="py-2 pr-3 font-medium">Status</th>
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {scenarios.map((s) => (
              <tr key={s.id}>
                <td className="py-2.5 pr-3">
                  <Link href={`/overview${scenarioQuery(s.settings, s)}`} className="font-medium text-ink hover:underline">
                    {s.name}
                  </Link>
                  {s.isDefault ? <Badge tone="blue" className="ml-2">Default</Badge> : null}
                  <span className="block text-xs text-muted">{s.createdByName ? `Saved by ${s.createdByName}` : "Workbook reference"}</span>
                </td>
                <td className="figure py-2.5 pr-3 text-ink-soft">
                  {formatPercent(s.settings.occupancyRate)} · {formatEgp(s.settings.packagePrice)} · {SAVINGS_LEVEL_LABELS[s.settings.savingsLevel]}
                </td>
                <td className="figure py-2.5 pr-3 text-ink-soft">
                  {formatPercent(s.settings.sensitivities.low)} / {formatPercent(s.settings.sensitivities.mid)} / {formatPercent(s.settings.sensitivities.high)}
                </td>
                <td className="py-2.5 pr-3">
                  {s.status === "approved" ? (
                    <Badge tone="positive">
                      Approved{s.approvedAt ? ` ${dateFormat.format(new Date(s.approvedAt))}` : ""}
                      {s.approvedByName ? ` · ${s.approvedByName}` : ""}
                    </Badge>
                  ) : (
                    <Badge>Draft</Badge>
                  )}
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  {canApprove ? (
                    <span className="inline-flex gap-2">
                      {s.status !== "approved" ? (
                        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => approve(s.id))}>
                          Approve
                        </Button>
                      ) : null}
                      {!s.isDefault ? (
                        <>
                          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => makeDefault(s.id))}>
                            Make default
                          </Button>
                          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => archive(s.id))}>
                            Archive
                          </Button>
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Approval freezes the inputs and results at that moment. Changing an approved scenario&apos;s numbers returns it to draft.
      </p>
    </div>
  );
}
