import type { Metadata } from "next";
import { AuditLog, auditFilters } from "@/components/audit/audit-log";
import { PageHeader } from "@/components/layout/app-shell";
import { loadAudit } from "@/server/data/audit";
import { requireHospital } from "@/server/hospitals/access";

export const metadata: Metadata = { title: "Hospital audit log" };

export default async function HospitalAuditPage({ params, searchParams }: PageProps<"/hospitals/[hospitalId]/audit">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId, "view_audit");
  const filters = auditFilters(await searchParams, hospitalId);
  return (
    <>
      <PageHeader
        title="Audit log"
        description={`Changes to ${ctx.hospital.name}: configuration, prices, costs, monthly periods and historical corrections (with their reasons), and workbook inputs.`}
      />
      <AuditLog basePath={`/hospitals/${hospitalId}/audit`} hospitalId={hospitalId} filters={filters} data={await loadAudit(filters, hospitalId)} />
    </>
  );
}
