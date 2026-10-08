import type { ReactNode } from "react";
import { can } from "@/domain/access";
import { PageHeader } from "@/components/layout/app-shell";
import { ScenarioBar } from "@/components/scenario/scenario-bar";
import { ScenarioProvider } from "@/components/scenario/scenario-provider";
import { parseScenarioParams, resolveScenario } from "@/lib/scenario-params";
import { requireUser } from "@/server/auth/session";
import { loadWorkspace } from "@/server/data/workspace";
import { saveScenario } from "../scenario-actions";

/**
 * Shared frame for scenario-driven pages: verifies the session, loads the
 * workspace, resolves the scenario from the URL and renders the scenario bar.
 */
export async function ScenarioPage({
  searchParams,
  title,
  description,
  printHeader = true,
  children,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  title: string;
  description?: ReactNode;
  /** The printable report carries its own header. */
  printHeader?: boolean;
  children: ReactNode;
}) {
  const user = await requireUser();
  const ws = await loadWorkspace(user);
  const { settings, base } = resolveScenario(parseScenarioParams(await searchParams), ws.scenarios);
  const canSave = can(user.role, "save_scenarios");

  return (
    <ScenarioProvider values={ws.values} texts={ws.texts} scenarios={ws.scenarios} initialSettings={settings} initialBaseId={base?.id ?? null}>
      <PageHeader title={title} description={description} className={printHeader ? undefined : "no-print"} />
      <ScenarioBar canSave={canSave} saveAction={canSave ? saveScenario : undefined} />
      {children}
    </ScenarioProvider>
  );
}
