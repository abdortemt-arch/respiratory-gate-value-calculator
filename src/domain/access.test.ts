import { describe, expect, it } from "vitest";
import { can, canEditInputSource } from "./access";

describe("access model", () => {
  it("lets every internal role view dashboards and reports", () => {
    for (const role of ["admin", "manager", "viewer"] as const) {
      expect(can(role, "view_dashboards")).toBe(true);
      expect(can(role, "export_reports")).toBe(true);
    }
  });

  it("keeps viewers read-only", () => {
    expect(can("viewer", "edit_hospital_inputs")).toBe(false);
    expect(can("viewer", "save_scenarios")).toBe(false);
    expect(can("viewer", "view_audit")).toBe(false);
  });

  it("reserves assumptions, approval and user management for admins", () => {
    expect(canEditInputSource("manager", "hospital_data")).toBe(true);
    expect(canEditInputSource("manager", "rg_assumption")).toBe(false);
    expect(canEditInputSource("admin", "rg_assumption")).toBe(true);
    expect(can("manager", "approve_scenarios")).toBe(false);
    expect(can("manager", "manage_users")).toBe(false);
  });

  it("grants future physician and patient roles no access to financial data", () => {
    for (const role of ["referring_physician", "patient"] as const) {
      expect(can(role, "view_dashboards")).toBe(false);
      expect(can(role, "export_reports")).toBe(false);
    }
  });
});
