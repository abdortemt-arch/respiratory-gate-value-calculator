import type { Metadata } from "next";
import { OverviewView } from "@/components/dashboards/overview-view";
import { Alert } from "@/components/ui/alert";
import { ScenarioPage } from "../_lib/scenario-page";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: PageProps<"/overview">) {
  const denied = (await searchParams).denied === "1";
  return (
    <ScenarioPage
      searchParams={searchParams}
      title="Overview"
      description="Respiratory Care service-line value for the selected scenario. Every figure shows how it was calculated and whether hospital data is still missing."
    >
      {denied ? (
        <Alert tone="caution" title="That page is not available for your role" className="mb-6">
          Ask an Admin if you need access.
        </Alert>
      ) : null}
      <OverviewView />
    </ScenarioPage>
  );
}
