import { describe, expect, it } from "vitest";
import { canAccessSection, userCanAccessSection } from "./roles";
import { crmRoleFromProfile } from "./resolve-supabase-user";
import {
  crmRoleToWmsRole,
  hasWmsPermission,
  pickHighestWmsRole,
  wmsRoleToCrmRole,
} from "./wms-rbac";

describe("crmRoleFromProfile", () => {
  it("nunca concede ops por defecto (antes: user_metadata → ops)", () => {
    expect(crmRoleFromProfile(undefined)).toBe("pending");
    expect(crmRoleFromProfile("admin")).toBe("admin");
    expect(crmRoleFromProfile({ role: "admin" })).toBe("pending");
  });
});

describe("crmRoleToWmsRole", () => {
  it("mapea los 4 roles demo y bloquea pending", () => {
    expect(crmRoleToWmsRole("admin")).toBe("ADMIN");
    expect(crmRoleToWmsRole("ops")).toBe("WAREHOUSE_MANAGER");
    expect(crmRoleToWmsRole("booking")).toBe("VIEWER");
    expect(crmRoleToWmsRole("guide")).toBe("PICKER");
    expect(crmRoleToWmsRole("pending")).toBeNull();
  });
});

describe("wmsRoleToCrmRole", () => {
  it("no inventa admin para planta", () => {
    expect(wmsRoleToCrmRole("PICKER")).toBe("guide");
    expect(wmsRoleToCrmRole("ADMIN")).toBe("admin");
    expect(wmsRoleToCrmRole("AUDITOR")).toBe("booking");
  });
});

describe("pickHighestWmsRole", () => {
  it("elige ADMIN sobre PICKER", () => {
    expect(pickHighestWmsRole(["PICKER", "ADMIN", "nope"])).toBe("ADMIN");
    expect(pickHighestWmsRole([])).toBeNull();
  });
});

describe("userCanAccessSection", () => {
  it("pending no ve WMS ni CRM", () => {
    const pending = { role: "pending" as const, wmsRole: null };
    expect(userCanAccessSection(pending, "dashboard", "demo")).toBe(false);
    expect(userCanAccessSection(pending, "leads", "demo")).toBe(false);
    expect(userCanAccessSection(pending, "picking", "production")).toBe(false);
  });

  it("demo conserva la matriz CRM (Jorge no ve stock)", () => {
    const guide = { role: "guide" as const };
    expect(userCanAccessSection(guide, "picking", "demo")).toBe(true);
    expect(userCanAccessSection(guide, "stock", "demo")).toBe(false);
    expect(canAccessSection("guide", "picking")).toBe(true);
  });

  it("production: PICKER pica pero no ve costes", () => {
    const picker = { role: "guide" as const, wmsRole: "PICKER" as const };
    expect(userCanAccessSection(picker, "picking", "production")).toBe(true);
    expect(userCanAccessSection(picker, "costes", "production")).toBe(false);
    expect(userCanAccessSection(picker, "leads", "production")).toBe(false);
  });

  it("production: VIEWER no confirma pick", () => {
    const viewer = { role: "booking" as const, wmsRole: "VIEWER" as const };
    expect(userCanAccessSection(viewer, "dashboard", "production")).toBe(true);
    expect(userCanAccessSection(viewer, "picking", "production")).toBe(false);
    expect(hasWmsPermission("VIEWER", "wms.pick.confirm")).toBe(false);
  });
});
