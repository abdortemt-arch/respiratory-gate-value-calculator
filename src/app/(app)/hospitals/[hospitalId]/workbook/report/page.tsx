import type { Metadata } from "next";
import { ReportView } from "@/components/dashboards/report-view";
import { requireHospital } from "@/server/hospitals/access";
import { ScenarioPage } from "../_lib/scenario-page";

export const metadata: Metadata = { title: "Executive report" };

export default async function WorkbookReportPage({ params, searchParams }: PageProps<"/hospitals/[hospitalId]/workbook/report">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId, "export_reports");
  return (
    <ScenarioPage
      hospitalId={hospitalId}
      searchParams={searchParams}
      title="Executive report"
      printHeader={false}
      description="Management-ready executive summary for the selected scenario, with data completeness and scenario comparison. Use Print to save it as a PDF."
    >
      <ReportView organizationName={ctx.hospital.name} preparedBy={ctx.user.fullName} />
    </ScenarioPage>
  );
}
