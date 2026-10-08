import { activeVersions, currentMonth, describePriceVersion, versionFor, versionsOf } from "@/domain/hospital";
import { DepartmentsManager } from "@/components/hospital/departments-manager";
import { PriceForm } from "@/components/hospital/price-form";
import { PricingHistory } from "@/components/hospital/pricing-history";
import { ServicesManager } from "@/components/hospital/services-manager";
import { canInHospital, type HospitalContext } from "@/server/hospitals/access";
import { loadDetail, loadLibrary } from "@/server/hospitals/load";
import {
  addHospitalService,
  addPriceVersion,
  createDepartment,
  setDepartmentActive,
  setHospitalServiceActive,
  setServiceDepartments,
  updateDepartment,
  voidPriceVersion,
} from "../../_actions/config";

export async function DepartmentsSection({ ctx }: { ctx: HospitalContext }) {
  const detail = await loadDetail(ctx.hospital.id);
  const id = ctx.hospital.id;
  return (
    <DepartmentsManager
      departments={detail.departments}
      canEdit={canInHospital(ctx, "edit_hospital_config")}
      create={createDepartment.bind(null, id)}
      update={updateDepartment.bind(null, id)}
      setActive={setDepartmentActive.bind(null, id)}
    />
  );
}

export async function ServicesSection({ ctx }: { ctx: HospitalContext }) {
  const [detail, library] = await Promise.all([loadDetail(ctx.hospital.id), loadLibrary()]);
  const id = ctx.hospital.id;
  const today = currentMonth();
  const provided = new Set(detail.services.filter((s) => s.active).map((s) => s.serviceId));
  return (
    <ServicesManager
      hospitalId={id}
      services={detail.services.map((s) => {
        const versions = versionsOf(detail.config.priceVersions, "hospitalServiceId", s.id);
        const current = versionFor(versions, today) ?? activeVersions(versions)[0] ?? null;
        return {
          id: s.id,
          name: s.name,
          code: s.code,
          category: s.category,
          active: s.active,
          departmentIds: s.departmentIds,
          currentPrice: current ? describePriceVersion(current) : null,
        };
      })}
      library={library.filter((l) => l.active).map((l) => ({ id: l.id, name: l.name, category: l.category, provided: provided.has(l.id) }))}
      departments={detail.departments.map((d) => ({ id: d.id, name: d.name, active: d.active }))}
      canEdit={canInHospital(ctx, "edit_hospital_config")}
      add={addHospitalService.bind(null, id)}
      setDepartments={setServiceDepartments.bind(null, id)}
      setActive={setHospitalServiceActive.bind(null, id)}
    />
  );
}

export async function PriceFormSection({ ctx, serviceId }: { ctx: HospitalContext; serviceId?: string }) {
  const detail = await loadDetail(ctx.hospital.id);
  if (!canInHospital(ctx, "edit_hospital_config")) return null;
  const versions = detail.config.priceVersions;
  return (
    <PriceForm
      services={detail.services
        .filter((s) => s.active)
        .map((s) => {
          const own = activeVersions(versionsOf(versions, "hospitalServiceId", s.id));
          return { id: s.id, name: s.name, billingUnit: own.at(-1)?.billingUnit ?? null };
        })}
      currency={ctx.hospital.currency}
      defaultMonth={currentMonth()}
      action={addPriceVersion.bind(null, ctx.hospital.id)}
      initialServiceId={serviceId}
    />
  );
}

export async function PricingHistorySection({ ctx, serviceId }: { ctx: HospitalContext; serviceId?: string }) {
  const detail = await loadDetail(ctx.hospital.id);
  const services = detail.services.filter((s) => !serviceId || s.id === serviceId);
  return (
    <PricingHistory
      services={services}
      versions={detail.config.priceVersions}
      today={currentMonth()}
      voidAction={canInHospital(ctx, "edit_hospital_config") ? voidPriceVersion.bind(null, ctx.hospital.id) : undefined}
    />
  );
}
