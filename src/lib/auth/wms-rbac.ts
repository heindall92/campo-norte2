import type { UserRole } from "./types";

/** Roles de planta WMS (Phase 1). Independientes del enum CRM admin/ops/booking/guide. */
export const WMS_ROLES = [
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
] as const;

export type WmsRole = (typeof WMS_ROLES)[number];

export const WMS_PERMISSIONS = [
  "wms.tower.read",
  "wms.warehouse.read",
  "wms.warehouse.write",
  "wms.inventory.read",
  "wms.inventory.adjust",
  "wms.catalog.write",
  "wms.pick.confirm",
  "wms.receiving.confirm",
  "wms.ship.dispatch",
  "wms.workforce.read",
  "wms.workforce.write",
  "wms.billing.read",
  "wms.audit.read",
  "wms.settings.admin",
] as const;

export type WmsPermission = (typeof WMS_PERMISSIONS)[number];

export const WMS_ROLE_LABEL: Record<WmsRole, { es: string; en: string }> = {
  ADMIN: { es: "Administrador", en: "Administrator" },
  WAREHOUSE_MANAGER: { es: "Jefe de almacén", en: "Warehouse manager" },
  SUPERVISOR: { es: "Supervisor", en: "Supervisor" },
  RECEIVING: { es: "Recepción", en: "Receiving" },
  PICKER: { es: "Picker", en: "Picker" },
  PACKER: { es: "Embalador", en: "Packer" },
  SHIPPER: { es: "Expedición", en: "Shipper" },
  FORKLIFT_OPERATOR: { es: "Carretillero", en: "Forklift operator" },
  INVENTORY_CONTROLLER: { es: "Control de inventario", en: "Inventory controller" },
  AUDITOR: { es: "Auditor", en: "Auditor" },
  VIEWER: { es: "Consulta", en: "Viewer" },
};

const ALL_PERMS = [...WMS_PERMISSIONS];

export const WMS_ROLE_PERMISSIONS: Record<WmsRole, readonly WmsPermission[]> = {
  ADMIN: ALL_PERMS,
  WAREHOUSE_MANAGER: ALL_PERMS,
  SUPERVISOR: [
    "wms.tower.read",
    "wms.warehouse.read",
    "wms.inventory.read",
    "wms.pick.confirm",
    "wms.receiving.confirm",
    "wms.ship.dispatch",
    "wms.workforce.read",
    "wms.billing.read",
  ],
  RECEIVING: ["wms.tower.read", "wms.warehouse.read", "wms.inventory.read", "wms.receiving.confirm"],
  PICKER: ["wms.tower.read", "wms.warehouse.read", "wms.inventory.read", "wms.pick.confirm"],
  PACKER: ["wms.tower.read", "wms.inventory.read", "wms.ship.dispatch"],
  SHIPPER: ["wms.tower.read", "wms.inventory.read", "wms.ship.dispatch", "wms.warehouse.read"],
  FORKLIFT_OPERATOR: [
    "wms.tower.read",
    "wms.warehouse.read",
    "wms.inventory.read",
    "wms.pick.confirm",
    "wms.receiving.confirm",
    "wms.workforce.read",
  ],
  INVENTORY_CONTROLLER: [
    "wms.tower.read",
    "wms.warehouse.read",
    "wms.inventory.read",
    "wms.inventory.adjust",
    "wms.catalog.write",
  ],
  AUDITOR: [
    "wms.tower.read",
    "wms.warehouse.read",
    "wms.inventory.read",
    "wms.workforce.read",
    "wms.billing.read",
    "wms.audit.read",
  ],
  VIEWER: ["wms.tower.read", "wms.warehouse.read", "wms.inventory.read", "wms.billing.read"],
};

const ROLE_RANK: Record<WmsRole, number> = {
  ADMIN: 100,
  WAREHOUSE_MANAGER: 90,
  SUPERVISOR: 80,
  INVENTORY_CONTROLLER: 70,
  FORKLIFT_OPERATOR: 60,
  SHIPPER: 55,
  RECEIVING: 50,
  PACKER: 45,
  PICKER: 40,
  AUDITOR: 30,
  VIEWER: 10,
};

export function isWmsRole(value: unknown): value is WmsRole {
  return typeof value === "string" && (WMS_ROLES as readonly string[]).includes(value);
}

export function permissionsForWmsRole(role: WmsRole): readonly WmsPermission[] {
  return WMS_ROLE_PERMISSIONS[role];
}

export function hasWmsPermission(role: WmsRole | null | undefined, permission: WmsPermission): boolean {
  if (!role) return false;
  return WMS_ROLE_PERMISSIONS[role].includes(permission);
}

/** Demo CRM → rol WMS. `pending` no opera planta. */
export function crmRoleToWmsRole(role: UserRole): WmsRole | null {
  switch (role) {
    case "admin":
      return "ADMIN";
    case "ops":
      return "WAREHOUSE_MANAGER";
    case "booking":
      return "VIEWER";
    case "guide":
      return "PICKER";
    case "pending":
      return null;
    default:
      return null;
  }
}

/** Inverso para el shell CRM cuando solo hay rol WMS. */
export function wmsRoleToCrmRole(role: WmsRole): UserRole {
  switch (role) {
    case "ADMIN":
      return "admin";
    case "WAREHOUSE_MANAGER":
    case "SUPERVISOR":
      return "ops";
    case "VIEWER":
    case "AUDITOR":
      return "booking";
    default:
      return "guide";
  }
}

export function pickHighestWmsRole(roles: readonly unknown[]): WmsRole | null {
  let best: WmsRole | null = null;
  for (const raw of roles) {
    if (!isWmsRole(raw)) continue;
    if (!best || ROLE_RANK[raw] > ROLE_RANK[best]) best = raw;
  }
  return best;
}
