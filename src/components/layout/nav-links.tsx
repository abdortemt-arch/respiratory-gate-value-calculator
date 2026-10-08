"use client";

import {
  BarChart3,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  PiggyBank,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { SCENARIO_PARAM_KEYS } from "@/lib/scenario-params";
import type { NavItem } from "./nav-items";

const ICONS: Record<NavItem["icon"], LucideIcon> = {
  overview: LayoutDashboard,
  inputs: ClipboardList,
  revenue: TrendingUp,
  savings: PiggyBank,
  bridge: BarChart3,
  reports: FileText,
  audit: History,
  settings: Settings,
};

export function NavLinks({ items, onNavigate }: { items: readonly NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scenarioQuery = new URLSearchParams();
  for (const key of SCENARIO_PARAM_KEYS) {
    const v = searchParams.get(key);
    if (v) scenarioQuery.set(key, v);
  }
  const qs = scenarioQuery.toString();

  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.scenario && qs ? `${item.href}?${qs}` : item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
