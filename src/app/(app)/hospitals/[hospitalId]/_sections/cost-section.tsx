import { activeVersions, currentMonth, monthLabel, timeline, versionFor, versionsOf, type CostVersion } from "@/domain/hospital";
import { formatMoney } from "@/domain/format";
import { CostItemsManager, type CostHistoryEntry, type CostItemView } from "@/components/hospital/cost-items-manager";
import { canInHospital, type HospitalContext } from "@/server/hospitals/access";
import type { CostItemDetail, HospitalDetail } from "@/server/hospitals/repository";
import { loadDetail } from "@/server/hospitals/load";
import { addCostVersion, createCostItem, setCostItemActive, voidCostVersion } from "../../_actions/costs";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Cairo" });

function costText(item: CostItemDetail, amount: number, currency: string, detail: HospitalDetail): string {
  const money = formatMoney(amount, currency);
  if (item.category === "staffing") return `${money} per FTE per month`;
  if (item.basis === "monthly") return `${money} per month`;
  if (item.basis === "per_service_unit") {
    const svc = detail.services.find((s) => s.id === item.hospitalServiceId)?.name ?? "service";
    return `${money} per ${item.unitLabel} of ${svc}`;
  }
  return `${money} per ${item.unitLabel}`;
}

function history(item: CostItemDetail, versions: readonly CostVersion[], currency: string, detail: HospitalDetail, today: string): CostHistoryEntry[] {
  const entered = (v: CostVersion) => `${v.createdByName ?? "System"}${v.createdAt ? ` · ${dateFormat.format(new Date(v.createdAt))}` : ""}`;
  const live = timeline(versions).map(({ version: v, from, to }) => ({
    id: v.id,
    period: `${monthLabel(from, "short")} – ${to ? monthLabel(to, "short") : "onwards"}`,
    amount: costText(item, v.amount, currency, detail),
    status: (from > today ? "Scheduled" : to === null || to >= today ? "Current" : "Past") as CostHistoryEntry["status"],
    notes: v.notes,
    changeReason: v.changeReason ?? null,
    entered: entered(v),
    voidReason: null,
  }));
  const voided = versions
    .filter((v) => v.voided)
    .map((v) => ({
      id: v.id,
      period: monthLabel(v.effectiveFrom, "short"),
      amount: costText(item, v.amount, currency, detail),
      status: "Voided" as const,
      notes: v.notes,
      changeReason: null,
      entered: `Voided by ${v.voidedByName ?? "System"}${v.voidedAt ? ` · ${dateFormat.format(new Date(v.voidedAt))}` : ""}`,
      voidReason: v.voidReason ?? null,
    }));
  return [...live, ...voided];
}

export function costItemViews(detail: HospitalDetail, items: readonly CostItemDetail[], currency: string): CostItemView[] {
  const today = currentMonth();
  return items.map((item) => {
    const versions = versionsOf(detail.config.costVersions, "costItemId", item.id);
    const current = versionFor(versions, today) ?? activeVersions(versions)[0] ?? null;
    const linked = [
      item.hospitalServiceId ? detail.services.find((s) => s.id === item.hospitalServiceId)?.name : null,
      item.departmentId ? detail.departments.find((d) => d.id === item.departmentId)?.name : null,
      item.equipmentId ? detail.equipment.find((e) => e.id === item.equipmentId)?.name : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      basis: item.basis,
      unitLabel: item.unitLabel,
      active: item.active,
      endedFrom: item.endedFrom ? monthLabel(item.endedFrom, "short") : null,
      isRtStaff: item.isRtStaff,
      linked: linked || null,
      current: current ? `${costText(item, current.amount, currency, detail)} since ${monthLabel(current.effectiveFrom, "short")}` : null,
      history: history(item, versions, currency, detail, today),
    };
  });
}

export async function CostSection({ ctx, variant }: { ctx: HospitalContext; variant: "costs" | "staffing" | "equipment" }) {
  const detail = await loadDetail(ctx.hospital.id);
  const id = ctx.hospital.id;
  const items = detail.costItems.filter((c) =>
    variant === "staffing" ? c.category === "staffing" : variant === "equipment" ? c.equipmentId !== null || c.category === "equipment" : c.category !== "staffing",
  );
  return (
    <CostItemsManager
      variant={variant}
      items={costItemViews(detail, items, ctx.hospital.currency)}
      canEdit={canInHospital(ctx, "edit_hospital_config")}
      defaultMonth={currentMonth()}
      services={detail.services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
      departments={detail.departments.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name }))}
      equipment={detail.equipment.filter((e) => e.active).map((e) => ({ id: e.id, name: e.name }))}
      create={createCostItem.bind(null, id)}
      addVersion={addCostVersion.bind(null, id)}
      setActive={setCostItemActive.bind(null, id)}
      voidVersion={voidCostVersion.bind(null, id)}
    />
  );
}
