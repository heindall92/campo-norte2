import type { Client, ClientSegment, ClientStatus, RouteCode } from "@/lib/demo-data";
import { ROUTE_LABEL } from "@/lib/demo-data";
import { ollamaChat, parseJsonFromModel } from "./ollama";
import { loadOllamaSettings, ollamaReady } from "./settings";

export type IntelligenceSource = "heuristic" | "ollama";

export interface CustomerIntelligenceResult {
  segment: ClientSegment;
  status: ClientStatus;
  reactivationPriority: number;
  reactivationWhy: string;
  returnProbability: number;
  contactThisMonth: boolean;
  highValue: boolean;
  reasons: string[];
  source: IntelligenceSource;
}

const SEGMENTS: ClientSegment[] = [
  "activo",
  "recurrente",
  "dormido",
  "vip",
  "embajador",
  "en_riesgo",
  "prospecto_newsletter",
];

const STATUSES: ClientStatus[] = ["al_dia", "seguimiento", "dormido", "alta_prioridad"];

export function monthsSinceTrip(lastTripAt: string | null | undefined): number | null {
  if (!lastTripAt) return null;
  const d = new Date(lastTripAt);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function lastRouteLabel(c: Client): string {
  const route = c.history[0]?.route ?? c.preferredRoute;
  return route ? ROUTE_LABEL[route as RouteCode] : "—";
}

/** Señales internas (sin PII completa) para prompt / heurística */
export function buildClientSignals(c: Client) {
  const months = monthsSinceTrip(c.lastTripAt);
  return {
    id: c.id,
    trips: c.trips,
    monthsSinceLastTrip: months,
    lastRoute: lastRouteLabel(c),
    lastTripAt: c.lastTripAt,
    ltv: c.ltv,
    avgTicket: c.avgTicket,
    brevoOpens: c.brevoOpens,
    referrals: c.referrals,
    nps: c.nps,
    segmentHint: c.segment,
    neverOutboundContact: !c.lastOutboundAt,
    lastOutboundAt: c.lastOutboundAt ?? null,
    nextInterest: c.nextInterest ? ROUTE_LABEL[c.nextInterest] : null,
    vehiclePref: c.vehiclePref,
    historyCount: c.history.length,
  };
}

/**
 * Clasificación determinística (sin LLM).
 * Regla de oro: solo prioriza para el equipo — nunca redacta mensaje al viajero.
 */
export function classifyCustomerHeuristic(c: Client): CustomerIntelligenceResult {
  const months = monthsSinceTrip(c.lastTripAt);
  const neverOutbound = !c.lastOutboundAt;
  const engaged = c.brevoOpens >= 5;
  const highValue = c.ltv >= 10_000 || c.avgTicket >= 5_500 || c.trips >= 4;
  const reasons: string[] = [];

  let segment: ClientSegment = "activo";
  let status: ClientStatus = "al_dia";
  let returnProbability = 35;

  if (c.trips === 0 && c.brevoOpens > 0) {
    segment = "prospecto_newsletter";
    reasons.push("Sin viaje · engagement newsletter");
    returnProbability = 25;
  } else if (c.trips >= 5 || c.ltv >= 25_000) {
    segment = "vip";
    reasons.push(
      c.trips >= 5 ? `${c.trips} expediciones` : `LTV alto (${Math.round(c.ltv).toLocaleString("es-ES")} €)`,
    );
    returnProbability = 55;
    status = "seguimiento";
  } else if ((c.referrals ?? 0) >= 2 || c.nps === 10) {
    segment = "embajador";
    reasons.push(
      c.nps === 10 ? "NPS 10" : `${c.referrals} referidos`,
    );
    returnProbability = 50;
    status = "seguimiento";
  } else if (months !== null && months >= 36 && c.trips >= 1) {
    segment = "en_riesgo";
    reasons.push(`Último viaje hace ${months} meses — riesgo de pérdida`);
    if (engaged) reasons.push(`Abre newsletters (${c.brevoOpens})`);
    returnProbability = engaged ? 62 : 40;
    status = "dormido";
  } else if (months !== null && months >= 12 && c.trips >= 1) {
    segment = "dormido";
    reasons.push(`Último viaje: ${lastRouteLabel(c)} hace ${months} meses`);
    if (engaged) {
      reasons.push(`Abre newsletters (${c.brevoOpens})`);
      returnProbability = months <= 24 ? 78 : 68;
    } else {
      returnProbability = 48;
    }
    status = "alta_prioridad";
  } else if (c.trips >= 2) {
    segment = "recurrente";
    reasons.push(`${c.trips} viajes · recurrente sana`);
    returnProbability = 45;
  } else if (c.trips >= 1) {
    segment = "activo";
    reasons.push("Viajero reciente / activo");
    returnProbability = 40;
  }

  if (highValue && segment !== "vip") {
    reasons.push("Alto valor (LTV / ticket)");
  }
  if (neverOutbound && (segment === "dormido" || segment === "en_riesgo")) {
    reasons.push("Nunca recibió llamada / contacto saliente del equipo");
    returnProbability = clamp(returnProbability + 12);
  }
  if (c.nextInterest) {
    reasons.push(`Interés siguiente: ${ROUTE_LABEL[c.nextInterest]}`);
    returnProbability = clamp(returnProbability + 5);
  }

  const contactThisMonth =
    returnProbability >= 65 &&
    (segment === "dormido" || segment === "en_riesgo" || status === "alta_prioridad") &&
    neverOutbound;

  if (contactThisMonth) {
    reasons.push("Probabilidad alta de volver → contactar este mes (equipo)");
    status = "alta_prioridad";
  }

  const reactivationPriority = clamp(
    returnProbability * 0.85 + (highValue ? 10 : 0) + (engaged ? 5 : 0),
  );

  const reactivationWhy = reasons.slice(0, 4).join(" · ") || "Sin señales fuertes";

  return {
    segment,
    status,
    reactivationPriority,
    reactivationWhy,
    returnProbability: clamp(returnProbability),
    contactThisMonth,
    highValue,
    reasons,
    source: "heuristic",
  };
}

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    segment: { type: "string" },
    status: { type: "string" },
    reactivationPriority: { type: "number" },
    returnProbability: { type: "number" },
    contactThisMonth: { type: "boolean" },
    highValue: { type: "boolean" },
    reasons: { type: "array", items: { type: "string" } },
    reactivationWhy: { type: "string" },
  },
  required: [
    "segment",
    "status",
    "reactivationPriority",
    "returnProbability",
    "contactThisMonth",
    "reasons",
  ],
} as const;

function normalizeAiResult(
  raw: Record<string, unknown>,
  fallback: CustomerIntelligenceResult,
): CustomerIntelligenceResult {
  const segment = SEGMENTS.includes(raw.segment as ClientSegment)
    ? (raw.segment as ClientSegment)
    : fallback.segment;
  const status = STATUSES.includes(raw.status as ClientStatus)
    ? (raw.status as ClientStatus)
    : fallback.status;
  const reasons = Array.isArray(raw.reasons)
    ? (raw.reasons as unknown[]).map(String).filter(Boolean).slice(0, 8)
    : fallback.reasons;
  const returnProbability = clamp(Number(raw.returnProbability) || fallback.returnProbability);
  const reactivationPriority = clamp(
    Number(raw.reactivationPriority) || fallback.reactivationPriority,
  );
  const contactThisMonth = Boolean(
    raw.contactThisMonth ?? (returnProbability >= 65 && segment === "dormido"),
  );
  const highValue = Boolean(raw.highValue ?? fallback.highValue);
  const reactivationWhy =
    typeof raw.reactivationWhy === "string" && raw.reactivationWhy.trim()
      ? raw.reactivationWhy.trim()
      : reasons.slice(0, 3).join(" · ");

  return {
    segment,
    status,
    reactivationPriority,
    reactivationWhy,
    returnProbability,
    contactThisMonth,
    highValue,
    reasons: reasons.length ? reasons : fallback.reasons,
    source: "ollama",
  };
}

async function classifyCustomerWithOllama(c: Client): Promise<CustomerIntelligenceResult> {
  const fallback = classifyCustomerHeuristic(c);
  const signals = buildClientSignals(c);
  const settings = loadOllamaSettings();

  const { content } = await ollamaChat(
    [
      {
        role: "system",
        content: [
          "Eres el motor de Customer Intelligence de Campo Norte (viajes premium moto/4x4).",
          "SOLO clasificas clientes para el equipo interno. PROHIBIDO redactar mensajes al cliente, emails o WhatsApp.",
          "Segmentos válidos: activo, recurrente, dormido, vip, embajador, en_riesgo, prospecto_newsletter.",
          "Status válidos: al_dia, seguimiento, dormido, alta_prioridad.",
          "contactThisMonth=true solo si conviene que el equipo llame/WhatsApp ESTE MES (humano en el loop).",
          "reasons: frases cortas auditables en español (ej. «Último viaje Namibia hace 18 meses»).",
          "Responde ÚNICAMENTE JSON válido.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Clasifica este cliente (señales pseudonimizadas):\n${JSON.stringify(signals, null, 2)}`,
      },
    ],
    { settings, format: SCORE_SCHEMA },
  );

  const parsed = parseJsonFromModel(content) as Record<string, unknown>;
  return normalizeAiResult(parsed, fallback);
}

/** Heurística siempre; Ollama si está configurado en Ajustes. */
export async function classifyCustomer(
  c: Client,
  options?: { forceHeuristic?: boolean },
): Promise<CustomerIntelligenceResult> {
  if (options?.forceHeuristic || !ollamaReady()) {
    return classifyCustomerHeuristic(c);
  }
  try {
    return await classifyCustomerWithOllama(c);
  } catch {
    const h = classifyCustomerHeuristic(c);
    return {
      ...h,
      reasons: [...h.reasons, "Fallback heurístico (Ollama no disponible)"],
      reactivationWhy: `${h.reactivationWhy} · (heurística)`,
    };
  }
}

export function applyIntelligenceToClient(
  c: Client,
  result: CustomerIntelligenceResult,
): Client {
  return {
    ...c,
    segment: result.segment,
    status: result.status,
    reactivationPriority: result.reactivationPriority,
    reactivationWhy: result.reactivationWhy,
    returnProbability: result.returnProbability,
    contactThisMonth: result.contactThisMonth,
    intelligenceSource: result.source,
    intelligenceAt: new Date().toISOString(),
  };
}

export function clientsToContactThisMonth(clients: Client[]): Client[] {
  return [...clients]
    .filter(
      (c) =>
        c.contactThisMonth === true ||
        (c.reactivationPriority >= 70 &&
          (c.segment === "dormido" || c.segment === "en_riesgo" || c.status === "alta_prioridad")),
    )
    .sort((a, b) => b.reactivationPriority - a.reactivationPriority);
}
