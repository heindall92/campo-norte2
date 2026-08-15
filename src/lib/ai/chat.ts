import {
  activeApiKey,
  activeModel,
  loadAiSettings,
  type AiProvider,
  type AiSettings,
} from "./settings";
import { allowClientAiKeys } from "@/lib/runtime";
import { conciseSystemPrompt } from "./token-budget";

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChatResult {
  content: string;
  model: string;
  provider: AiProvider;
  /** Estimación local de tokens de la respuesta. */
  outputTokensEst?: number;
  maxOutputTokens?: number;
}

export type AiChatFormat = "json" | Record<string, unknown>;

/** Compat aliases */
export type OllamaChatMessage = AiChatMessage;
export type OllamaChatResult = AiChatResult;

function formatHint(format?: AiChatFormat): string {
  if (!format) return "";
  if (format === "json") {
    return "\n\nResponde ÚNICAMENTE con JSON válido.";
  }
  return `\n\nResponde ÚNICAMENTE con JSON válido que cumpla este schema: ${JSON.stringify(format)}`;
}

function withFormat(messages: AiChatMessage[], format?: AiChatFormat): AiChatMessage[] {
  if (!format) return messages;
  const hint = formatHint(format);
  const copy = messages.map((m) => ({ ...m }));
  const lastUser = [...copy].reverse().find((m) => m.role === "user");
  if (lastUser) lastUser.content += hint;
  else copy.push({ role: "user", content: hint.trim() });
  return copy;
}

async function chatOllama(
  settings: AiSettings,
  messages: AiChatMessage[],
  format?: AiChatFormat,
): Promise<AiChatResult> {
  const model = activeModel(settings);
  const endpoint =
    settings.ollamaMode === "local"
      ? `${settings.ollamaBaseUrl || "http://localhost:11434"}/api/chat`
      : "/api/ai/chat";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = activeApiKey(settings);
  if (settings.ollamaMode === "cloud" && key) {
    headers.Authorization = `Bearer ${key}`;
  }

  const body: Record<string, unknown> =
    settings.ollamaMode === "local"
      ? {
          model,
          messages,
          stream: false,
          options: { num_predict: settings.maxOutputTokens },
          ...(format ? { format } : {}),
        }
      : {
          provider: "ollama",
          model,
          messages,
          format: format ?? null,
          apiKey: key,
          maxTokens: settings.maxOutputTokens,
        };

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama ${res.status}: ${text.slice(0, 240) || res.statusText}`);
  }
  const data = (await res.json()) as {
    content?: string;
    message?: { content?: string };
    response?: string;
    model?: string;
  };
  const content = data.content ?? data.message?.content ?? data.response ?? "";
  if (!content.trim()) throw new Error("Ollama devolvió respuesta vacía");
  return {
    content,
    model: data.model ?? model,
    provider: "ollama",
    maxOutputTokens: settings.maxOutputTokens,
  };
}

async function chatViaProxy(
  provider: Exclude<AiProvider, "ollama"> | "ollama",
  settings: AiSettings,
  messages: AiChatMessage[],
  format?: AiChatFormat,
): Promise<AiChatResult> {
  const model = activeModel(settings);
  const sendClientKey = allowClientAiKeys();
  const apiKey = sendClientKey ? activeApiKey(settings) : "";
  if (sendClientKey && !apiKey && !(provider === "ollama" && settings.ollamaMode === "local")) {
    throw new Error(`Falta API key de ${provider} (Ajustes → IA)`);
  }

  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      model,
      messages: withFormat(messages, provider === "ollama" ? undefined : format),
      format: format ?? null,
      maxTokens: settings.maxOutputTokens,
      ...(sendClientKey && apiKey ? { apiKey } : {}),
      ollamaMode: settings.ollamaMode,
      ollamaBaseUrl: settings.ollamaBaseUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${provider} ${res.status}: ${text.slice(0, 280) || res.statusText}`);
  }

  const data = (await res.json()) as { content?: string; model?: string; error?: string };
  if (data.error) throw new Error(data.error);
  const content = data.content ?? "";
  if (!content.trim()) throw new Error(`${provider} devolvió respuesta vacía`);
  return {
    content,
    model: data.model ?? model,
    provider: settings.provider,
    maxOutputTokens: settings.maxOutputTokens,
  };
}

/**
 * Chat unificado: Ollama | OpenAI | Claude | Gemini.
 * format:json o schema → se pide JSON al modelo.
 */
export async function aiChat(
  messages: AiChatMessage[],
  options?: { settings?: AiSettings; format?: AiChatFormat },
): Promise<AiChatResult> {
  const settings = options?.settings ?? loadAiSettings();
  if (!settings.enabled) {
    throw new Error("IA desactivada en Ajustes");
  }

  const format = options?.format;
  let msgs = messages.map((m) => ({ ...m }));
  if (settings.conciseMode && !msgs.some((m) => m.role === "system")) {
    msgs = [{ role: "system", content: conciseSystemPrompt(settings.maxOutputTokens) }, ...msgs];
  }

  if (settings.provider === "ollama" && settings.ollamaMode === "local") {
    return chatOllama(settings, msgs, format);
  }

  return chatViaProxy(settings.provider, settings, msgs, format);
}

/** @deprecated usar aiChat */
export async function ollamaChat(
  messages: AiChatMessage[],
  options?: { settings?: AiSettings; format?: AiChatFormat },
): Promise<AiChatResult> {
  return aiChat(messages, options);
}

/** Ping real al proveedor activo. Devuelve ok + detalle o lanza error. */
export async function testAiConnection(
  settings: AiSettings = loadAiSettings(),
): Promise<{ ok: true; provider: AiProvider; model: string; reply: string }> {
  if (!settings.enabled) {
    throw new Error("Activa la IA (checkbox) antes de probar");
  }
  const key = activeApiKey(settings);
  if (allowClientAiKeys()) {
    if (settings.provider !== "ollama" || settings.ollamaMode === "cloud") {
      if (!key) throw new Error(`Falta API key de ${settings.provider}`);
    }
  }
  const result = await aiChat(
    [
      {
        role: "user",
        content: 'Responde exactamente con la palabra OK (sin más texto).',
      },
    ],
    { settings },
  );
  return {
    ok: true,
    provider: result.provider,
    model: result.model,
    reply: result.content.trim().slice(0, 120),
  };
}

export function parseJsonFromModel(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) return JSON.parse(fence[1].trim());
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("No se pudo parsear JSON del modelo");
  }
}
