import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { requireHospital } from "@/server/hospitals/access";
import { DepartmentsSection } from "../_sections/config-sections";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage({ params }: PageProps<"/hospitals/[hospitalId]/departments">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId);
  return (
    <>
      <PageHeader
        title="Departments"
        description={`Units of ${ctx.hospital.name} covered by respiratory therapy. Departments are deactivated, never deleted, so their history stays in reports.`}
      />
      <Card>
        <CardContent className="pt-5">
          <DepartmentsSection ctx={ctx} />
        </CardContent>
      </Card>
    </>
  );
}
