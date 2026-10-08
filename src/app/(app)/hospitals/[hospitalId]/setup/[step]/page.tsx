import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { WizardSteps, type WizardStep } from "@/components/hospital/wizard-steps";
import { PageHeader } from "@/components/layout/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireHospital } from "@/server/hospitals/access";
import { DepartmentsSection, PriceFormSection, PricingHistorySection, ServicesSection } from "../../_sections/config-sections";

export const metadata: Metadata = { title: "Hospital setup" };

const STEPS = {
  departments: {
    title: "Departments",
    description: "Add the units the respiratory service covers, with their beds. You can add or deactivate departments later.",
    next: "services",
  },
  services: {
    title: "Services",
    description: "Choose the respiratory therapy services this hospital provides and the departments that provide them.",
    next: "pricing",
  },
  pricing: {
    title: "Prices",
    description: "Enter this hospital's prices with the month each takes effect. Add a new price whenever it changes — history is kept.",
    next: null,
  },
} as const;

export default async function SetupStepPage({ params }: PageProps<"/hospitals/[hospitalId]/setup/[step]">) {
  const { hospitalId, step } = await params;
  if (!(step in STEPS)) notFound();
  const ctx = await requireHospital(hospitalId, "edit_hospital_config");
  const s = STEPS[step as keyof typeof STEPS];
  return (
    <>
      <PageHeader title={`Set up ${ctx.hospital.name}`} description="Hospital configuration. Monthly activity is entered separately, in Monthly periods." />
      <WizardSteps current={step as WizardStep} hospitalId={hospitalId} />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{s.title}</CardTitle>
            <CardDescription>{s.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === "departments" ? <DepartmentsSection ctx={ctx} /> : null}
            {step === "services" ? <ServicesSection ctx={ctx} /> : null}
            {step === "pricing" ? (
              <div className="space-y-6">
                <PriceFormSection ctx={ctx} />
                <PricingHistorySection ctx={ctx} />
              </div>
            ) : null}
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-2">
          {s.next ? (
            <LinkButton href={`/hospitals/${hospitalId}/setup/${s.next}`}>
              Continue to {STEPS[s.next].title.toLowerCase()} <ArrowRight />
            </LinkButton>
          ) : (
            <LinkButton href={`/hospitals/${hospitalId}`}>
              Finish setup <ArrowRight />
            </LinkButton>
          )}
          <LinkButton href={`/hospitals/${hospitalId}`} variant="ghost">
            Go to hospital overview
          </LinkButton>
        </div>
      </div>
    </>
  );
}
