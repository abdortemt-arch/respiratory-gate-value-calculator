import type { Metadata } from "next";
import { AuditLog, auditFilters } from "@/components/audit/audit-log";
import { PageHeader } from "@/components/layout/app-shell";
import { loadAudit } from "@/server/data/audit";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  await requireUser("view_audit");
  const filters = auditFilters(await searchParams);
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change across the hospitals you manage — configuration, prices, monthly data, corrections, workbook inputs and user access: who, when, previous and new value, and the reason for historical corrections. Entries are written by the database and cannot be edited."
      />
      <AuditLog basePath="/audit" filters={filters} data={await loadAudit(filters)} />
    </>
  );
}
