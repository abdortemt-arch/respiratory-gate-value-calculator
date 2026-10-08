import type { Metadata } from "next";
import { RevenueView } from "@/components/dashboards/revenue-view";
import { ScenarioPage } from "../_lib/scenario-page";

export const metadata: Metadata = { title: "Revenue Scenarios" };

export default function Page({ searchParams }: PageProps<"/revenue">) {
  return (
    <ScenarioPage
      searchParams={searchParams}
      title="Revenue Scenarios"
      description="ICU Respiratory Management Package potential by occupancy and price, plus other revenue streams. Gross potential — not profit."
    >
      <RevenueView />
    </ScenarioPage>
  );
}
