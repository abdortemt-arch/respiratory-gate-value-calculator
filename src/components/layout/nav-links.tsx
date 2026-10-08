"use client";

import {
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  History,
  LayoutDashboard,
  LayoutGrid,
  PiggyBank,
  Receipt,
  Settings,
  Stethoscope,
  Tag,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { can } from "@/domain/access";
import { cn } from "@/lib/cn";
import { SCENARIO_PARAM_KEYS } from "@/lib/scenario-params";
import { Badge } from "@/components/ui/badge";
import { hospitalIdFromPath, hospitalNav, isActive, type NavHospital, type NavIcon, type NavItem } from "./nav-items";

const ICONS: Record<NavIcon, LucideIcon> = {
  portfolio: Building2,
  compare: GitCompareArrows,
  audit: History,
  settings: Settings,
  overview: LayoutDashboard,
  periods: CalendarDays,
  departments: LayoutGrid,
  services: Stethoscope,
  pricing: Tag,
  costs: Receipt,
  staffing: Users,
  equipment: Boxes,
  savings: PiggyBank,
  reports: FileText,
  workbook: FileSpreadsheet,
  inputs: ClipboardList,
  revenue: TrendingUp,
  bridge: BarChart3,
};

function ItemList({ items, qs, pathname, onNavigate }: { items: readonly NavItem[]; qs: string; pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item, pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.scenario && qs ? `${item.href}?${qs}` : item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-brand-blue text-white shadow-sm" : "text-ink-soft hover:bg-brand-blue-50 hover:text-ink",
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function NavLinks({
  items,
  hospitals,
  onNavigate,
}: {
  items: readonly NavItem[];
  hospitals: readonly NavHospital[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scenarioQuery = new URLSearchParams();
  for (const key of SCENARIO_PARAM_KEYS) {
    const v = searchParams.get(key);
    if (v) scenarioQuery.set(key, v);
  }
  const qs = scenarioQuery.toString();
  const hospitalId = hospitalIdFromPath(pathname);
  const hospital = hospitalId ? hospitals.find((h) => h.id === hospitalId) : undefined;

  return (
    <div className="space-y-4">
      <ItemList items={items} qs={qs} pathname={pathname} onNavigate={onNavigate} />
      {hospital ? (
        <div className="space-y-3 border-t border-line pt-4" aria-label={`${hospital.name} navigation`} role="group">
          <div className="flex items-center justify-between gap-2 px-3">
            <p className="min-w-0 truncate text-xs font-semibold tracking-wide text-ink uppercase" title={hospital.name}>
              {hospital.name}
            </p>
            {hospital.active ? (
              <span className="figure shrink-0 text-xs text-muted">{hospital.code}</span>
            ) : (
              <Badge tone="caution">Inactive</Badge>
            )}
          </div>
          {hospitalNav(hospital.id, hospital.workbookModelEnabled).map((section) => (
            <div key={section.title ?? "main"} className="space-y-1">
              {section.title ? <p className="px-3 text-xs font-medium text-muted">{section.title}</p> : null}
              <ItemList
                items={section.items.filter((i) => can(hospital.role, i.permission))}
                qs={qs}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
