/**
 * Conexiones de equipo ↔ expediciones ↔ coste.
 *
 * No es un módulo RRHH genérico (nóminas, equity, alta SS). Es la traducción
 * a Campo Norte de lo que en la demo de referencia hace "Laboral": ligar personas
 * del equipo a la operación y al dinero.
 *
 * Fuentes reales del Hub:
 *   - tourLeader de cada reserva
 *   - contactos logísticos
 *   - roles del equipo (guide / ops / booking)
 *
 * El coste es una ESTIMACIÓN por dieta × días de itinerario. Sin nóminas
 * reales no inventamos burn rate de empresa.
 */

import { LOCAL_TEAM_USERS, type UserRole } from "@/lib/auth/types";
import type { Reservation } from "@/lib/ops-data";

/** Dieta orientativa €/día por rol (pitch / semilla). */
export const TEAM_DAY_RATE: Record<UserRole, number> = {
  guide: 180,
  ops: 140,
  booking: 90,
  admin: 0,
};

export interface TeamAssignment {
  reservationId: string;
  tripName: string;
  route: string;
  departureAt: string;
  personName: string;
  role: UserRole | "externo";
  days: number;
  dayRate: number;
  cost: number;
  status: Reservation["status"];
}

export interface TeamMemberCost {
  name: string;
  role: UserRole | "externo";
  trips: number;
  days: number;
  cost: number;
  reservationIds: string[];
}

export interface TeamOpsSnapshot {
  assignments: TeamAssignment[];
  byMember: TeamMemberCost[];
  /** Coste pendiente de expediciones no cerradas. */
  pendingCost: number;
  /** Coste de expediciones ya cerradas (histórico). */
  closedCost: number;
  /** Coste por mes de salida "YYYY-MM" → importe (para flujo de caja). */
  costByDepartureMonth: Record<string, number>;
}

function monthKeyFromIso(iso: string): string | null {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function resolvePerson(name: string): { role: UserRole | "externo"; dayRate: number } {
  const n = name.trim().toLowerCase();
  const hit = LOCAL_TEAM_USERS.find((u) => u.name.toLowerCase() === n);
  if (hit) return { role: hit.role, dayRate: TEAM_DAY_RATE[hit.role] };
  // Guía externo / proveedor: tarifa guía por defecto.
  return { role: "externo", dayRate: TEAM_DAY_RATE.guide };
}

function tripDays(r: Reservation): number {
  if (r.itinerary.length > 0) return Math.max(1, r.itinerary.length);
  return 8;
}

/**
 * Construye el grafo equipo ↔ reservas y el coste estimado.
 */
export function buildTeamOps(reservations: Reservation[] = []): TeamOpsSnapshot {
  const assignments: TeamAssignment[] = [];
  const costByDepartureMonth: Record<string, number> = {};

  for (const r of reservations) {
    const people = new Set<string>();
    if (r.tourLeader.trim()) people.add(r.tourLeader.trim());
    for (const c of r.logisticsContacts) {
      if (c.name.trim()) people.add(c.name.trim());
    }

    const days = tripDays(r);
    for (const personName of people) {
      const { role, dayRate } = resolvePerson(personName);
      // Contactos logísticos locales (hoteles…) no son coste de equipo:
      // solo contamos tour leader y miembros del equipo CRM.
      if (personName !== r.tourLeader.trim() && role === "externo") continue;

      const cost = dayRate * days;
      assignments.push({
        reservationId: r.id,
        tripName: r.tripName,
        route: r.route,
        departureAt: r.departureAt,
        personName,
        role,
        days,
        dayRate,
        cost,
        status: r.status,
      });

      if (r.status !== "cerrado") {
        const mk = monthKeyFromIso(r.departureAt);
        if (mk) costByDepartureMonth[mk] = (costByDepartureMonth[mk] ?? 0) + cost;
      }
    }
  }

  const byMemberMap = new Map<string, TeamMemberCost>();
  for (const a of assignments) {
    const cur = byMemberMap.get(a.personName) ?? {
      name: a.personName,
      role: a.role,
      trips: 0,
      days: 0,
      cost: 0,
      reservationIds: [],
    };
    cur.trips += 1;
    cur.days += a.days;
    cur.cost += a.cost;
    cur.reservationIds.push(a.reservationId);
    byMemberMap.set(a.personName, cur);
  }

  let pendingCost = 0;
  let closedCost = 0;
  for (const a of assignments) {
    if (a.status === "cerrado") closedCost += a.cost;
    else pendingCost += a.cost;
  }

  return {
    assignments: assignments.sort((a, b) => a.departureAt.localeCompare(b.departureAt)),
    byMember: [...byMemberMap.values()].sort((a, b) => b.cost - a.cost),
    pendingCost,
    closedCost,
    costByDepartureMonth,
  };
}
