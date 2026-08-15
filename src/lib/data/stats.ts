import type { Client, Lead, LeadOrigin } from "@/lib/demo-data";
import { ORIGIN_LABEL } from "@/lib/demo-data";
import { decayedScore } from "@/lib/ai/lead-scoring-core";
import {
  DEFAULT_LEAD_PRIORITY_MODE,
  rankLeads,
  type LeadPriorityMode,
  type RankedLead,
} from "@/lib/ai/lead-priority";
import type { Lang } from "@/lib/i18n";

/**
 * Prioridad real de llamada en modo Urgencia: score enfriado por tiempo.
 * En otros modos la cola usa `rankLeads`; este helper sigue sirviendo a tests
 * y a cualquier sitio que solo necesite el efectivo.
 */
export function effectiveScore(lead: Lead, now: Date = new Date()): number {
  return decayedScore(lead, now).effective;
}

export function computeLeadStats(
  leads: Lead[],
  now: Date = new Date(),
  opts?: {
    mode?: LeadPriorityMode;
    clients?: Client[];
    lang?: Lang;
  },
) {
  if (!leads.length) {
    return {
      sorted: [] as Lead[],
      ranked: [] as RankedLead[],
      unknown: 0,
      avg: 0,
      total: 0,
      mode: opts?.mode ?? DEFAULT_LEAD_PRIORITY_MODE,
    };
  }
  const mode = opts?.mode ?? DEFAULT_LEAD_PRIORITY_MODE;
  const ranked = rankLeads({
    leads,
    clients: opts?.clients ?? [],
    mode,
    now,
    lang: opts?.lang ?? "es",
  });
  const sorted = ranked.map((r) => r.lead);
  const unknown = leads.filter((l) => l.origin === "unknown").length;
  const avg = Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length);
  return { sorted, ranked, unknown, avg, total: leads.length, mode };
}

/** Atribución desde leads reales del Hub (Fase 1), no solo mix de expediciones demo */
export function computeOriginFromLeads(leads: Lead[]) {
  const totals: Record<LeadOrigin, number> = {
    web_form: 0,
    instagram: 0,
    referral: 0,
    brevo_click: 0,
    feria: 0,
    unknown: 0,
  };
  for (const l of leads) {
    totals[l.origin] += 1;
  }
  return (Object.keys(totals) as LeadOrigin[]).map((origin) => ({
    origin,
    label: ORIGIN_LABEL[origin],
    value: totals[origin],
  }));
}
