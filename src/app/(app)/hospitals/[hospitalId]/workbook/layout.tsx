import { FileSpreadsheet } from "lucide-react";
import { ActionButton } from "@/components/hospital/action-button";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { requireHospital } from "@/server/hospitals/access";
import { enableWorkbookModel } from "../../_actions/hospital";

/**
 * Financial Model: Elite / Workbook Value Model — the original Excel calculator,
 * kept with full workbook parity as one model inside the platform.
 */
export default async function WorkbookLayout({ children, params }: LayoutProps<"/hospitals/[hospitalId]/workbook">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId);
  if (!ctx.hospital.workbookModelEnabled) {
    return (
      <>
        <PageHeader title="Workbook Value Model" description="Financial Model: Elite / Workbook Value Model." />
        <Card>
          <CardContent className="flex flex-col items-start gap-4 pt-5">
            <FileSpreadsheet aria-hidden className="size-8 text-brand-blue" />
            <p className="max-w-2xl text-sm text-ink-soft">
              The workbook model projects annual ICU package revenue, savings scenarios and the value bridge from the original Elite
              RT Value Calculator. It is not enabled for {ctx.hospital.name}. Enabling it adds the model&apos;s inputs with hospital
              data left blank (never invented) and Respiratory Gate assumptions at their workbook defaults.
            </p>
            {ctx.role === "admin" ? (
              <ActionButton action={enableWorkbookModel.bind(null, hospitalId)} variant="primary" size="md">
                Enable the workbook model
              </ActionButton>
            ) : (
              <p className="text-sm text-muted">Ask an Admin to enable it.</p>
            )}
          </CardContent>
        </Card>
      </>
    );
  }
  return (
    <>
      <p className="no-print mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-blue-50 px-2.5 py-0.5 text-xs font-medium text-brand-blue-700">
        <FileSpreadsheet aria-hidden className="size-3.5" /> Financial Model: Elite / Workbook Value Model
      </p>
      {children}
    </>
  );
}
