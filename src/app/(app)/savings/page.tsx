import type { Metadata } from "next";
import { SavingsView } from "@/components/dashboards/savings-view";
import { ScenarioPage } from "../_lib/scenario-page";

export const metadata: Metadata = { title: "Savings Scenarios" };

export default function Page({ searchParams }: PageProps<"/savings">) {
  return (
    <ScenarioPage
      searchParams={searchParams}
      title="Savings Scenarios"
      description="Cost-avoidance sensitivities applied to the hospital's own baselines. Levers without a baseline are shown, not counted."
    >
      <SavingsView />
    </ScenarioPage>
  );
}
