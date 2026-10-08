import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { requireHospital } from "@/server/hospitals/access";
import { ServicesSection } from "../_sections/config-sections";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage({ params }: PageProps<"/hospitals/[hospitalId]/services">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId);
  return (
    <>
      <PageHeader
        title="Services"
        description={`Respiratory therapy services ${ctx.hospital.name} provides, and the departments that provide them. Services come from the organisation's library (shared names make hospitals comparable) or can be added as custom services.`}
      />
      <Card>
        <CardContent className="pt-5">
          <ServicesSection ctx={ctx} />
        </CardContent>
      </Card>
    </>
  );
}
