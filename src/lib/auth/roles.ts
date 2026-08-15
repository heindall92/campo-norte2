import type { AppSection } from "@/lib/notifications";
import type { UserRole } from "./types";

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
};

const WMS_CORE: AppSection[] = [
  "dashboard",
  "stock",
  "huecos",
  "picking",
  "palets",
  "flota",
  "recepcion",
  "expedicion",
  "operarios",
  "costes",
];

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
    "hub",
    "clientes",
    "facturas",
    "tesoreria",
    "aprobaciones",
    "equipo",
    "conocimiento",
    "ajustes",
  ],
  guide: ["dashboard", "huecos", "picking", "palets", "flota", "recepcion", "expedicion", "conocimiento", "ajustes"],
};

export function canAccessSection(role: UserRole, section: AppSection): boolean {
  return ROLE_ALLOWED_SECTIONS[role].includes(section);
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
