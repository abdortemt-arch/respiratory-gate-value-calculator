import type { Metadata } from "next";
import { canEditInputSource } from "@/domain/access";
import { definitionsInGroup, type InputKey } from "@/domain/inputs/catalog";
import { WORKBOOK_DEFAULT_SCENARIO } from "@/domain/scenario";
import { InputField } from "@/components/inputs/input-field";
import { PageHeader } from "@/components/layout/app-shell";
import { ScenarioAdmin } from "@/components/settings/scenario-admin";
import { SensitivitiesForm } from "@/components/settings/small-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadWorkspace } from "@/server/data/workspace";
import { canInHospital, requireHospital } from "@/server/hospitals/access";
import { updateSensitivities } from "../../../../settings/actions";
import { updateInput } from "../inputs/actions";
import { approveScenario, archiveScenario, setDefaultScenario } from "../scenario-actions";

export const metadata: Metadata = { title: "Scenarios & assumptions" };

export default async function WorkbookSettingsPage({ params }: PageProps<"/hospitals/[hospitalId]/workbook/settings">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId);
  const ws = await loadWorkspace(hospitalId);
  const defaultScenario = ws.scenarios.find((s) => s.isDefault);
  const auditBase = canInHospital(ctx, "view_audit") ? `/hospitals/${hospitalId}/audit` : null;

  return (
    <>
      <PageHeader
        title="Scenarios & assumptions"
        description={`Saved scenarios and Respiratory Gate model assumptions for ${ctx.hospital.name}'s workbook model.`}
      />
      <div className="space-y-6">
        <Card id="scenarios" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Scenarios</CardTitle>
            <CardDescription>
              Named selections of occupancy, package price and savings level. Save new ones from any workbook page. The default
              scenario sets the starting selection and the official sensitivities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScenarioAdmin
              scenarios={ws.scenarios}
              canApprove={canInHospital(ctx, "approve_scenarios")}
              approve={approveScenario.bind(null, hospitalId)}
              makeDefault={setDefaultScenario.bind(null, hospitalId)}
              archive={archiveScenario.bind(null, hospitalId)}
            />
          </CardContent>
        </Card>

        <Card id="assumptions" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Model assumptions</CardTitle>
            <CardDescription>
              Respiratory Gate assumptions (blue cells in the workbook). Only Admins can change them; every change is audited.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Savings sensitivities (default scenario)</h3>
              <p className="text-xs text-muted">Applied to each lever&apos;s baseline. Sensitivities, not forecasts.</p>
              <SensitivitiesForm
                sensitivities={defaultScenario?.settings.sensitivities ?? WORKBOOK_DEFAULT_SCENARIO.sensitivities}
                editable={canInHospital(ctx, "edit_assumptions") && Boolean(defaultScenario)}
                save={updateSensitivities.bind(null, hospitalId)}
              />
            </div>
            <div className="divide-y divide-line border-t border-line">
              {definitionsInGroup("model_assumptions").map((def) => {
                const key = def.key as InputKey;
                const meta = ws.meta[key];
                return (
                  <InputField
                    key={key}
                    inputKey={key}
                    value={ws.values[key]}
                    text={ws.texts[key] ?? null}
                    meta={meta}
                    editable={Boolean(meta) && ctx.canWrite && canEditInputSource(ctx.role, meta?.source ?? def.source)}
                    updatedAt={meta?.updatedAt ?? null}
                    updatedByName={meta?.updatedByName ?? null}
                    auditHref={auditBase ? `${auditBase}?key=${key}` : undefined}
                    save={updateInput.bind(null, hospitalId)}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
