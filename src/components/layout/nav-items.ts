import type { Permission } from "@/domain/access";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: "overview" | "inputs" | "revenue" | "savings" | "bridge" | "reports" | "audit" | "settings";
  readonly permission: Permission;
  /** Pages that read the scenario selection keep it in the URL across navigation. */
  readonly scenario?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/overview", label: "Overview", icon: "overview", permission: "view_dashboards", scenario: true },
  { href: "/inputs", label: "Inputs", icon: "inputs", permission: "view_dashboards" },
  { href: "/revenue", label: "Revenue", icon: "revenue", permission: "view_dashboards", scenario: true },
  { href: "/savings", label: "Savings", icon: "savings", permission: "view_dashboards", scenario: true },
  { href: "/value-bridge", label: "Value Bridge", icon: "bridge", permission: "view_dashboards", scenario: true },
  { href: "/reports", label: "Reports", icon: "reports", permission: "export_reports", scenario: true },
  { href: "/audit", label: "Audit", icon: "audit", permission: "view_audit" },
  { href: "/settings", label: "Settings", icon: "settings", permission: "view_dashboards" },
];
