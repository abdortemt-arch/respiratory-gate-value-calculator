import type { Metadata } from "next";
import { ReportView } from "@/components/dashboards/report-view";
import { requireUser } from "@/server/auth/session";
import { ScenarioPage } from "../_lib/scenario-page";

export const metadata: Metadata = { title: "Executive report" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requireUser("export_reports");
  return (
    <ScenarioPage
      searchParams={searchParams}
      title="Reports"
      printHeader={false}
      description="Management-ready executive summary for the selected scenario, with data completeness and scenario comparison. Use Print to save it as a PDF."
    >
      <ReportView organizationName={user.organizationName} preparedBy={user.fullName} />
    </ScenarioPage>
  );
}
