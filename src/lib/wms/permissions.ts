import type { AppUser, UserRole } from "@/lib/auth/types";
import { belongsToOrg } from "./org";
import {
  mapCrmRoleToWms,
  permissionsForRoles,
  type WmsPermission,
  type WmsRole,
} from "./rbac";
import type { WmsMembership } from "./rbac";
import { seedMemberships } from "./tenant";
import type { WmsSnapshot } from "./types";

export type WmsActor = {
  role: UserRole | "pending";
  /** Si viene, manda sobre el mapeo CRM. */
  wmsRoles?: readonly WmsRole[];
  orgId: string;
  /** Lista de centros o `*` (todos los del org). */
  warehouseIds: string[] | "*";
  userId?: string;
};

export type AuthzError = "forbidden" | "org_mismatch" | "warehouse_forbidden" | "confirmation_required" | "auth_required";

export function effectiveWmsRoles(actor: WmsActor): readonly WmsRole[] {
  if (actor.wmsRoles?.length) return actor.wmsRoles;
  return mapCrmRoleToWms(actor.role);
}

export function can(actor: WmsActor, perm: WmsPermission): boolean {
  return permissionsForRoles(effectiveWmsRoles(actor)).includes(perm);
}

export function canAccessWarehouse(actor: WmsActor, warehouseId: string): boolean {
  if (actor.warehouseIds === "*") return true;
  return actor.warehouseIds.includes(warehouseId);
}

export function actorFromMembership(row: WmsMembership, crmRole: UserRole | "pending" = "pending"): WmsActor {
  return {
    role: crmRole,
    wmsRoles: row.roles,
    orgId: row.organizationId,
    warehouseIds: row.warehouseIds,
    userId: row.userId,
  };
}

/**
 * Actor de la sesión CRM. Membership manda; si no hay fila, mapeo CRM.
 * Un guide sin membership queda acotado a Sevilla, como Jorge: no se inventa Huelva.
 */
export function actorFromAppUser(snap: WmsSnapshot, user: AppUser | null): WmsActor | null {
  if (!user) return null;
  const rows = snap.memberships?.length ? snap.memberships : seedMemberships(snap.org.id);
  const membership =
    rows.find((m) => m.userId === user.id) ??
    rows.find((m) => m.email.toLowerCase() === user.email.toLowerCase());
  if (membership) return actorFromMembership(membership, user.role);
  return {
    role: user.role,
    wmsRoles: [...mapCrmRoleToWms(user.role)],
    orgId: snap.org.id,
    warehouseIds: user.role === "guide" ? ["site-sev"] : "*",
    userId: user.id,
  };
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

/**
 * En producción toda escritura exige actor. En demo el motor de planta
 * puede seguir llamándose desde tests sin sesión.
 */
export function authorizeWmsWrite(
  snap: WmsSnapshot,
  actor: WmsActor | null,
  perm: WmsPermission,
  warehouseId: string | undefined,
  requireActor: boolean,
): { ok: true; actor: WmsActor | null } | { ok: false; error: AuthzError } {
  if (requireActor && !actor) return { ok: false, error: "auth_required" };
  if (!actor) return { ok: true, actor: null };
  const gate = authorizeWms(snap, actor, perm, warehouseId);
  if (!gate.ok) return gate;
  return { ok: true, actor };
}

export function requireConfirmation(confirmed: boolean): { ok: true } | { ok: false; error: AuthzError } {
  if (!confirmed) return { ok: false, error: "confirmation_required" };
  return { ok: true };
}
