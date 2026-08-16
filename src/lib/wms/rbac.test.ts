import { describe, expect, it } from "vitest";
import { actorFromMembership, authorizeWms, authorizeWmsWrite, can, type WmsActor } from "./permissions";
import {
  CRM_TO_WMS_ROLES,
  permissionsForRole,
  roleHasPermission,
  WMS_ROLES,
} from "./rbac";
import { CAMPO_NORTE_ORG } from "./org";
import { buildWmsSeed } from "./seed";
import { projectTenant, seedMemberships } from "./tenant";
import { prepareLedgerPush, shouldUseRemoteLedger } from "./persist";

const org = CAMPO_NORTE_ORG.id;

function actor(role: WmsActor["role"], warehouseIds: WmsActor["warehouseIds"] = "*"): WmsActor {
  return { role, orgId: org, warehouseIds };
}

describe("RBAC WMS", () => {
  it("tiene los 11 roles de planta", () => {
    expect(WMS_ROLES).toEqual([
      "ADMIN",
      "WAREHOUSE_MANAGER",
      "SUPERVISOR",
      "RECEIVING",
      "PICKER",
      "PACKER",
      "SHIPPER",
      "FORKLIFT_OPERATOR",
      "INVENTORY_CONTROLLER",
      "AUDITOR",
      "VIEWER",
    ]);
  });

  it("VIEWER y AUDITOR no escriben; PICKER no expide; SHIPPER no pica", () => {
    expect(roleHasPermission("VIEWER", "stock.write")).toBe(false);
    expect(roleHasPermission("AUDITOR", "ship")).toBe(false);
    expect(roleHasPermission("AUDITOR", "audit.read")).toBe(true);
    expect(roleHasPermission("PICKER", "pick")).toBe(true);
    expect(roleHasPermission("PICKER", "ship")).toBe(false);
    expect(roleHasPermission("SHIPPER", "ship")).toBe(true);
    expect(roleHasPermission("SHIPPER", "pick")).toBe(false);
    expect(roleHasPermission("RECEIVING", "receive")).toBe(true);
    expect(roleHasPermission("FORKLIFT_OPERATOR", "putaway")).toBe(true);
    expect(roleHasPermission("INVENTORY_CONTROLLER", "adjust")).toBe(true);
    expect(permissionsForRole("ADMIN")).toContain("org.admin");
    expect(permissionsForRole("WAREHOUSE_MANAGER")).not.toContain("org.admin");
  });

  it("el mapeo CRM no inventa roles: booking no expide, planta no asigna ola", () => {
    expect(CRM_TO_WMS_ROLES.booking).toEqual(["VIEWER"]);
    expect(CRM_TO_WMS_ROLES.guide).toEqual(["PICKER"]);
    const snap = buildWmsSeed();
    expect(authorizeWms(snap, actor("booking"), "ship", "site-sev").ok).toBe(false);
    expect(authorizeWms(snap, actor("guide"), "wave.assign", "site-sev").ok).toBe(false);
    expect(authorizeWms(snap, actor("guide"), "stock.write", "site-sev").ok).toBe(true);
    expect(authorizeWms(snap, actor("ops"), "ship", "site-sev").ok).toBe(true);
    expect(can(actor("pending"), "stock.read")).toBe(false);
  });

  it("otro org no entra; Jorge no escribe en Huelva", () => {
    const snap = buildWmsSeed();
    const jorge = seedMemberships().find((m) => m.email === "jorge@camponorte.demo")!;
    const actorJ = actorFromMembership(jorge, "guide");
    const hue = authorizeWms(snap, actorJ, "stock.write", "site-hue");
    expect(hue.ok).toBe(false);
    if (!hue.ok) expect(hue.error).toBe("warehouse_forbidden");
    const stranger: WmsActor = { role: "ops", orgId: "org-otra", warehouseIds: "*" };
    const other = authorizeWms(snap, stranger, "stock.read");
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.error).toBe("org_mismatch");
  });

  it("en producción la escritura exige actor", () => {
    const snap = buildWmsSeed();
    const denied = authorizeWmsWrite(snap, null, "stock.write", "site-sev", true);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error).toBe("auth_required");
    const demo = authorizeWmsWrite(snap, null, "stock.write", "site-sev", false);
    expect(demo.ok).toBe(true);
  });
});

describe("tenant graph", () => {
  it("proyecta 1 org, 2 almacenes, zonas y ubicaciones reales", () => {
    const snap = buildWmsSeed();
    const graph = projectTenant(snap);
    expect(graph.organization.id).toBe("org-camponorte");
    expect(graph.warehouses).toHaveLength(2);
    expect(graph.warehouses.map((w) => w.id).sort()).toEqual(["site-hue", "site-sev"]);
    expect(graph.zones.length).toBeGreaterThan(0);
    expect(graph.locations).toHaveLength(snap.slots.length);
    expect(graph.memberships).toHaveLength(4);
    expect(graph.memberships.every((m) => m.organizationId === "org-camponorte")).toBe(true);
  });
});

describe("persistencia ledger", () => {
  it("demo no escribe Postgres; producción exige revisión y permiso", () => {
    expect(
      shouldUseRemoteLedger({ mode: "demo", forceLocalHub: false, supabaseConfigured: true }),
    ).toBe(false);
    expect(
      shouldUseRemoteLedger({ mode: "production", forceLocalHub: true, supabaseConfigured: true }),
    ).toBe(false);
    expect(
      shouldUseRemoteLedger({ mode: "production", forceLocalHub: false, supabaseConfigured: true }),
    ).toBe(true);

    const snap = buildWmsSeed();
    const local = prepareLedgerPush({
      snap,
      actor: actor("ops"),
      expectedRevision: 0,
      requireActor: false,
      remote: false,
    });
    expect(local.ok).toBe(false);
    if (!local.ok) expect(local.error).toBe("demo_local_only");

    const stale = prepareLedgerPush({
      snap: { ...snap, ledgerRevision: 3 },
      actor: actor("ops"),
      expectedRevision: 0,
      requireActor: true,
      remote: true,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error).toBe("revision_conflict");

    const viewer = prepareLedgerPush({
      snap,
      actor: actor("booking"),
      expectedRevision: 0,
      requireActor: true,
      remote: true,
    });
    expect(viewer.ok).toBe(false);
    if (!viewer.ok) expect(viewer.error).toBe("forbidden");

    const ok = prepareLedgerPush({
      snap,
      actor: actor("ops"),
      expectedRevision: 0,
      requireActor: true,
      remote: true,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.revision).toBe(1);
  });
});
