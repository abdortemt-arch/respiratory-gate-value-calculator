import type { Metadata } from "next";
import { EquipmentManager } from "@/components/hospital/equipment-manager";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canInHospital, requireHospital } from "@/server/hospitals/access";
import { loadDetail } from "@/server/hospitals/load";
import { createEquipment, setEquipmentActive, updateEquipment } from "../../_actions/costs";
import { CostSection } from "../_sections/cost-section";

export const metadata: Metadata = { title: "Equipment" };

export default async function EquipmentPage({ params }: PageProps<"/hospitals/[hospitalId]/equipment">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId);
  const detail = await loadDetail(hospitalId);
  return (
    <>
      <PageHeader title="Equipment" description="Respiratory equipment register and its costs (rental, lease, depreciation, maintenance). Retired equipment stays in the history." />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Register</CardTitle>
          </CardHeader>
          <CardContent>
            <EquipmentManager
              rows={detail.equipment}
              departments={detail.departments.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name }))}
              canEdit={canInHospital(ctx, "edit_hospital_config")}
              create={createEquipment.bind(null, hospitalId)}
              update={updateEquipment.bind(null, hospitalId)}
              setActive={setEquipmentActive.bind(null, hospitalId)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Equipment costs</CardTitle>
            <CardDescription>Monthly rental or lease amounts, maintenance contracts and per-use costs, versioned by month.</CardDescription>
          </CardHeader>
          <CardContent>
            <CostSection ctx={ctx} variant="equipment" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
