/**
 * Modos de priorización de la cola de leads.
 *
 * Son preguntas de negocio, no algoritmos. Todos reordenan la cola;
 * ninguno reescribe el score guardado. El decaimiento temporal se aplica
 * siempre como corrección (un lead viejo no vuelve a parecer fresco).
 */

import { MPS_ANNEX } from "@/lib/assumptions";
import {
  EXPEDITIONS,
  ORIGIN_LABEL,
  ROUTE_LABEL,
  type Client,
  type Lead,
  type LeadOrigin,
  type RouteCode,
} from "@/lib/demo-data";
import {
  ORIGIN_WEIGHT,
  clampScore,
  coldByLabel,
  decayFactor,
  daysSince,
  decayedScore,
} from "@/lib/ai/lead-scoring-core";
import type { Lang } from "@/lib/i18n";

export const LEAD_PRIORITY_MODES = [
  "urgencia",
  "dinero",
  "encaje",
  "parecido",
] as const;

export type LeadPriorityMode = (typeof LEAD_PRIORITY_MODES)[number];

export const DEFAULT_LEAD_PRIORITY_MODE: LeadPriorityMode = "urgencia";

export function isLeadPriorityMode(v: unknown): v is LeadPriorityMode {
  return typeof v === "string" && (LEAD_PRIORITY_MODES as readonly string[]).includes(v);
}

export function leadPriorityModeLabel(mode: LeadPriorityMode, lang: Lang = "es"): string {
  const es: Record<LeadPriorityMode, string> = {
    urgencia: "Urgencia",
    dinero: "Dinero esperado",
    encaje: "Encaje e intención",
    parecido: "Se parece a quien reservó",
  };
  const en: Record<LeadPriorityMode, string> = {
    urgencia: "Urgency",
    dinero: "Expected money",
    encaje: "Fit & intent",
    parecido: "Looks like who booked",
  };
  return lang === "es" ? es[mode] : en[mode];
}

export function leadPriorityModeHint(mode: LeadPriorityMode, lang: Lang = "es"): string {
  const es: Record<LeadPriorityMode, string> = {
    urgencia: "¿A quién se me está enfriando?",
    dinero: "¿Qué llamada deja más margen?",
    encaje: "¿Cliente ideal y con prisa?",
    parecido: "¿Recuerda a mis clientes buenos?",
  };
  const en: Record<LeadPriorityMode, string> = {
    urgencia: "Who is cooling off?",
    dinero: "Which call leaves more margin?",
    encaje: "Ideal client and in a hurry?",
    parecido: "Looks like my best bookers?",
  };
  return lang === "es" ? es[mode] : en[mode];
}

/** Coste simbólico de una llamada comercial (no reescribe el score). */
const CALL_COST_EUR = 25;
const DEFAULT_TICKET = MPS_ANNEX.revenueCurrent / MPS_ANNEX.travelersCurrent;
const DEFAULT_MARGIN = MPS_ANNEX.marginTargetPct / 100;
const K_NEIGHBORS = 5;

export interface RouteEconomics {
  ticket: number;
  marginPct: number;
}

/** Ticket y margen medios por ruta a partir de las expediciones del Hub/semilla. */
export function routeEconomicsMap(
  expeditions = EXPEDITIONS,
): Partial<Record<RouteCode, RouteEconomics>> {
  const acc = new Map<RouteCode, { rev: number; cost: number; heads: number }>();
  for (const e of expeditions) {
    const heads = Math.max(e.booked, 1);
    const prev = acc.get(e.route) ?? { rev: 0, cost: 0, heads: 0 };
    acc.set(e.route, {
      rev: prev.rev + e.revenue,
      cost: prev.cost + e.cost,
      heads: prev.heads + heads,
    });
  }
  const out: Partial<Record<RouteCode, RouteEconomics>> = {};
  for (const [route, v] of acc) {
    out[route] = {
      ticket: v.rev / v.heads,
      marginPct: v.rev > 0 ? (v.rev - v.cost) / v.rev : DEFAULT_MARGIN,
    };
  }
  return out;
}

export function economicsForRoute(
  route: RouteCode | null | undefined,
  map = routeEconomicsMap(),
): RouteEconomics {
  if (route && map[route]) return map[route]!;
  return { ticket: DEFAULT_TICKET, marginPct: DEFAULT_MARGIN };
}

export interface RankedLead {
  lead: Lead;
  /** Valor de ordenación del modo (mayor = llamar antes). No es el score. */
  rank: number;
  /** Score enfriado — corrección temporal siempre visible. */
  effective: number;
  base: number;
  days: number;
  /** Por qué está en esta posición según el modo activo. */
  why: string;
}

export interface RankLeadsInput {
  leads: Lead[];
  clients?: Client[];
  mode?: LeadPriorityMode;
  now?: Date;
  lang?: Lang;
  expeditions?: typeof EXPEDITIONS;
}

function linkedClient(lead: Lead, clients: Client[]): Client | null {
  const email = lead.email.toLowerCase();
  return clients.find((c) => c.email.toLowerCase() === email) ?? null;
}

function formatEur(n: number, lang: Lang): string {
  const rounded = Math.round(n);
  return lang === "es"
    ? `${rounded.toLocaleString("es-ES")} €`
    : `€${rounded.toLocaleString("en-US")}`;
}

/** Eje encaje 0–100: ¿parece cliente Campo Norte? */
export function fitAxis(lead: Lead, linked: Client | null): number {
  let fit = 20;
  fit += ((ORIGIN_WEIGHT[lead.origin] ?? 0) / 22) * 30;
  if (lead.interestRoute) fit += 22;
  if (lead.vehicle) fit += 8;
  if (lead.campaign) fit += 5;
  if (linked) {
    fit += 15;
    if (linked.trips >= 1) fit += 10;
    if (linked.ltv >= 10_000) fit += 8;
  }
  return clampScore(fit);
}

/** Eje intención 0–100: ¿viene con prisa / interés claro? */
export function intentAxis(lead: Lead, now: Date): number {
  const decay = decayedScore(lead, now);
  let intent = decay.effective * 0.55;
  if (lead.status === "cualificado") intent += 18;
  else if (lead.status === "en_contacto") intent += 10;
  else if (lead.status === "nuevo") intent += 4;
  if (lead.campaign) intent += 8;
  if (lead.interestRoute) intent += 6;
  // Frescor: quien acaba de llegar tiene más «prisa» percibida.
  intent += decay.factor * 12;
  return clampScore(intent);
}

function quadrantRank(fit: number, intent: number): number {
  const hiFit = fit >= 50;
  const hiIntent = intent >= 50;
  if (hiFit && hiIntent) return 4;
  if (!hiFit && hiIntent) return 3;
  if (hiFit && !hiIntent) return 2;
  return 1;
}

function quadrantWhy(fit: number, intent: number, lang: Lang): string {
  const q = quadrantRank(fit, intent);
  if (lang === "es") {
    if (q === 4) return `Encaje ${fit} · intención ${intent} · llamar ya`;
    if (q === 3) return `Intención alta (${intent}) · encaje aún bajo (${fit})`;
    if (q === 2) return `Buen encaje (${fit}) · poca prisa (${intent})`;
    return `Encaje ${fit} · intención ${intent}`;
  }
  if (q === 4) return `Fit ${fit} · intent ${intent} · call now`;
  if (q === 3) return `High intent (${intent}) · fit still low (${fit})`;
  if (q === 2) return `Strong fit (${fit}) · low urgency (${intent})`;
  return `Fit ${fit} · intent ${intent}`;
}

/* ------------------------------------------------------------------ *
 * Parecido (coseno con vecinos que ya reservaron)
 * ------------------------------------------------------------------ */

const ORIGINS = Object.keys(ORIGIN_LABEL) as LeadOrigin[];
const ROUTES = Object.keys(ROUTE_LABEL) as RouteCode[];

function leadVector(lead: Lead): number[] {
  const v: number[] = [];
  for (const o of ORIGINS) v.push(lead.origin === o ? 1 : 0);
  for (const r of ROUTES) v.push(lead.interestRoute === r ? 1 : 0);
  v.push(lead.vehicle === "moto" ? 1 : 0);
  v.push(lead.vehicle === "4x4" ? 1 : 0);
  v.push(lead.campaign ? 1 : 0);
  v.push(clampScore(lead.score) / 100);
  return v;
}

function clientVector(client: Client): number[] {
  const route = client.preferredRoute ?? client.nextInterest ?? client.history[0]?.route ?? null;
  const vehicle = client.vehiclePref ?? client.history[0]?.vehicle ?? null;
  const v: number[] = [];
  for (const o of ORIGINS) v.push(client.originPrimary === o ? 1 : 0);
  for (const r of ROUTES) v.push(route === r ? 1 : 0);
  v.push(vehicle === "moto" ? 1 : 0);
  v.push(vehicle === "4x4" ? 1 : 0);
  v.push(client.referrals > 0 ? 1 : 0);
  v.push(Math.min(1, client.ltv / 40_000));
  return v;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na <= 0 || nb <= 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function converters(clients: Client[]): Client[] {
  return clients.filter((c) => c.trips >= 1 || c.segment === "vip" || c.segment === "embajador");
}

function similarityToBookers(lead: Lead, bookers: Client[]): { score: number; neighbor?: Client } {
  if (!bookers.length) return { score: 0 };
  const lv = leadVector(lead);
  const scored = bookers
    .map((c) => ({ client: c, sim: cosine(lv, clientVector(c)) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, K_NEIGHBORS);
  if (!scored.length) return { score: 0 };
  const avg = scored.reduce((s, x) => s + x.sim, 0) / scored.length;
  return { score: avg, neighbor: scored[0]?.client };
}

/* ------------------------------------------------------------------ *
 * Ranking público
 * ------------------------------------------------------------------ */

export function rankLeads(input: RankLeadsInput): RankedLead[] {
  const mode = input.mode ?? DEFAULT_LEAD_PRIORITY_MODE;
  const now = input.now ?? new Date();
  const lang = input.lang ?? "es";
  const clients = input.clients ?? [];
  const econ = routeEconomicsMap(input.expeditions ?? EXPEDITIONS);
  const bookers = converters(clients);

  const ranked = input.leads.map((lead): RankedLead => {
    const decay = decayedScore(lead, now);
    const factor = decay.factor;
    const linked = linkedClient(lead, clients);

    if (mode === "urgencia") {
      const cooled = decay.base - decay.effective >= 5;
      const cold = coldByLabel(lead, lang, 55, undefined, now);
      return {
        lead,
        rank: decay.effective,
        effective: decay.effective,
        base: decay.base,
        days: decay.days,
        why: cooled
          ? lang === "es"
            ? `${decay.base} → ${decay.effective} · ${cold}`
            : `${decay.base} → ${decay.effective} · ${cold}`
          : lang === "es"
            ? `Efectivo ${decay.effective} · fresco · ${cold}`
            : `Effective ${decay.effective} · fresh · ${cold}`,
      };
    }

    if (mode === "dinero") {
      const { ticket, marginPct } = economicsForRoute(lead.interestRoute, econ);
      const p = lead.score / 100;
      const expected = p * ticket * marginPct - CALL_COST_EUR;
      const rank = expected * factor;
      const route = lead.interestRoute ? ROUTE_LABEL[lead.interestRoute] : null;
      return {
        lead,
        rank,
        effective: decay.effective,
        base: decay.base,
        days: decay.days,
        why:
          lang === "es"
            ? `~${formatEur(rank, lang)} margen · p=${Math.round(p * 100)}%${
                route ? ` · ${route}` : ""
              }`
            : `~${formatEur(rank, lang)} margin · p=${Math.round(p * 100)}%${
                route ? ` · ${route}` : ""
              }`,
      };
    }

    if (mode === "encaje") {
      const fit = fitAxis(lead, linked);
      const intent = intentAxis(lead, now);
      const q = quadrantRank(fit, intent);
      const rank = (q * 10_000 + fit * 10 + intent) * factor;
      return {
        lead,
        rank,
        effective: decay.effective,
        base: decay.base,
        days: decay.days,
        why: quadrantWhy(fit, intent, lang),
      };
    }

    // parecido
    const { score: sim, neighbor } = similarityToBookers(lead, bookers);
    const rank = sim * 100 * factor;
    return {
      lead,
      rank,
      effective: decay.effective,
      base: decay.base,
      days: decay.days,
      why: neighbor
        ? lang === "es"
          ? `${Math.round(sim * 100)}% parecido a ${neighbor.name}`
          : `${Math.round(sim * 100)}% like ${neighbor.name}`
        : lang === "es"
          ? "Sin vecinos convertidos aún"
          : "No converted neighbors yet",
    };
  });

  return ranked.sort(
    (a, b) => b.rank - a.rank || b.effective - a.effective || b.lead.score - a.lead.score,
  );
}

/** Atajo: solo los leads ordenados (compat con computeLeadStats). */
export function sortLeadsByMode(
  leads: Lead[],
  mode: LeadPriorityMode,
  clients: Client[] = [],
  now: Date = new Date(),
  lang: Lang = "es",
): Lead[] {
  return rankLeads({ leads, clients, mode, now, lang }).map((r) => r.lead);
}

/** Días sin tocar — reexport útil para tests/UI. */
export { daysSince, decayFactor };
