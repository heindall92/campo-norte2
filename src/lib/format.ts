/**
 * Formateadores de presentación.
 *
 * Dos decisiones tomadas del análisis de la demo (docs/GAP-DEMO-ANATOMIA.md):
 *
 *  1. El negativo se escribe con MINUS SIGN U+2212 (−), no con guion (-).
 *     El guion tiene ancho de guion y puede romper línea; el menos matemático
 *     tiene el mismo ancho que el "+" y alinea con `tabular-nums`.
 *
 *  2. Toda magnitud temporal se da en unidad Y en fecha: "8 meses · hasta
 *     abr 2027" se entiende de golpe; "8 meses" es abstracto.
 */

import type { Lang } from "@/lib/i18n";

export const MINUS = "−";

const LOCALE: Record<Lang, string> = { es: "es-ES", en: "en-US" };

/** Euros sin decimales. Negativos con − (U+2212). */
export function formatEur(value: number, lang: Lang = "es"): string {
  const abs = Math.abs(Math.round(value));
  const sign = value < 0 ? MINUS : "";
  return lang === "es"
    ? `${sign}${abs.toLocaleString("es-ES")} €`
    : `${sign}€${abs.toLocaleString("en-US")}`;
}

/** Euros con dos decimales, para importes contables exactos. */
export function formatEurExact(value: number, lang: Lang = "es"): string {
  const abs = Math.abs(value).toLocaleString(LOCALE[lang], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = value < 0 ? MINUS : "";
  return lang === "es" ? `${sign}${abs} €` : `${sign}€${abs}`;
}

/** Igual que formatEur pero fuerza el "+" en positivos (columnas de flujo). */
export function formatEurSigned(value: number, lang: Lang = "es"): string {
  if (value > 0) return `+${formatEur(value, lang)}`;
  return formatEur(value, lang);
}

/** Porcentaje de variación, siempre con signo explícito. */
export function formatDelta(pct: number, lang: Lang = "es"): string {
  const abs = Math.abs(pct).toLocaleString(LOCALE[lang], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (pct > 0) return `+${abs} %`;
  if (pct < 0) return `${MINUS}${abs} %`;
  return `0,0 %`;
}

/** "14 ago 2026" */
export function formatDate(input: string | Date, lang: Lang = "es"): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE[lang], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "14 ago" — para fechas dentro del año en curso. */
export function formatDateShort(input: string | Date, lang: Lang = "es"): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short" });
}

/** "abr 2027" — horizonte de una proyección. */
export function formatMonthYear(input: string | Date, lang: Lang = "es"): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE[lang], { month: "short", year: "numeric" });
}

/** Días enteros entre dos fechas (positivo si `then` es pasado). */
export function daysBetween(then: string | Date, now: Date = new Date()): number {
  const d = typeof then === "string" ? new Date(then) : then;
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

/** Suma días a una fecha sin mutar la original. */
export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * "hace 4 días" / "anteayer" / "en 3 días".
 * Usa Intl.RelativeTimeFormat para no mantener tablas de plurales a mano.
 */
export function formatRelative(input: string | Date, lang: Lang = "es", now = new Date()): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: "auto" });
  if (Math.abs(days) < 31) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, "month");
  return rtf.format(Math.round(days / 365), "year");
}

/**
 * Magnitud en unidad + horizonte en fecha.
 *
 *   horizonLabel(8, "meses", fecha)  →  "8 meses · hasta abr 2027"
 *
 * Aplicado al decay de leads convierte un "se enfría" abstracto en una
 * fecha concreta, que es lo que hace que alguien descuelgue el teléfono.
 */
export function horizonLabel(
  amount: number,
  unit: string,
  until: Date,
  lang: Lang = "es",
): string {
  const head = `${amount} ${unit}`;
  const tail = lang === "es" ? "hasta" : "until";
  return `${head} · ${tail} ${formatMonthYear(until, lang)}`;
}
