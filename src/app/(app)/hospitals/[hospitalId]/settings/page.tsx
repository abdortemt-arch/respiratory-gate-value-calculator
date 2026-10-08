import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { HOSPITAL_TYPES } from "@/domain/hospital";
import { ActionButton } from "@/components/hospital/action-button";
import { HospitalForm } from "@/components/hospital/hospital-form";
import { MembersManager } from "@/components/hospital/members-manager";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireHospital } from "@/server/hospitals/access";
import { loadHospitalMembers } from "@/server/hospitals/load";
import { addMember, enableWorkbookModel, setHospitalActive, updateHospital, updateMember } from "../../_actions/hospital";

export const metadata: Metadata = { title: "Hospital settings" };

export default async function HospitalSettingsPage({ params }: PageProps<"/hospitals/[hospitalId]/settings">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId);
  const h = ctx.hospital;
  const isAdmin = ctx.role === "admin";
  const members = isAdmin ? await loadHospitalMembers(hospitalId) : null;

  return (
    <>
      <PageHeader title="Hospital settings" description={`Details, status, access and financial models for ${h.name}.`} />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            {isAdmin ? null : <CardDescription>Only an Admin can change hospital details.</CardDescription>}
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              <HospitalForm
                mode="edit"
                action={updateHospital.bind(null, hospitalId)}
                initial={{ name: h.name, code: h.code, type: h.type, totalBeds: h.totalBeds, location: h.location, notes: h.notes, active: h.active }}
              />
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                <dt className="text-muted">Name</dt>
                <dd>{h.name}</dd>
                <dt className="text-muted">Code</dt>
                <dd className="figure">{h.code}</dd>
                <dt className="text-muted">Type</dt>
                <dd>{h.type ? HOSPITAL_TYPES[h.type] : "—"}</dd>
                <dt className="text-muted">Total beds</dt>
                <dd>{h.totalBeds ?? "Unknown"}</dd>
                <dt className="text-muted">Location</dt>
                <dd>{h.location ?? "—"}</dd>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Status <Badge tone={h.active ? "positive" : "caution"}>{h.active ? "Active" : "Inactive"}</Badge>
            </CardTitle>
            <CardDescription>
              Hospitals are deactivated, never deleted. An inactive hospital keeps its full history for reporting and comparisons; managers cannot record new data.
            </CardDescription>
          </CardHeader>
          {isAdmin ? (
            <CardContent>
              <ActionButton
                action={setHospitalActive.bind(null, hospitalId, !h.active)}
                variant={h.active ? "danger" : "primary"}
                confirm={h.active ? `Deactivate ${h.name}? Its history stays available.` : undefined}
              >
                {h.active ? "Deactivate hospital" : "Reactivate hospital"}
              </ActionButton>
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial models</CardTitle>
            <CardDescription>The monthly operating model (prices, costs and periods) is always on. Optional models are added per hospital.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-start gap-3">
              <FileSpreadsheet aria-hidden className="mt-0.5 size-5 text-brand-blue" />
              <span>
                <span className="block font-medium text-ink">Financial Model: Elite / Workbook Value Model</span>
                <span className="block text-sm text-muted">Annual ICU package potential, savings sensitivities and value bridge (original Excel calculator).</span>
              </span>
            </span>
            {h.workbookModelEnabled ? (
              <Link href={`/hospitals/${hospitalId}/workbook`} className="text-sm font-medium text-brand-blue-700 hover:underline">
                Open the workbook model
              </Link>
            ) : isAdmin ? (
              <ActionButton action={enableWorkbookModel.bind(null, hospitalId)} variant="secondary">
                Enable
              </ActionButton>
            ) : (
              <Badge tone="neutral">Not enabled</Badge>
            )}
          </CardContent>
        </Card>

        {members ? (
          <Card>
            <CardHeader>
              <CardTitle>Access</CardTitle>
              <CardDescription>Managers edit configuration and monthly data of this hospital; viewers read dashboards and reports. Organisation Admins always have access.</CardDescription>
            </CardHeader>
            <CardContent>
              <MembersManager members={members.members} candidates={members.candidates} add={addMember.bind(null, hospitalId)} update={updateMember.bind(null, hospitalId)} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
