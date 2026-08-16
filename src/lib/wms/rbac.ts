/**
 * RBAC de planta. El menú CRM (admin/ops/booking/guide) no basta:
 * el permiso se resuelve por rol WMS + org + almacén.
 */

import type { UserRole } from "@/lib/auth/types";

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
  "stock.read",
  "stock.write",
  "wave.assign",
  "pick",
  "pack",
  "ship",
  "receive",
  "putaway",
  "replenish",
  "count",
  "adjust",
  "audit.read",
  "copilot.recommend",
  "copilot.execute",
  "org.admin",
  "warehouse.manage",
] as const;

export type WmsPermission = (typeof WMS_PERMISSIONS)[number];

const ALL_PERMS = WMS_PERMISSIONS;

const ROLE_PERMS: Record<WmsRole, readonly WmsPermission[]> = {
  ADMIN: ALL_PERMS,
  WAREHOUSE_MANAGER: ALL_PERMS.filter((p) => p !== "org.admin"),
  SUPERVISOR: [
    "stock.read",
    "stock.write",
    "wave.assign",
    "pick",
    "pack",
    "ship",
    "receive",
    "putaway",
    "replenish",
    "count",
    "audit.read",
    "copilot.recommend",
    "warehouse.manage",
  ],
  RECEIVING: ["stock.read", "stock.write", "receive", "putaway"],
  PICKER: ["stock.read", "stock.write", "pick"],
  PACKER: ["stock.read", "pack"],
  SHIPPER: ["stock.read", "pack", "ship"],
  FORKLIFT_OPERATOR: ["stock.read", "stock.write", "putaway", "replenish"],
  INVENTORY_CONTROLLER: ["stock.read", "stock.write", "count", "adjust", "audit.read"],
  AUDITOR: ["stock.read", "audit.read"],
  VIEWER: ["stock.read", "audit.read", "copilot.recommend"],
};

/** CRM → roles de planta. Un tenant; no se inventan cuentas. */
export const CRM_TO_WMS_ROLES: Record<UserRole | "pending", readonly WmsRole[]> = {
  admin: ["ADMIN"],
  ops: ["WAREHOUSE_MANAGER"],
  booking: ["VIEWER"],
  guide: ["PICKER"],
  pending: [],
};

export function isWmsRole(value: string): value is WmsRole {
  return (WMS_ROLES as readonly string[]).includes(value);
}

export function isWmsPermission(value: string): value is WmsPermission {
  return (WMS_PERMISSIONS as readonly string[]).includes(value);
}

export function permissionsForRole(role: WmsRole): readonly WmsPermission[] {
  return ROLE_PERMS[role];
}

export function roleHasPermission(role: WmsRole, perm: WmsPermission): boolean {
  return ROLE_PERMS[role].includes(perm);
}

export function permissionsForRoles(roles: readonly WmsRole[]): WmsPermission[] {
  const set = new Set<WmsPermission>();
  for (const role of roles) {
    for (const perm of ROLE_PERMS[role]) set.add(perm);
  }
  return [...set];
}

export function mapCrmRoleToWms(role: UserRole | "pending"): readonly WmsRole[] {
  return CRM_TO_WMS_ROLES[role];
}

/** Pertenencia de un usuario de auth al org. Sin contraseñas. */
export type WmsMembership = {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  roles: WmsRole[];
  warehouseIds: string[] | "*";
};
