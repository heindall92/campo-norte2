/**
 * Núcleo de scoring — sin dependencias de navegador.
 *
 * Vive aparte de `lead-scoring.ts` a propósito: ese archivo habla con Ollama y
 * arrastra `import.meta.env`, que no existe en Node. Este solo hace cuentas, así
 * que lo pueden importar tanto la app como las funciones de `api/`, y el score
 * que ve Sofía en pantalla es exactamente el que calcula el servidor.
 *
 * Importes relativos con extensión `.js` (no el alias `@/`) porque el
 * typecheck de `api/` usa resolución de Node, donde el alias no existe.
 */

import { ORIGIN_LABEL, ROUTE_LABEL } from "../demo-data.js";
import type { Client, Lead, LeadOrigin } from "../demo-data.js";

export type LeadScoreSource = "heuristic" | "ollama";

export type LeadPriority = "muy_alta" | "alta" | "media" | "baja";

export interface LeadScoreResult {
  score: number;
  priority: LeadPriority;
  reasons: string[];
  source: LeadScoreSource;
}

/** Puntos por canal de entrada. Expuesto para poder explicarlo en la UI. */
export const ORIGIN_WEIGHT: Record<LeadOrigin, number> = {
  referral: 22,
  web_form: 14,
  brevo_click: 12,
  feria: 8,
  instagram: 6,
  unknown: 0,
};

export function priorityFromScore(score: number): LeadPriority {
  if (score >= 85) return "muy_alta";
  if (score >= 70) return "alta";
  if (score >= 50) return "media";
  return "baja";
}

export function priorityLabel(p: LeadPriority, lang: "es" | "en" = "es"): string {
  const es: Record<LeadPriority, string> = {
    muy_alta: "Muy alta prioridad",
    alta: "Alta prioridad",
    media: "Prioridad media",
    baja: "Baja prioridad",
  };
  const en: Record<LeadPriority, string> = {
    muy_alta: "Very high priority",
    alta: "High priority",
    media: "Medium priority",
    baja: "Low priority",
  };
  return lang === "es" ? es[p] : en[p];
}

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Tope de puntos que puede aportar el bloque "cliente vinculado".
 *
 * Sin tope, un repetidor de alto valor llegado por referido sumaba 109 y el
 * recorte a 100 lo igualaba con otros ocho iguales. Justo el perfil que más
 * importa quedaba sin orden interno.
 */
export const RELATIONSHIP_CAP = 30;

/** A partir de aquí el score deja de crecer linealmente. */
const COMPRESSION_KNEE = 80;
const COMPRESSION_SPAN = 20;

/**
 * Compresión asintótica de la cola alta.
 *
 * Por debajo de la rodilla no toca nada. Por encima, comprime el exceso hacia
 * 100 sin alcanzarlo nunca. La función es estrictamente creciente, así que dos
 * leads con puntuación bruta distinta SIEMPRE quedan en orden distinto: el
 * recorte plano en 100 los empataba y destruía el podio.
 *
 *   bruto  97 → 89
 *   bruto 109 → 92
 *   bruto 124 → 94
 */
export function compressTail(raw: number): number {
  if (raw <= COMPRESSION_KNEE) return Math.max(0, raw);
  const excess = raw - COMPRESSION_KNEE;
  return COMPRESSION_KNEE + (excess / (excess + COMPRESSION_SPAN)) * COMPRESSION_SPAN;
}

/** Scoring determinístico. Solo clasifica: nunca escribe al viajero. */
export function scoreLeadHeuristic(lead: Lead, linked?: Client | null): LeadScoreResult {
  const reasons: string[] = [];
  let score = 35;

  const boost = ORIGIN_WEIGHT[lead.origin] ?? 0;
  if (boost) {
    score += boost;
    reasons.push(`Canal: ${ORIGIN_LABEL[lead.origin]}`);
  } else {
    reasons.push("Sin origen claro");
  }

  if (lead.interestRoute) {
    score += 12;
    reasons.push(`Destino: ${ROUTE_LABEL[lead.interestRoute]}`);
  }
  if (lead.vehicle) {
    score += 4;
    reasons.push(`Vehículo: ${lead.vehicle}`);
  }
  if (lead.campaign) {
    score += 6;
    reasons.push(`Campaña: ${lead.campaign}`);
  }

  // Bloque relación: se acumula aparte y se topa, para que un solo perfil no
  // sature el score y borre las diferencias con sus iguales.
  if (linked) {
    let relationship = 0;

    if (linked.trips > 0) {
      relationship += 18;
      reasons.push(
        linked.trips === 1
          ? "Cliente con viaje previo"
          : `Cliente repetidor (${linked.trips} viajes)`,
      );
    }
    if (linked.ltv >= 10_000) {
      relationship += 12;
      reasons.push("Alto poder adquisitivo (LTV)");
    }
    if (linked.brevoOpens >= 5) {
      relationship += 8;
      reasons.push(`Ha abierto ${linked.brevoOpens} emails (Brevo)`);
    }

    // Ha viajado antes por la ruta que ahora le interesa.
    // Genérico a propósito: antes esto premiaba solo a MONGOLIA, lo que sesgaba
    // la prioridad hacia un destino y se rompía al retirar o añadir rutas.
    if (lead.interestRoute) {
      const sameRoute = linked.history.filter((h) => h.route === lead.interestRoute).length;
      if (sameRoute >= 1) {
        relationship += 6;
        const label = ROUTE_LABEL[lead.interestRoute];
        reasons.push(
          sameRoute >= 2 ? `Ha viajado a ${label} ${sameRoute} veces` : `Ya viajó a ${label}`,
        );
      }
    }

    if (relationship > RELATIONSHIP_CAP) relationship = RELATIONSHIP_CAP;
    score += relationship;
  }

  if (lead.status === "cualificado") score += 8;
  if (lead.status === "reservado") score += 15;

  score = clampScore(compressTail(score));
  if (score >= 80) reasons.push("Probabilidad de compra alta");

  return {
    score,
    priority: priorityFromScore(score),
    reasons: reasons.slice(0, 8),
    source: "heuristic",
  };
}

export function applyScoreToLead(lead: Lead, result: LeadScoreResult): Lead {
  return {
    ...lead,
    score: result.score,
    scoreReasons: result.reasons,
    lastTouchAt: new Date().toISOString().slice(0, 10),
  };
}

/* ------------------------------------------------------------------ *
 * Decaimiento temporal
 * ------------------------------------------------------------------ */

/** A los 14 días un lead sin tocar vale la mitad; a los 28, la cuarta parte. */
export const DEFAULT_HALF_LIFE_DAYS = 14;

export interface DecayedScore {
  /** Score guardado, sin tocar. */
  base: number;
  /** Score una vez enfriado por el tiempo — es el que ordena la cola. */
  effective: number;
  /** Días desde el último contacto. */
  days: number;
  /** Multiplicador aplicado (1 = recién entrado). */
  factor: number;
}

export function decayFactor(days: number, halfLifeDays = DEFAULT_HALF_LIFE_DAYS): number {
  if (!Number.isFinite(days) || days <= 0) return 1;
  if (halfLifeDays <= 0) return 1;
  return Math.exp(-(Math.LN2 / halfLifeDays) * days);
}

/**
 * Días completos desde la fecha dada. Enteros a propósito: `lastTouchAt` es una
 * fecha sin hora, y contar fracciones haría que el mismo lead se enfriase a lo
 * largo del día sin que hubiera pasado nada.
 */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number {
  if (!iso) return 0;
  const then = new Date(`${iso}T00:00:00`).getTime();
  if (Number.isNaN(then)) return 0;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((start.getTime() - then) / 86_400_000));
}

/**
 * Enfría el score según lo que lleva sin tocarse. No reescribe nada: el score
 * guardado sigue siendo el auditable, esto solo cambia el orden de la cola.
 */
export function decayedScore(
  lead: Pick<Lead, "score" | "lastTouchAt" | "createdAt">,
  now: Date = new Date(),
  halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
): DecayedScore {
  const days = daysSince(lead.lastTouchAt || lead.createdAt, now);
  const factor = decayFactor(days, halfLifeDays);
  return {
    base: lead.score,
    effective: clampScore(lead.score * factor),
    days,
    factor,
  };
}

/**
 * Fecha en la que el score efectivo cae por debajo de `floor` (p. ej. 55)
 * si nadie toca al lead. Si ya está bajo el suelo, devuelve hoy.
 *
 * Convierte "se enfría" en "se enfría el 14 ago" — el detalle que hace
 * descargar el teléfono (docs/GAP-DEMO-ANATOMIA.md §5).
 */
export function coldByDate(
  lead: Pick<Lead, "score" | "lastTouchAt" | "createdAt">,
  floor = 55,
  halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
  now: Date = new Date(),
): Date {
  const touchIso = lead.lastTouchAt || lead.createdAt;
  const touch = new Date(`${(touchIso || now.toISOString().slice(0, 10)).slice(0, 10)}T12:00:00`);
  const baseTouch = Number.isNaN(touch.getTime()) ? now : touch;

  if (lead.score <= 0) return baseTouch;
  if (lead.score <= floor) return now;

  // score * e^(-ln2/hl * d) = floor  →  d = ln(score/floor) * hl / ln2
  const daysToFloor = Math.ceil(
    (Math.log(lead.score / floor) * halfLifeDays) / Math.LN2,
  );
  const cold = new Date(baseTouch);
  cold.setDate(cold.getDate() + Math.max(0, daysToFloor));
  return cold;
}

/** Etiqueta corta: "se enfría el 14 ago" / "cools on 14 Aug". */
export function coldByLabel(
  lead: Pick<Lead, "score" | "lastTouchAt" | "createdAt">,
  lang: "es" | "en" = "es",
  floor = 55,
  halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
  now: Date = new Date(),
): string {
  const d = coldByDate(lead, floor, halfLifeDays, now);
  const when = d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
    day: "numeric",
    month: "short",
  });
  const already = lead.score * decayFactor(daysSince(lead.lastTouchAt || lead.createdAt, now), halfLifeDays) < floor;
  if (already || d.getTime() <= now.getTime()) {
    return lang === "es" ? `ya frío · ${when}` : `already cold · ${when}`;
  }
  return lang === "es" ? `se enfría el ${when}` : `cools on ${when}`;
}
