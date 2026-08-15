/**
 * Tesorería — adaptación del módulo financiero de la demo a nuestro negocio.
 *
 * La demo parte de cuentas bancarias reales y concilia extractos. Nosotros no
 * tenemos banco conectado, así que el movimiento se DERIVA de lo que sí
 * tenemos: facturas emitidas y señales de reserva. La conciliación aquí es el
 * enlace factura ↔ cobro registrado.
 *
 * Cálculos tomados del análisis (docs/GAP-DEMO-ANATOMIA.md §5), traducidos:
 *
 *   Aurora                    →  Growth OS
 *   ─────────────────────────────────────────────────────────────
 *   Saldo en cuentas          →  Cobrado real
 *   Por cobrar                →  Pendiente de facturas + saldos de reserva
 *   Proyección de cierre      →  Cobrado + comprometido pendiente
 *   MRR / ARR                 →  Cartera comprometida (reservas futuras)
 *   Categorías de gasto       →  Ingreso por ruta
 *
 * Runway y burn rate se dejan FUERA a propósito: sin datos de gasto real
 * serían una cifra inventada, y un dashboard que inventa se deja de mirar.
 */

import { daysBetween } from "@/lib/format";
import type { RouteCode } from "@/lib/demo-data";
import type { Invoice, Reservation } from "@/lib/ops-data";

export type MovementKind = "cobro_factura" | "senal_reserva" | "saldo_pendiente";

export type MovementStatus = "cobrado" | "pendiente" | "vencido";

export interface Movement {
  id: string;
  date: string;
  /** Línea principal: qué es. */
  concept: string;
  /** Línea secundaria: con quién. */
  counterparty: string;
  /** Dimensión reutilizada en el gráfico de reparto. */
  category: string;
  route: RouteCode | null;
  status: MovementStatus;
  amount: number;
  /** Entidad de origen, para navegar a donde se resuelve. */
  sourceId: string;
}

export interface CashFlowPoint {
  /** "2026-08" */
  month: string;
  label: string;
  cobrado: number;
  pendiente: number;
  /** Coste de equipo estimado en el mes de salida. */
  salidas: number;
}

export interface RouteRevenue {
  route: RouteCode;
  amount: number;
  pct: number;
}

export interface TreasurySnapshot {
  movements: Movement[];
  /** Dinero que ya ha entrado. */
  collected: number;
  /** Facturado y aún no cobrado. */
  receivable: number;
  /** Vencido: facturado hace más de `dueDays` y sin cobrar. */
  overdue: number;
  /** Reservas futuras aún no facturadas del todo. */
  committed: number;
  /** Coste de equipo pendiente (conexiones tour leader ↔ expedición). */
  teamPayable: number;
  /** collected + receivable + committed (bruto). */
  projectedClose: number;
  /** collected + receivable − teamPayable (cierre neto operativo). */
  projectedCloseNet: number;
  cashFlow: CashFlowPoint[];
  byRoute: RouteRevenue[];
}

export interface BuildTreasuryInput {
  invoices?: Invoice[];
  reservations?: Reservation[];
  now?: Date;
  /** Días desde emisión tras los cuales una factura se considera vencida. */
  dueDays?: number;
  /** Meses hacia atrás en la serie de flujo de caja. */
  months?: number;
  /** Coste de equipo por mes de salida ("YYYY-MM" → €). */
  teamCostByMonth?: Record<string, number>;
  /** Coste de equipo pendiente total (expediciones abiertas). */
  teamPayable?: number;
}

const DEFAULT_DUE_DAYS = 30;
const DEFAULT_MONTHS = 12;

const MONTH_LABEL = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return `${MONTH_LABEL[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

/* ------------------------------------------------------------------ *
 * Movimientos
 * ------------------------------------------------------------------ */

function movementsFromInvoices(invoices: Invoice[], now: Date, dueDays: number): Movement[] {
  const out: Movement[] = [];

  for (const inv of invoices) {
    if (inv.status === "borrador" || inv.status === "anulada") continue;

    // Parte cobrada: movimiento real, con su fecha de cobro.
    if (inv.amountCollected > 0) {
      out.push({
        id: `cobro:${inv.id}`,
        date: inv.collectedAt ?? inv.issueDate,
        concept: `Cobro factura ${inv.number}`,
        counterparty: inv.clientName,
        category: "Cobros de factura",
        route: null,
        status: "cobrado",
        amount: inv.amountCollected,
        sourceId: inv.id,
      });
    }

    // Parte pendiente: previsión, no caja.
    const outstanding = inv.total - inv.amountCollected;
    if (outstanding > 0) {
      const age = daysBetween(inv.issueDate, now);
      out.push({
        id: `pendiente:${inv.id}`,
        date: inv.issueDate,
        concept: `Pendiente factura ${inv.number}`,
        counterparty: inv.clientName,
        category: "Pendiente de cobro",
        route: null,
        status: age > dueDays ? "vencido" : "pendiente",
        amount: outstanding,
        sourceId: inv.id,
      });
    }
  }

  return out;
}

function movementsFromReservations(reservations: Reservation[]): Movement[] {
  const out: Movement[] = [];

  for (const r of reservations) {
    if (r.status === "cerrado") continue;

    if (r.depositPaid > 0) {
      out.push({
        id: `senal:${r.id}`,
        date: r.bookedAt,
        concept: `Señal · ${r.tripName}`,
        counterparty: r.clientName,
        category: "Señales de reserva",
        route: r.route,
        status: "cobrado",
        amount: r.depositPaid,
        sourceId: r.id,
      });
    }

    const pending = r.totalAmount - r.depositPaid;
    if (pending > 0) {
      out.push({
        id: `saldo:${r.id}`,
        date: r.departureAt,
        concept: `Saldo pendiente · ${r.tripName}`,
        counterparty: r.clientName,
        category: "Saldos comprometidos",
        route: r.route,
        status: "pendiente",
        amount: pending,
        sourceId: r.id,
      });
    }
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Series
 * ------------------------------------------------------------------ */

function buildCashFlow(
  movements: Movement[],
  now: Date,
  months: number,
  teamCostByMonth: Record<string, number> = {},
): CashFlowPoint[] {
  const buckets = new Map<string, CashFlowPoint>();

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    buckets.set(key, {
      month: key,
      label: monthLabel(d),
      cobrado: 0,
      pendiente: 0,
      salidas: teamCostByMonth[key] ?? 0,
    });
  }

  for (const m of movements) {
    const d = new Date(m.date);
    if (Number.isNaN(d.getTime())) continue;
    const bucket = buckets.get(monthKey(d));
    if (!bucket) continue;
    if (m.status === "cobrado") bucket.cobrado += m.amount;
    else bucket.pendiente += m.amount;
  }

  return [...buckets.values()];
}

function buildByRoute(movements: Movement[]): RouteRevenue[] {
  const totals = new Map<RouteCode, number>();

  for (const m of movements) {
    if (!m.route) continue;
    totals.set(m.route, (totals.get(m.route) ?? 0) + m.amount);
  }

  const grand = [...totals.values()].reduce((s, v) => s + v, 0);
  if (grand === 0) return [];

  return [...totals.entries()]
    .map(([route, amount]) => ({ route, amount, pct: (amount / grand) * 100 }))
    .sort((a, b) => b.amount - a.amount);
}

/* ------------------------------------------------------------------ *
 * API pública
 * ------------------------------------------------------------------ */

export function buildTreasury(input: BuildTreasuryInput): TreasurySnapshot {
  const now = input.now ?? new Date();
  const dueDays = input.dueDays ?? DEFAULT_DUE_DAYS;
  const months = input.months ?? DEFAULT_MONTHS;

  const movements = [
    ...movementsFromInvoices(input.invoices ?? [], now, dueDays),
    ...movementsFromReservations(input.reservations ?? []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let collected = 0;
  let receivable = 0;
  let overdue = 0;
  let committed = 0;

  for (const m of movements) {
    if (m.status === "cobrado") {
      collected += m.amount;
    } else if (m.category === "Saldos comprometidos") {
      committed += m.amount;
    } else {
      receivable += m.amount;
      if (m.status === "vencido") overdue += m.amount;
    }
  }

  const teamPayable = input.teamPayable ?? 0;
  const projectedClose = collected + receivable + committed;

  return {
    movements,
    collected,
    receivable,
    overdue,
    committed,
    teamPayable,
    projectedClose,
    projectedCloseNet: collected + receivable - teamPayable,
    cashFlow: buildCashFlow(movements, now, months, input.teamCostByMonth),
    byRoute: buildByRoute(movements),
  };
}

/**
 * Totales de la vista filtrada.
 *
 * Existe para alimentar el rótulo "EN ESTA VISTA": los agregados deben
 * recalcularse sobre las filas visibles, nunca sobre el conjunto entero.
 */
export function totalsForView(movements: Movement[]): {
  cobrado: number;
  pendiente: number;
  neto: number;
  count: number;
} {
  let cobrado = 0;
  let pendiente = 0;

  for (const m of movements) {
    if (m.status === "cobrado") cobrado += m.amount;
    else pendiente += m.amount;
  }

  return { cobrado, pendiente, neto: cobrado + pendiente, count: movements.length };
}

/** Variación % frente al mismo punto del periodo anterior. */
export function deltaVsPrevious(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
