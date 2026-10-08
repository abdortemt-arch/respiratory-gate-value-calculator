import type { Metadata } from "next";
import { OverviewView } from "@/components/dashboards/overview-view";
import { ScenarioPage } from "../_lib/scenario-page";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage({ searchParams }: PageProps<"/overview">) {
  return (
    <ScenarioPage
      searchParams={searchParams}
      title="Overview"
      description="Respiratory Care service-line value for the selected scenario. Every figure shows how it was calculated and whether hospital data is still missing."
    >
      <OverviewView />
    </ScenarioPage>
  );
}
