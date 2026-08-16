import type { AppSection } from "@/lib/notifications";
import { wmsMode, type WmsMode } from "@/lib/runtime";
import type { UserRole } from "./types";
import {
  crmRoleToWmsRole,
  hasWmsPermission,
  type WmsPermission,
  type WmsRole,
} from "./wms-rbac";

/** Admin / CEO / founder: acceso total + gestión de usuarios. */
export function isPrivilegedAdmin(role: UserRole | undefined | null): boolean {
  return role === "admin";
}

export const ROLE_DESCRIPTION: Record<UserRole, { es: string; en: string }> = {
  admin: {
    es: "Dirección · acceso total al ecosistema WMS y usuarios",
    en: "Leadership · full WMS ecosystem and user management",
  },
  ops: {
    es: "Jefe de almacén · stock, huecos, flota, recepción y expedición",
    en: "Warehouse lead · stock, slots, fleet, inbound and outbound",
  },
  booking: {
    es: "Office · costes, facturas, tesorería y control administrativo",
    en: "Office · costs, invoices, treasury and admin control",
  },
  guide: {
    es: "Operario de planta · huecos, palets, flota asignada y conocimiento",
    en: "Floor operator · slots, pallets, assigned fleet and knowledge",
  },
  pending: {
    es: "Pendiente de activación · un administrador debe asignar rol",
    en: "Pending activation · an admin must assign a role",
  },
};

export const WMS_CORE: AppSection[] = [
  "dashboard",
  "stock",
  "huecos",
  "picking",
  "rf",
  "movimientos",
  "inventario",
  "palets",
  "flota",
  "recepcion",
  "expedicion",
  "operarios",
  "centros",
  "costes",
];

const SECTION_PERMISSION: Partial<Record<AppSection, WmsPermission>> = {
  dashboard: "wms.tower.read",
  stock: "wms.inventory.read",
  palets: "wms.inventory.read",
  huecos: "wms.warehouse.read",
  centros: "wms.warehouse.read",
  picking: "wms.pick.confirm",
  rf: "wms.pick.confirm",
  movimientos: "wms.pick.confirm",
  inventario: "wms.inventory.adjust",
  flota: "wms.workforce.read",
  operarios: "wms.workforce.read",
  recepcion: "wms.receiving.confirm",
  expedicion: "wms.ship.dispatch",
  costes: "wms.billing.read",
};

/** Secciones del menú visibles por rol (capa multicapa). */
export const ROLE_ALLOWED_SECTIONS: Record<UserRole, readonly AppSection[]> = {
  admin: [
    ...WMS_CORE,
    "hub",
    "leads",
    "clientes",
    "reservas",
    "facturas",
    "tesoreria",
    "aprobaciones",
    "equipo",
    "contenido",
    "conocimiento",
    "automatizaciones",
    "propuesta",
    "slides",
    "ajustes",
    "usuarios",
  ],
  ops: [
    ...WMS_CORE,
    "hub",
    "aprobaciones",
    "equipo",
    "conocimiento",
    "automatizaciones",
    "ajustes",
  ],
  booking: [
    "dashboard",
    "stock",
    "costes",
    "recepcion",
    "expedicion",
    "operarios",
    "centros",
    "hub",
    "clientes",
    "facturas",
    "tesoreria",
    "aprobaciones",
    "equipo",
    "conocimiento",
    "ajustes",
  ],
  guide: [
    "dashboard",
    "huecos",
    "picking",
    "rf",
    "movimientos",
    "inventario",
    "palets",
    "flota",
    "recepcion",
    "expedicion",
    "conocimiento",
    "ajustes",
  ],
  pending: [],
};

export function canAccessSection(role: UserRole, section: AppSection): boolean {
  return ROLE_ALLOWED_SECTIONS[role].includes(section);
}

export type AccessUser = {
  role: UserRole;
  wmsRole?: WmsRole | null;
};

/**
 * DEMO: matriz CRM histórica (Sofía/Luis/Jorge no cambian).
 * PRODUCTION: WMS por permiso; CRM sigue la matriz.
 * `pending` sin wmsRole no ve nada.
 */
export function userCanAccessSection(
  user: AccessUser,
  section: AppSection,
  mode: WmsMode = wmsMode(),
): boolean {
  const wmsSection = WMS_CORE.includes(section);

  if (!wmsSection) {
    return canAccessSection(user.role, section);
  }

  if (mode === "demo") {
    return canAccessSection(user.role, section);
  }

  const wmsRole = user.wmsRole ?? crmRoleToWmsRole(user.role);
  const needed = SECTION_PERMISSION[section];
  if (!needed) return false;
  return hasWmsPermission(wmsRole, needed);
}

/** Ajustes sensibles solo admin (negocio, IA, BD, usuarios). */
export function canManageCrmUsers(role: UserRole | undefined | null): boolean {
  return isPrivilegedAdmin(role);
}

export function canEditBusinessSettings(role: UserRole | undefined | null): boolean {
  return isPrivilegedAdmin(role);
}

export function canEditAiSettings(role: UserRole | undefined | null): boolean {
  return isPrivilegedAdmin(role);
}

export function canViewDatabaseCard(role: UserRole | undefined | null): boolean {
  return isPrivilegedAdmin(role);
}

export const ASSIGNABLE_ROLES: UserRole[] = ["admin", "ops", "booking", "guide"];
