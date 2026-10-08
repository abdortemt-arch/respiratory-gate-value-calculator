/**
 * Access model (CLAUDE.md "Access Model"). Mirrors the RLS policies in
 * supabase/migrations; the database remains the final enforcement point.
 */

export const APP_ROLES = ["admin", "manager", "viewer", "referring_physician", "patient"] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Internal roles that may use the platform in Phase 1. */
export const STAFF_ROLES = ["admin", "manager", "viewer"] as const satisfies readonly AppRole[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Hospital Manager / Finance",
  viewer: "Viewer",
  referring_physician: "Referring Physician (reserved)",
  patient: "Patient (reserved)",
};

export type Permission =
  | "view_dashboards"
  | "edit_hospital_inputs"
  | "edit_assumptions"
  | "save_scenarios"
  | "approve_scenarios"
  | "export_reports"
  | "view_audit"
  | "manage_users"
  | "manage_organization";

const MATRIX: Record<Permission, readonly AppRole[]> = {
  view_dashboards: ["admin", "manager", "viewer"],
  edit_hospital_inputs: ["admin", "manager"],
  edit_assumptions: ["admin"],
  save_scenarios: ["admin", "manager"],
  approve_scenarios: ["admin"],
  export_reports: ["admin", "manager", "viewer"],
  view_audit: ["admin", "manager"],
  manage_users: ["admin"],
  manage_organization: ["admin"],
};

export function can(role: AppRole, permission: Permission): boolean {
  return MATRIX[permission].includes(role);
}

export function isStaffRole(role: AppRole): role is StaffRole {
  return (STAFF_ROLES as readonly AppRole[]).includes(role);
}

/** Which inputs a role may edit, by source type (matches policy hospital_inputs_update). */
export function canEditInputSource(role: AppRole, source: "hospital_data" | "verified_public" | "rg_assumption"): boolean {
  return source === "rg_assumption" ? can(role, "edit_assumptions") : can(role, "edit_hospital_inputs");
}
