/**
 * Calendario fiscal — vencimientos AEAT con importe estimado.
 *
 * Adaptado del módulo Fiscal de la demo, pero con una diferencia sustancial:
 * allí los importes vienen de la contabilidad; aquí se ESTIMAN a partir de las
 * facturas del Hub. Por eso todo lo que sale de aquí va marcado como estimado
 * y nunca como una autoliquidación lista para presentar.
 *
 * Alcance deliberadamente corto: solo los modelos que un turoperador con
 * régimen REAV presenta de verdad. No se inventan modelos que no aplican.
 *
 * AVISO: esto es una ayuda de planificación, no asesoramiento fiscal. Las
 * fechas son las ordinarias; festivos autonómicos y prórrogas no se modelan.
 */

import type { Invoice } from "@/lib/ops-data";

export type FiscalModel = "303" | "390" | "111" | "130" | "200";

export type FiscalPeriodKind = "trimestral" | "anual";

export interface FiscalDeadline {
  id: string;
  model: FiscalModel;
  /** "T2", "T3", "Anual" */
  period: string;
  periodKind: FiscalPeriodKind;
  title: string;
  description: string;
  dueAt: string;
  /** Días hasta el vencimiento; negativo = vencido. */
  daysToDue: number;
  /** Estimación a partir de las facturas del Hub. `null` si no se puede. */
  estimated: number | null;
  /** Qué se usó para estimar. Sin esto la cifra no es auditable. */
  basis: string | null;
}

interface ModelSpec {
  model: FiscalModel;
  title: string;
  description: string;
  periodKind: FiscalPeriodKind;
}

const MODELS: ModelSpec[] = [
  {
    model: "303",
    title: "IVA — autoliquidación",
    description: "IVA repercutido menos soportado del trimestre.",
    periodKind: "trimestral",
  },
  {
    model: "111",
    title: "Retenciones IRPF",
    description: "Retenciones a trabajadores y profesionales.",
    periodKind: "trimestral",
  },
  {
    model: "390",
    title: "IVA — resumen anual",
    description: "Declaración informativa que resume los cuatro trimestres.",
    periodKind: "anual",
  },
  {
    model: "200",
    title: "Impuesto sobre Sociedades",
    description: "Declaración anual del ejercicio cerrado.",
    periodKind: "anual",
  },
];

/** Trimestre natural (1–4) de una fecha. */
export function quarterOf(date: Date): 1 | 2 | 3 | 4 {
  return (Math.floor(date.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

/**
 * Vencimiento ordinario de un trimestre: día 20 del mes siguiente al cierre.
 * El T4 vence el 30 de enero.
 */
export function quarterDueDate(year: number, quarter: 1 | 2 | 3 | 4): Date {
  if (quarter === 4) return utcDate(year + 1, 0, 30);
  return utcDate(year, quarter * 3, 20);
}

/**
 * Un vencimiento fiscal es una FECHA DE CALENDARIO, no un instante. Si se
 * construye con `new Date(y, m, d)` queda anclado a la zona local y al
 * serializar a ISO se desplaza un día en cualquier zona al este de UTC
 * (España incluida). Se construye siempre en UTC a mediodía para que ningún
 * cambio de horario de verano lo mueva.
 */
function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

/** Modelo 390: 30 de enero del año siguiente. */
function annual390Due(year: number): Date {
  return utcDate(year + 1, 0, 30);
}

/** Modelo 200: 25 de julio si el ejercicio coincide con el año natural. */
function annual200Due(year: number): Date {
  return utcDate(year + 1, 6, 25);
}

function daysUntil(target: Date, now: Date): number {
  const a = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}

/**
 * IVA repercutido de un trimestre.
 *
 * Solo cuenta facturas emitidas y no anuladas. En REAV la base imponible es
 * el margen, no el importe del viaje: `vatAmount` ya viene calculado sobre esa
 * base, así que se suma tal cual y no se recalcula aquí.
 */
function vatForQuarter(invoices: Invoice[], year: number, quarter: 1 | 2 | 3 | 4): number {
  let total = 0;
  for (const inv of invoices) {
    if (inv.status === "borrador" || inv.status === "anulada") continue;
    const d = new Date(inv.operationDate || inv.issueDate);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getFullYear() !== year) continue;
    if (quarterOf(d) !== quarter) continue;
    total += inv.vatAmount;
  }
  return total;
}

function vatForYear(invoices: Invoice[], year: number): number {
  return ([1, 2, 3, 4] as const).reduce((s, q) => s + vatForQuarter(invoices, year, q), 0);
}

export interface BuildFiscalInput {
  invoices?: Invoice[];
  now?: Date;
  /** Trimestres hacia atrás y hacia delante a mostrar. */
  quartersBack?: number;
  quartersAhead?: number;
}

/**
 * Construye el calendario ordenado por urgencia: lo vencido primero.
 *
 * Los modelos 111 y 200 se listan sin importe: dependen de nóminas y de la
 * contabilidad completa, datos que el Hub no tiene. Preferimos un hueco
 * honesto a un número inventado.
 */
export function buildFiscalCalendar(input: BuildFiscalInput = {}): FiscalDeadline[] {
  const now = input.now ?? new Date();
  const invoices = input.invoices ?? [];
  const back = input.quartersBack ?? 2;
  const ahead = input.quartersAhead ?? 2;

  const out: FiscalDeadline[] = [];
  const baseQuarter = quarterOf(now);
  const baseYear = now.getFullYear();

  for (let offset = -back; offset <= ahead; offset += 1) {
    const absolute = baseQuarter - 1 + offset;
    const year = baseYear + Math.floor(absolute / 4);
    const quarter = (((absolute % 4) + 4) % 4 + 1) as 1 | 2 | 3 | 4;
    const due = quarterDueDate(year, quarter);

    for (const spec of MODELS) {
      if (spec.periodKind !== "trimestral") continue;

      const isVat = spec.model === "303";
      const estimated = isVat ? vatForQuarter(invoices, year, quarter) : null;

      out.push({
        id: `${spec.model}-${year}-T${quarter}`,
        model: spec.model,
        period: `T${quarter} ${year}`,
        periodKind: "trimestral",
        title: spec.title,
        description: spec.description,
        dueAt: due.toISOString(),
        daysToDue: daysUntil(due, now),
        estimated,
        basis: isVat ? "Suma del IVA de las facturas emitidas del trimestre." : null,
      });
    }
  }

  // Anuales del ejercicio anterior y del actual.
  for (const year of [baseYear - 1, baseYear]) {
    const due390 = annual390Due(year);
    out.push({
      id: `390-${year}`,
      model: "390",
      period: `Anual ${year}`,
      periodKind: "anual",
      title: "IVA — resumen anual",
      description: "Declaración informativa que resume los cuatro trimestres.",
      dueAt: due390.toISOString(),
      daysToDue: daysUntil(due390, now),
      estimated: vatForYear(invoices, year),
      basis: "Suma del IVA de las facturas emitidas del ejercicio.",
    });

    const due200 = annual200Due(year);
    out.push({
      id: `200-${year}`,
      model: "200",
      period: `Anual ${year}`,
      periodKind: "anual",
      title: "Impuesto sobre Sociedades",
      description: "Declaración anual del ejercicio cerrado.",
      dueAt: due200.toISOString(),
      daysToDue: daysUntil(due200, now),
      estimated: null,
      basis: null,
    });
  }

  return out.sort((a, b) => a.daysToDue - b.daysToDue);
}

/** Solo lo que sigue abierto: vencido sin presentar o por vencer. */
export function upcomingDeadlines(
  deadlines: FiscalDeadline[],
  horizonDays = 90,
): FiscalDeadline[] {
  return deadlines.filter((d) => d.daysToDue >= -120 && d.daysToDue <= horizonDays);
}
