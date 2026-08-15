/**
 * Próximos movimientos de caja — cobros/pagos derivados del Hub.
 * Equivalente conceptual a la mini-tabla de Aurora bajo «Caja y previsión».
 */

import type { Invoice, Reservation } from "@/lib/ops-data";
import { buildTeamOps } from "@/lib/team-ops";

export type UpcomingKind = "cobro" | "pago_equipo" | "saldo_reserva";

export interface UpcomingMovement {
  id: string;
  date: string;
  kind: UpcomingKind;
  label: string;
  counterparty: string;
  amount: number;
  status: "programado" | "vencimiento" | "vencido";
  source: "factura" | "reserva" | "equipo";
  sourceId: string;
}

function dayStatus(iso: string, now: Date): UpcomingMovement["status"] {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "programado";
  const diff = (d.getTime() - now.getTime()) / 86_400_000;
  if (diff < 0) return "vencido";
  if (diff <= 14) return "vencimiento";
  return "programado";
}

export function buildUpcomingMovements(input: {
  invoices?: Invoice[];
  reservations?: Reservation[];
  now?: Date;
  limit?: number;
}): UpcomingMovement[] {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 8;
  const out: UpcomingMovement[] = [];

  for (const inv of input.invoices ?? []) {
    if (inv.status === "anulada" || inv.status === "borrador") continue;
    const outstanding = inv.total - inv.amountCollected;
    if (outstanding <= 0) continue;
    const due = new Date(inv.issueDate);
    due.setUTCDate(due.getUTCDate() + 30);
    const date = due.toISOString().slice(0, 10);
    out.push({
      id: `inv:${inv.id}`,
      date,
      kind: "cobro",
      label: `Cobro factura ${inv.number}`,
      counterparty: inv.clientName,
      amount: outstanding,
      status: dayStatus(date, now),
      source: "factura",
      sourceId: inv.id,
    });
  }

  for (const r of input.reservations ?? []) {
    if (r.status === "cerrado") continue;
    const pending = r.totalAmount - r.depositPaid;
    if (pending <= 0) continue;
    out.push({
      id: `saldo:${r.id}`,
      date: r.departureAt.slice(0, 10),
      kind: "saldo_reserva",
      label: `Saldo · ${r.tripName}`,
      counterparty: r.clientName,
      amount: pending,
      status: dayStatus(r.departureAt, now),
      source: "reserva",
      sourceId: r.id,
    });
  }

  const team = buildTeamOps(input.reservations);
  for (const a of team.assignments) {
    if (a.status === "cerrado") continue;
    out.push({
      id: `team:${a.reservationId}:${a.personName}`,
      date: a.departureAt.slice(0, 10),
      kind: "pago_equipo",
      label: `Dietas · ${a.personName}`,
      counterparty: a.tripName,
      amount: -a.cost,
      status: dayStatus(a.departureAt, now),
      source: "equipo",
      sourceId: a.reservationId,
    });
  }

  return out
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}
