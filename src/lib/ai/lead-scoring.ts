import type { Client, Lead } from "@/lib/demo-data";
import { ollamaChat, parseJsonFromModel } from "./ollama";
import { loadOllamaSettings, ollamaReady } from "./settings";
import {
  clampScore,
  priorityFromScore,
  scoreLeadHeuristic,
  type LeadScoreResult,
} from "./lead-scoring-core";

/**
 * Las cuentas viven en `lead-scoring-core.ts`, que no depende del navegador:
 * así el servidor (`api/leads/ingest.ts`) puntúa con el mismo código que la UI.
 * Aquí solo queda el camino que habla con el modelo.
 */
export {
  DEFAULT_HALF_LIFE_DAYS,
  ORIGIN_WEIGHT,
  applyScoreToLead,
  clampScore,
  daysSince,
  decayFactor,
  decayedScore,
  priorityFromScore,
  priorityLabel,
  scoreLeadHeuristic,
  type DecayedScore,
  type LeadPriority,
  type LeadScoreResult,
  type LeadScoreSource,
} from "./lead-scoring-core";

async function scoreLeadWithOllama(lead: Lead, linked?: Client | null): Promise<LeadScoreResult> {
  const fallback = scoreLeadHeuristic(lead, linked);
  const settings = loadOllamaSettings();
  const payload = {
    leadId: lead.id,
    origin: lead.origin,
    campaign: lead.campaign,
    status: lead.status,
    interestRoute: lead.interestRoute,
    vehicle: lead.vehicle,
    linkedClient: linked
      ? {
          trips: linked.trips,
          ltv: linked.ltv,
          brevoOpens: linked.brevoOpens,
          segment: linked.segment,
          routes: linked.history.map((h) => h.route),
        }
      : null,
  };

  const { content } = await ollamaChat(
    [
      {
        role: "system",
        content: [
          "Eres el motor de Lead Scoring de Campo Norte.",
          "SOLO clasificas leads para el equipo. PROHIBIDO responder al cliente o redactar mensajes salientes.",
          "Devuelve JSON: score (0-100), reasons (array de strings cortos en español), priority (muy_alta|alta|media|baja).",
        ].join(" "),
      },
      {
        role: "user",
        content: `Puntúa este lead:\n${JSON.stringify(payload)}`,
      },
    ],
    {
      settings,
      format: {
        type: "object",
        properties: {
          score: { type: "number" },
          reasons: { type: "array", items: { type: "string" } },
          priority: { type: "string" },
        },
        required: ["score", "reasons"],
      },
    },
  );

  const raw = parseJsonFromModel(content) as Record<string, unknown>;
  const score = clampScore(Number(raw.score) || fallback.score);
  const reasons = Array.isArray(raw.reasons)
    ? (raw.reasons as unknown[]).map(String).filter(Boolean).slice(0, 8)
    : fallback.reasons;
  const priority =
    raw.priority === "muy_alta" ||
    raw.priority === "alta" ||
    raw.priority === "media" ||
    raw.priority === "baja"
      ? raw.priority
      : priorityFromScore(score);

  return { score, priority, reasons: reasons.length ? reasons : fallback.reasons, source: "ollama" };
}

export async function scoreLead(
  lead: Lead,
  linked?: Client | null,
  options?: { forceHeuristic?: boolean },
): Promise<LeadScoreResult> {
  if (options?.forceHeuristic || !ollamaReady()) {
    return scoreLeadHeuristic(lead, linked);
  }
  try {
    return await scoreLeadWithOllama(lead, linked);
  } catch {
    const h = scoreLeadHeuristic(lead, linked);
    return {
      ...h,
      reasons: [...h.reasons, "Fallback heurístico (Ollama no disponible)"],
    };
  }
}
