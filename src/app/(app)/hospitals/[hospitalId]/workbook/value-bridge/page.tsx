import type { Metadata } from "next";
import { BridgeView } from "@/components/dashboards/bridge-view";
import { ScenarioPage } from "../_lib/scenario-page";

export const metadata: Metadata = { title: "Value Bridge" };

export default async function Page({ params, searchParams }: PageProps<"/hospitals/[hospitalId]/workbook/value-bridge">) {
  const { hospitalId } = await params;
  return (
    <ScenarioPage
      hospitalId={hospitalId}
      searchParams={searchParams}
      title="Value Bridge"
      description="How revenue, operating cost and cost avoidance combine into net respiratory service-line value."
    >
      <BridgeView />
    </ScenarioPage>
  );
}
