import type { Metadata } from "next";
import { HospitalForm } from "@/components/hospital/hospital-form";
import { WizardSteps } from "@/components/hospital/wizard-steps";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { createHospital } from "../_actions/hospital";

export const metadata: Metadata = { title: "Add hospital" };

export default async function NewHospitalPage() {
  await requireUser("manage_hospitals");
  return (
    <>
      <PageHeader
        title="Add hospital"
        description="Set up a hospital in four steps. Each hospital is configured independently: its own departments, services, prices and costs."
      />
      <WizardSteps current="hospital" />
      <Card className="max-w-3xl">
        <CardContent className="pt-5">
          <HospitalForm action={createHospital} mode="create" />
        </CardContent>
      </Card>
    </>
  );
}
