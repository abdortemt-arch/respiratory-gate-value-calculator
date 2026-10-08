import type { Permission, StaffRole } from "@/domain/access";

export type NavIcon =
  | "portfolio"
  | "compare"
  | "audit"
  | "settings"
  | "overview"
  | "periods"
  | "departments"
  | "services"
  | "pricing"
  | "costs"
  | "staffing"
  | "equipment"
  | "savings"
  | "reports"
  | "workbook"
  | "inputs"
  | "revenue"
  | "bridge";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: NavIcon;
  readonly permission: Permission;
  /** Pages that read the scenario selection keep it in the URL across navigation. */
  readonly scenario?: boolean;
  /** Active only on this exact path (not on sub-paths). */
  readonly exact?: boolean;
  /** Extra paths that also mark this item active. */
  readonly alsoActive?: readonly string[];
}

export interface NavHospital {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly active: boolean;
  readonly workbookModelEnabled: boolean;
  /** The user's role in this hospital. */
  readonly role: StaffRole;
}

export const GLOBAL_NAV: readonly NavItem[] = [
  { href: "/hospitals", label: "Portfolio", icon: "portfolio", permission: "view_dashboards", exact: true, alsoActive: ["/hospitals/new"] },
  { href: "/comparisons", label: "Comparisons", icon: "compare", permission: "view_dashboards" },
  { href: "/audit", label: "Audit log", icon: "audit", permission: "view_audit" },
  { href: "/settings", label: "Settings", icon: "settings", permission: "view_dashboards" },
];

export interface NavSection {
  readonly title: string | null;
  readonly items: readonly NavItem[];
}

/** Navigation inside one hospital. */
export function hospitalNav(hospitalId: string, workbookModelEnabled: boolean): NavSection[] {
  const base = `/hospitals/${hospitalId}`;
  const sections: NavSection[] = [
    {
      title: null,
      items: [
        { href: base, label: "Overview", icon: "overview", permission: "view_dashboards", exact: true },
        { href: `${base}/periods`, label: "Monthly periods", icon: "periods", permission: "view_dashboards" },
        { href: `${base}/departments`, label: "Departments", icon: "departments", permission: "view_dashboards" },
        { href: `${base}/services`, label: "Services", icon: "services", permission: "view_dashboards" },
        { href: `${base}/pricing`, label: "Pricing", icon: "pricing", permission: "view_dashboards" },
        { href: `${base}/costs`, label: "Costs", icon: "costs", permission: "view_dashboards" },
        { href: `${base}/staffing`, label: "Staffing", icon: "staffing", permission: "view_dashboards" },
        { href: `${base}/equipment`, label: "Equipment", icon: "equipment", permission: "view_dashboards" },
        { href: `${base}/savings`, label: "Savings", icon: "savings", permission: "view_dashboards" },
        { href: `${base}/reports`, label: "Reports", icon: "reports", permission: "export_reports" },
        { href: `${base}/comparisons`, label: "Comparisons", icon: "compare", permission: "view_dashboards" },
        { href: `${base}/audit`, label: "Audit log", icon: "audit", permission: "view_audit" },
        { href: `${base}/settings`, label: "Settings", icon: "settings", permission: "view_dashboards" },
      ],
    },
  ];
  if (workbookModelEnabled) {
    sections.push({
      title: "Workbook Value Model",
      items: [
        { href: `${base}/workbook`, label: "Value model overview", icon: "workbook", permission: "view_dashboards", scenario: true, exact: true },
        { href: `${base}/workbook/inputs`, label: "Model inputs", icon: "inputs", permission: "view_dashboards" },
        { href: `${base}/workbook/revenue`, label: "Revenue scenarios", icon: "revenue", permission: "view_dashboards", scenario: true },
        { href: `${base}/workbook/savings`, label: "Savings scenarios", icon: "savings", permission: "view_dashboards", scenario: true },
        { href: `${base}/workbook/value-bridge`, label: "Value bridge", icon: "bridge", permission: "view_dashboards", scenario: true },
        { href: `${base}/workbook/report`, label: "Executive report", icon: "reports", permission: "export_reports", scenario: true },
        { href: `${base}/workbook/settings`, label: "Scenarios & assumptions", icon: "settings", permission: "view_dashboards" },
      ],
    });
  }
  return sections;
}

const HOSPITAL_PATH = /^\/hospitals\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

/** The hospital id in a path such as /hospitals/<id>/pricing. */
export function hospitalIdFromPath(pathname: string): string | null {
  return HOSPITAL_PATH.exec(pathname)?.[1] ?? null;
}

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.alsoActive?.includes(pathname)) return true;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
