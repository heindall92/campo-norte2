import type { UserRole } from "@/lib/auth/types";
import { belongsToOrg } from "./org";
import type { WmsSnapshot } from "./types";

export type WmsPermission =
  | "stock.read"
  | "stock.write"
  | "wave.assign"
  | "ship"
  | "receive"
  | "audit.read"
  | "copilot.recommend"
  | "copilot.execute";

export type WmsActor = {
  role: UserRole | "pending";
  orgId: string;
  /** Lista de centros o `*` (todos los del org). */
  warehouseIds: string[] | "*";
};

export type AuthzError = "forbidden" | "org_mismatch" | "warehouse_forbidden" | "confirmation_required";

const ROLE_PERMS: Record<UserRole | "pending", readonly WmsPermission[]> = {
  admin: [
    "stock.read",
    "stock.write",
    "wave.assign",
    "ship",
    "receive",
    "audit.read",
    "copilot.recommend",
    "copilot.execute",
  ],
  ops: [
    "stock.read",
    "stock.write",
    "wave.assign",
    "ship",
    "receive",
    "audit.read",
    "copilot.recommend",
    "copilot.execute",
  ],
  booking: ["stock.read", "audit.read", "copilot.recommend"],
  guide: ["stock.read", "stock.write", "receive", "copilot.recommend"],
  pending: [],
};

export function can(actor: WmsActor, perm: WmsPermission): boolean {
  return ROLE_PERMS[actor.role].includes(perm);
}

export function canAccessWarehouse(actor: WmsActor, warehouseId: string): boolean {
  if (actor.warehouseIds === "*") return true;
  return actor.warehouseIds.includes(warehouseId);
}

/**
 * Autorización de servidor. El frontend no basta:
 * hay que pasar el actor resuelto (sesión), no un flag de UI.
 */
export function authorizeWms(
  snap: WmsSnapshot,
  actor: WmsActor,
  perm: WmsPermission,
  warehouseId?: string,
): { ok: true } | { ok: false; error: AuthzError } {
  if (actor.orgId !== snap.org.id) return { ok: false, error: "org_mismatch" };
  if (!can(actor, perm)) return { ok: false, error: "forbidden" };
  if (warehouseId) {
    if (!belongsToOrg(snap, warehouseId, actor.orgId)) return { ok: false, error: "org_mismatch" };
    if (!canAccessWarehouse(actor, warehouseId)) return { ok: false, error: "warehouse_forbidden" };
  }
  return { ok: true };
}

export function requireConfirmation(confirmed: boolean): { ok: true } | { ok: false; error: AuthzError } {
  if (!confirmed) return { ok: false, error: "confirmation_required" };
  return { ok: true };
}
