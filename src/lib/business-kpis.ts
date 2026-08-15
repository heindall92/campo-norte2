/**
 * Metas de negocio a 6 meses — lenguaje para el equipo, no jerga técnica.
 */

import type { Client, Expedition, Lead } from "@/lib/demo-data";
import { EXPEDITIONS } from "@/lib/demo-data";
import { MPS_ANNEX } from "@/lib/assumptions";
import type { Lang } from "@/lib/i18n";

export interface BusinessKpiDef {
  id: string;
  target: number | null;
  unit: "pct" | "text" | "bool";
  es: { title: string; detail: string };
  en: { title: string; detail: string };
}

/** Los 6 números que Sofía mira en 6 meses. Sin hablar de IA ni de tech. */
export const BUSINESS_KPIS_6M: BusinessKpiDef[] = [
  {
    id: "origin_95",
    target: 95,
    unit: "pct",
    es: {
      title: "Saber de dónde viene el 95 % de los interesados",
      detail:
        "Web, recomendación, feria, newsletter… Si no sabemos el origen, no sabemos qué canal funciona. Meta: casi todos con origen claro.",
    },
    en: {
      title: "Know where 95% of prospects come from",
      detail:
        "Web, referral, fair, newsletter… No origin means you can’t tell which channel works. Goal: almost everyone with a clear source.",
    },
  },
  {
    id: "ceo_admin_60",
    target: 60,
    unit: "pct",
    es: {
      title: "Bajar un 60 % el tiempo de papeles de Sofía",
      detail:
        "Menos ordenar Excel, menos peinar el correo, menos «pregúntale a Sofía». Medimos horas la semana 1 y lo revisamos cada mes.",
    },
    en: {
      title: "Cut Sofía's paperwork time by 60%",
      detail:
        "Less sorting sheets, less inbox triage, less “ask Sofía”. We measure hours in week 1 and review monthly.",
    },
  },
  {
    id: "reactivate_15",
    target: 15,
    unit: "pct",
    es: {
      title: "Que vuelva a viajar un 15 % de clientes dormidos",
      detail:
        "Lista «llamar este mes» → la llamada la hace una persona. Meta: ~15 de cada 100 que no han vuelto reservan otra vez en un año.",
    },
    en: {
      title: "Bring back 15% of dormant clients",
      detail:
        "“Call this month” list → a person dials. Goal: ~15 in 100 who haven’t returned book again within a year.",
    },
  },
  {
    id: "occupancy_up",
    target: null,
    unit: "text",
    es: {
      title: "Llenar mejor cada salida",
      detail: "Más plazas ocupadas por viaje = más margen y mejor ambiente de grupo.",
    },
    en: {
      title: "Fill each departure better",
      detail: "More seats filled per trip = better margin and a better group feel.",
    },
  },
  {
    id: "margin_up",
    target: MPS_ANNEX.marginTargetPct,
    unit: "pct",
    es: {
      title: "Mejorar lo que deja cada ruta",
      detail: `Objetivo de casa: alrededor del ${MPS_ANNEX.marginTargetPct} % bruto por salida. Precio y coste a la vista para decidir.`,
    },
    en: {
      title: "Improve what each route earns",
      detail: `House goal: around ${MPS_ANNEX.marginTargetPct}% gross per departure. Price and cost visible so you can decide.`,
    },
  },
  {
    id: "dashboard_daily",
    target: null,
    unit: "bool",
    es: {
      title: "Una pantalla actualizada cada día",
      detail:
        "Cada mañana: de dónde vienen, ocupación, margen y cuánto falta para 1M €. Sin abrir cinco Excels.",
    },
    en: {
      title: "One screen updated every day",
      detail:
        "Every morning: where they come from, occupancy, margin and the gap to €1M. No five spreadsheets.",
    },
  },
];

export interface BusinessKpiSnapshot {
  id: string;
  title: string;
  detail: string;
  current: number | null;
  target: number | null;
  unit: BusinessKpiDef["unit"];
  tone: "good" | "warn" | "neutral" | "brand";
  display: string;
}

export function avgOccupancyPct(expeditions: Expedition[]): number {
  if (!expeditions.length) return 0;
  const sum = expeditions.reduce((s, e) => s + (e.seats ? e.booked / e.seats : 0), 0);
  return Math.round((sum / expeditions.length) * 100);
}

export function avgMarginPct(expeditions: Expedition[]): number {
  if (!expeditions.length) return 0;
  const sum = expeditions.reduce((s, e) => {
    if (!e.revenue) return s;
    return s + ((e.revenue - e.cost) / e.revenue) * 100;
  }, 0);
  return Math.round(sum / expeditions.length);
}

function dormantPool(clients: Client[]): Client[] {
  return clients.filter(
    (c) => c.segment === "dormido" || c.segment === "en_riesgo" || c.status === "dormido",
  );
}

/**
 * Snapshot vivo desde Hub + expediciones.
 * El tiempo de papeles de Sofía se mide a mano (semana 1).
 */
export function computeBusinessKpis(
  lang: Lang,
  input: {
    leads: Lead[];
    clients: Client[];
    expeditions?: Expedition[];
    hubUpdatedAt?: string | null;
  },
): BusinessKpiSnapshot[] {
  const expeditions = input.expeditions ?? EXPEDITIONS;
  const leads = input.leads;
  const known = leads.filter((l) => l.origin !== "unknown").length;
  const originPct = leads.length ? Math.round((known / leads.length) * 100) : 0;

  const dormants = dormantPool(input.clients);
  const inContactQueue = input.clients.filter(
    (c) =>
      c.contactThisMonth ||
      (c.reactivationPriority >= 70 &&
        (c.segment === "dormido" || c.segment === "en_riesgo")),
  ).length;
  const reactivateProxy =
    dormants.length > 0 ? Math.round((inContactQueue / dormants.length) * 100) : 0;

  const occ = avgOccupancyPct(expeditions);
  const margin = avgMarginPct(expeditions);
  const hubFresh =
    Boolean(input.hubUpdatedAt) &&
    Date.now() - new Date(input.hubUpdatedAt!).getTime() < 1000 * 60 * 60 * 36;

  return BUSINESS_KPIS_6M.map((def) => {
    const copy = lang === "es" ? def.es : def.en;
    switch (def.id) {
      case "origin_95":
        return {
          id: def.id,
          title: copy.title,
          detail: copy.detail,
          current: originPct,
          target: 95,
          unit: "pct" as const,
          tone: originPct >= 95 ? "good" : originPct >= 70 ? "brand" : "warn",
          display: `${originPct} %`,
        };
      case "ceo_admin_60":
        return {
          id: def.id,
          title: copy.title,
          detail: copy.detail,
          current: null,
          target: 60,
          unit: "pct",
          tone: "neutral",
          display: lang === "es" ? "Se mide a mano (sem. 1)" : "Manual baseline (wk 1)",
        };
      case "reactivate_15":
        return {
          id: def.id,
          title: copy.title,
          detail: copy.detail,
          current: reactivateProxy,
          target: 15,
          unit: "pct",
          tone: reactivateProxy >= 15 ? "good" : "warn",
          display:
            lang === "es"
              ? `${inContactQueue}/${dormants.length || "—"} en cola · meta 15 %`
              : `${inContactQueue}/${dormants.length || "—"} queued · 15% goal`,
        };
      case "occupancy_up":
        return {
          id: def.id,
          title: copy.title,
          detail: copy.detail,
          current: occ,
          target: null,
          unit: "pct",
          tone: occ >= 90 ? "good" : occ >= 75 ? "brand" : "warn",
          display: lang === "es" ? `${occ} % de media` : `${occ}% average`,
        };
      case "margin_up":
        return {
          id: def.id,
          title: copy.title,
          detail: copy.detail,
          current: margin,
          target: MPS_ANNEX.marginTargetPct,
          unit: "pct",
          tone: margin >= MPS_ANNEX.marginTargetPct ? "good" : "warn",
          display: `${margin} % · meta ${MPS_ANNEX.marginTargetPct} %`,
        };
      case "dashboard_daily":
        return {
          id: def.id,
          title: copy.title,
          detail: copy.detail,
          current: hubFresh ? 1 : 0,
          target: 1,
          unit: "bool",
          tone: hubFresh ? "good" : "warn",
          display: hubFresh
            ? lang === "es"
              ? "Datos al día"
              : "Data current"
            : lang === "es"
              ? "Hay que actualizar"
              : "Needs a refresh",
        };
      default:
        return {
          id: def.id,
          title: copy.title,
          detail: copy.detail,
          current: null,
          target: def.target,
          unit: def.unit,
          tone: "neutral",
          display: "—",
        };
    }
  });
}
