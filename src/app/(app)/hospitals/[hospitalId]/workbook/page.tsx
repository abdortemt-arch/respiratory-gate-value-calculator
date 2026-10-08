import type { Metadata } from "next";
import { OverviewView } from "@/components/dashboards/overview-view";
import { ScenarioPage } from "./_lib/scenario-page";

export const metadata: Metadata = { title: "Workbook Value Model" };

export default async function WorkbookOverviewPage({ params, searchParams }: PageProps<"/hospitals/[hospitalId]/workbook">) {
  const { hospitalId } = await params;
  return (
    <ScenarioPage
      hospitalId={hospitalId}
      searchParams={searchParams}
      title="Value model overview"
      description="Projected annual Respiratory Care service-line value for the selected scenario. Every figure shows how it was calculated and whether hospital data is still missing."
    >
      <OverviewView />
    </ScenarioPage>
  );
}
