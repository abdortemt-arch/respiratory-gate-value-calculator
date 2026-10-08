import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { HOSPITAL_TYPES } from "@/domain/hospital";
import { HospitalSwitcher } from "@/components/hospital/hospital-switcher";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { loadHospitalsWithRoles, requireHospital } from "@/server/hospitals/access";

export default async function HospitalLayout({ children, params }: LayoutProps<"/hospitals/[hospitalId]">) {
  const { hospitalId } = await params;
  const ctx = await requireHospital(hospitalId);
  const hospitals = await loadHospitalsWithRoles(ctx.user);
  const h = ctx.hospital;
  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
          <Link href="/hospitals" className="hover:text-ink hover:underline">
            Portfolio
          </Link>
          <ChevronRight aria-hidden className="size-4 shrink-0" />
          <Link href={`/hospitals/${h.id}`} className="truncate font-medium text-ink hover:underline">
            {h.name}
          </Link>
          <Badge tone="neutral" className="figure">
            {h.code}
          </Badge>
          {h.type ? <span className="hidden text-xs sm:inline">{HOSPITAL_TYPES[h.type]}</span> : null}
          {h.active ? null : <Badge tone="caution">Inactive</Badge>}
        </nav>
        <HospitalSwitcher currentId={h.id} hospitals={hospitals} />
      </div>
      {!h.active ? (
        <Alert tone="caution" title="This hospital is inactive" className="no-print mb-6">
          Its history stays available for reporting. {ctx.role === "admin" ? "Reactivate it in Settings to record new data." : "Only an Admin can make changes."}
        </Alert>
      ) : null}
      {children}
    </>
  );
}
