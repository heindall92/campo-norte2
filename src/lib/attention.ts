/**
 * "Requiere tu atención" — cola de acción unificada.
 *
 * Vista DERIVADA: no tiene almacenamiento propio. Recorre leads, reservas y
 * facturas, extrae las excepciones y las ordena por urgencia. Ese es el diseño
 * correcto (docs/GAP-DEMO-ANATOMIA.md §4): añadir una fuente nueva es añadir
 * un colector, no una tabla.
 *
 * Regla de oro del proyecto: esto NO escribe a nadie. Solo señala qué mirar y
 * enlaza a donde se resuelve.
 */

import { coldByDate, decayFactor } from "@/lib/ai/lead-scoring-core";
import type { Lead } from "@/lib/demo-data";
import { daysBetween, formatDateShort, formatEur } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { Invoice, Reservation } from "@/lib/ops-data";

export type AttentionSeverity = "vencido" | "proximo" | "seguimiento";

export type AttentionSource = "lead" | "reserva" | "factura";

export interface AttentionItem {
  id: string;
  source: AttentionSource;
  severity: AttentionSeverity;
  /** Qué es. Corto, identificable de un vistazo. */
  title: string;
  /** Por qué está aquí, en lenguaje natural. Nunca un código de estado. */
  reason: string;
  /** Fecha que determina la urgencia (vencimiento, salida, enfriamiento). */
  dueAt: string;
  /** Días respecto a hoy: negativo = ya pasó. */
  daysToDue: number;
  /** Impacto económico, si lo hay. */
  amount: number | null;
  /** Etiqueta de la acción. Siempre un verbo. */
  actionLabel: string;
  /** Identificador de la entidad para navegar a donde se resuelve. */
  targetId: string;
}

export interface BuildAttentionInput {
  leads?: Lead[];
  reservations?: Reservation[];
  invoices?: Invoice[];
  now?: Date;
  lang?: Lang;
  /** Ticket medio para estimar el valor de un lead sin ruta asignada. */
  avgTicket?: number;
  /** Sobreescribe umbrales concretos; el resto mantiene el valor por defecto. */
  thresholds?: Partial<AttentionThresholds>;
}

/**
 * Umbrales de la cola.
 *
 * Son decisiones de NEGOCIO, no constantes técnicas: por eso salen del módulo
 * y se pueden sobreescribir por llamada.
 *
 * `leadStaleDays: 2` no es arbitrario. El principio de marca es «responder en
 * el día»; a los dos días ya has incumplido tu propia promesa, así que ese es
 * el punto en que un lead debe aparecer en la cola. Antes estaba en 5, que
 * señalaba tarde.
 */
export interface AttentionThresholds {
  /** Score por debajo del cual un lead no merece llamada urgente. */
  leadFloor: number;
  /** Días sin contacto que convierten un lead caliente en excepción. */
  leadStaleDays: number;
  /** Días antes de la salida en que faltar documentación es urgente. */
  docsUrgentDays: number;
  /** Días antes de la salida en que el saldo pendiente es urgente. */
  balanceDays: number;
  /** Días desde emisión tras los que una factura se reclama. */
  invoiceDueDays: number;
}

export const DEFAULT_ATTENTION_THRESHOLDS: AttentionThresholds = {
  leadFloor: 55,
  leadStaleDays: 2,
  docsUrgentDays: 21,
  balanceDays: 30,
  invoiceDueDays: 30,
};

const SEVERITY_WEIGHT: Record<AttentionSeverity, number> = {
  vencido: 0,
  proximo: 1,
  seguimiento: 2,
};

function severityFor(daysToDue: number): AttentionSeverity {
  if (daysToDue < 0) return "vencido";
  if (daysToDue <= 7) return "proximo";
  return "seguimiento";
}

/* ------------------------------------------------------------------ *
 * Colectores — uno por fuente
 * ------------------------------------------------------------------ */

function fromLeads(
  leads: Lead[],
  now: Date,
  lang: Lang,
  avgTicket: number,
  th: AttentionThresholds,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const lead of leads) {
    if (lead.status === "reservado" || lead.status === "descartado") continue;

    const days = daysBetween(lead.lastTouchAt, now);
    const factor = decayFactor(days);
    const effective = Math.round(lead.score * factor);

    // Solo son excepción los leads que valían la pena y se están enfriando.
    if (lead.score < th.leadFloor) continue;
    if (days < th.leadStaleDays) continue;

    const lost = lead.score - effective;
    // El "vencimiento" de un lead es el día en que cruza el suelo de atención.
    const daysToDue = th.leadStaleDays - days;
    const coldAt = coldByDate(lead, th.leadFloor, undefined, now);
    const coldLabel = formatDateShort(coldAt, lang);

    items.push({
      id: `lead:${lead.id}`,
      source: "lead",
      severity: severityFor(daysToDue),
      title: lead.name,
      reason:
        lang === "es"
          ? `Score ${lead.score} → ${effective} · ${days} d sin contacto · se enfría el ${coldLabel}`
          : `Score ${lead.score} → ${effective} · ${days} d untouched · cools ${coldLabel}`,
      dueAt: lead.lastTouchAt,
      daysToDue,
      amount: lost >= 5 ? avgTicket : null,
      actionLabel: lang === "es" ? "Llamar" : "Call",
      targetId: lead.id,
    });
  }

  return items;
}

function fromReservations(
  reservations: Reservation[],
  now: Date,
  lang: Lang,
  th: AttentionThresholds,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const r of reservations) {
    if (r.status === "cerrado") continue;

    const daysToDeparture = -daysBetween(r.departureAt, now);

    // Documentación incompleta cerca de la salida.
    if (r.status === "docs_pendientes" && daysToDeparture <= th.docsUrgentDays) {
      items.push({
        id: `reserva-docs:${r.id}`,
        source: "reserva",
        severity: severityFor(daysToDeparture),
        title: `${r.tripName} · ${r.clientName}`,
        reason:
          lang === "es"
            ? `Documentación pendiente y sale en ${daysToDeparture} días`
            : `Missing paperwork, departs in ${daysToDeparture} days`,
        dueAt: r.departureAt,
        daysToDue: daysToDeparture,
        amount: null,
        actionLabel: lang === "es" ? "Revisar" : "Review",
        targetId: r.id,
      });
    }

    // Saldo pendiente con la salida encima.
    const pending = r.totalAmount - r.depositPaid;
    if (pending > 0 && daysToDeparture <= th.balanceDays) {
      items.push({
        id: `reserva-saldo:${r.id}`,
        source: "reserva",
        severity: severityFor(daysToDeparture),
        title: `${r.tripName} · ${r.clientName}`,
        reason:
          lang === "es"
            ? `Saldo pendiente de ${formatEur(pending, lang)} antes de salir`
            : `${formatEur(pending, lang)} outstanding before departure`,
        dueAt: r.departureAt,
        daysToDue: daysToDeparture,
        amount: pending,
        actionLabel: lang === "es" ? "Cobrar" : "Collect",
        targetId: r.id,
      });
    }
  }

  return items;
}

function fromInvoices(
  invoices: Invoice[],
  now: Date,
  lang: Lang,
  th: AttentionThresholds,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const inv of invoices) {
    if (inv.status === "anulada") continue;

    // Rechazo de la AEAT: bloquea el cumplimiento, va siempre arriba.
    if (inv.aeatStatus === "rechazado") {
      items.push({
        id: `factura-aeat:${inv.id}`,
        source: "factura",
        severity: "vencido",
        title: `${inv.number} · ${inv.clientName}`,
        reason:
          lang === "es"
            ? "Rechazada por la AEAT. Corrige y reenvía."
            : "Rejected by the tax agency. Fix and resend.",
        dueAt: inv.issueDate,
        daysToDue: -daysBetween(inv.issueDate, now),
        amount: inv.total,
        actionLabel: lang === "es" ? "Corregir" : "Fix",
        targetId: inv.id,
      });
      continue;
    }

    // Emitida y sin cobrar del todo pasados 30 días.
    const outstanding = inv.total - inv.amountCollected;
    if (inv.status !== "borrador" && outstanding > 0) {
      const age = daysBetween(inv.issueDate, now);
      const daysToDue = th.invoiceDueDays - age;
      if (daysToDue > 7) continue;

      items.push({
        id: `factura-cobro:${inv.id}`,
        source: "factura",
        severity: severityFor(daysToDue),
        title: `${inv.number} · ${inv.clientName}`,
        reason:
          lang === "es"
            ? `Sin cobrar ${formatEur(outstanding, lang)} · emitida hace ${age} días`
            : `${formatEur(outstanding, lang)} uncollected · issued ${age} days ago`,
        dueAt: inv.issueDate,
        daysToDue,
        amount: outstanding,
        actionLabel: lang === "es" ? "Reclamar" : "Chase",
        targetId: inv.id,
      });
    }
  }

  return items;
}

/* ------------------------------------------------------------------ *
 * API pública
 * ------------------------------------------------------------------ */

/**
 * Construye la cola ordenada por urgencia.
 *
 * Orden: severidad primero, luego los más vencidos, y a igualdad de fecha
 * el de mayor impacto económico. Nunca por fecha de creación.
 */
export function buildAttentionQueue(input: BuildAttentionInput): AttentionItem[] {
  const now = input.now ?? new Date();
  const lang = input.lang ?? "es";
  const avgTicket = input.avgTicket ?? 0;
  const th = { ...DEFAULT_ATTENTION_THRESHOLDS, ...input.thresholds };

  const items = [
    ...fromLeads(input.leads ?? [], now, lang, avgTicket, th),
    ...fromReservations(input.reservations ?? [], now, lang, th),
    ...fromInvoices(input.invoices ?? [], now, lang, th),
  ];

  return items.sort((a, b) => {
    const bySeverity = SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity];
    if (bySeverity !== 0) return bySeverity;
    if (a.daysToDue !== b.daysToDue) return a.daysToDue - b.daysToDue;
    return (b.amount ?? 0) - (a.amount ?? 0);
  });
}

export interface AttentionSummary {
  total: number;
  overdue: number;
  bySource: Record<AttentionSource, number>;
  /** Importe total en juego. Cuantifica el coste de no hacer nada. */
  amountAtStake: number;
}

export function summarizeAttention(items: AttentionItem[]): AttentionSummary {
  const bySource: Record<AttentionSource, number> = { lead: 0, reserva: 0, factura: 0 };
  let overdue = 0;
  let amountAtStake = 0;

  for (const it of items) {
    bySource[it.source] += 1;
    if (it.severity === "vencido") overdue += 1;
    amountAtStake += it.amount ?? 0;
  }

  return { total: items.length, overdue, bySource, amountAtStake };
}
