/**
 * Presupuesto de tokens del asistente.
 *
 * Objetivo: que las respuestas duren más en la API — respuestas cortas,
 * max_tokens acotado, y un contador visible (como en la demo de referencia)
 * para que el equipo vea el consumo.
 */

export const AI_USAGE_KEY = "mps-ai-usage-v1";

export interface AiUsageSnapshot {
  conversations: number;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  updatedAt: string;
}

const EMPTY: AiUsageSnapshot = {
  conversations: 0,
  messages: 0,
  inputTokens: 0,
  outputTokens: 0,
  updatedAt: new Date(0).toISOString(),
};

/** Estimación barata ≈ tokens (no es el contador del proveedor). */
export function estimateTokens(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  // Heurística bilingüe ES/EN: ~4 chars / token.
  return Math.max(1, Math.ceil(t.length / 4));
}

export function loadAiUsage(): AiUsageSnapshot {
  try {
    const raw = localStorage.getItem(AI_USAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<AiUsageSnapshot>;
    return {
      conversations: Number(parsed.conversations) || 0,
      messages: Number(parsed.messages) || 0,
      inputTokens: Number(parsed.inputTokens) || 0,
      outputTokens: Number(parsed.outputTokens) || 0,
      updatedAt: parsed.updatedAt || EMPTY.updatedAt,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function recordAiUsage(input: { prompt: string; reply: string; newConversation?: boolean }): AiUsageSnapshot {
  const prev = loadAiUsage();
  const next: AiUsageSnapshot = {
    conversations: prev.conversations + (input.newConversation ? 1 : 0),
    messages: prev.messages + 1,
    inputTokens: prev.inputTokens + estimateTokens(input.prompt),
    outputTokens: prev.outputTokens + estimateTokens(input.reply),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(AI_USAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function formatTokenK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

/**
 * Instrucción de sistema para ahorrar tokens: tablas + bullets, sin relleno.
 */
export function conciseSystemPrompt(maxOutputTokens: number): string {
  return [
    "Eres el asistente interno del Growth OS Campo Norte. Solo ayuda al equipo; nunca escribas al viajero.",
    "Responde en español, breve y estructurado: tablas markdown o bullets. Nada de párrafos largos.",
    "Cierra con 3–5 puntos de «Lectura rápida» y UNA pregunta de seguimiento.",
    `Límite duro: como máximo ~${Math.max(80, Math.floor(maxOutputTokens * 0.7))} palabras. Prioriza cifras y acciones.`,
  ].join(" ");
}
