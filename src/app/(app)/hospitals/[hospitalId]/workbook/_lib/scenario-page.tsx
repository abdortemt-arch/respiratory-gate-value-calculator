import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { ScenarioBar } from "@/components/scenario/scenario-bar";
import { ScenarioProvider } from "@/components/scenario/scenario-provider";
import { parseScenarioParams, resolveScenario } from "@/lib/scenario-params";
import { loadWorkspace } from "@/server/data/workspace";
import { canInHospital, requireHospital, type HospitalContext } from "@/server/hospitals/access";
import { saveScenario } from "../scenario-actions";

/**
 * Shared frame for the Workbook Value Model pages of one hospital: verifies
 * access, loads the hospital's workbook inputs, resolves the scenario from the
 * URL and renders the scenario bar.
 */
export async function ScenarioPage({
  hospitalId,
  searchParams,
  title,
  description,
  printHeader = true,
  children,
}: {
  hospitalId: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  title: string;
  description?: ReactNode;
  /** The printable report carries its own header. */
  printHeader?: boolean;
  children: ReactNode | ((ctx: HospitalContext) => ReactNode);
}) {
  const ctx = await requireHospital(hospitalId);
  const ws = await loadWorkspace(hospitalId);
  const { settings, base } = resolveScenario(parseScenarioParams(await searchParams), ws.scenarios);
  const canSave = canInHospital(ctx, "save_scenarios");

  return (
    <ScenarioProvider values={ws.values} texts={ws.texts} scenarios={ws.scenarios} initialSettings={settings} initialBaseId={base?.id ?? null}>
      <PageHeader title={title} description={description} className={printHeader ? undefined : "no-print"} />
      <ScenarioBar canSave={canSave} saveAction={canSave ? saveScenario.bind(null, hospitalId) : undefined} />
      {typeof children === "function" ? children(ctx) : children}
    </ScenarioProvider>
  );
}
