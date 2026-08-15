/**
 * Chat con streaming (SSE OpenAI / NDJSON Ollama).
 * Claude y Gemini: si el proxy no streamea, se emite el texto completo de una.
 */

import {
  activeApiKey,
  activeModel,
  loadAiSettings,
  type AiProvider,
  type AiSettings,
} from "./settings";
import { allowClientAiKeys } from "@/lib/runtime";
import { conciseSystemPrompt } from "./token-budget";
import type { AiChatMessage, AiChatResult } from "./chat";

export type StreamHandlers = {
  onToken?: (chunk: string) => void;
  signal?: AbortSignal;
};

async function readSseContent(
  res: Response,
  onToken?: (chunk: string) => void,
): Promise<string> {
  if (!res.body) {
    const data = (await res.json()) as { content?: string };
    const c = data.content ?? "";
    if (c) onToken?.(c);
    return c;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      const payload = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;
      try {
        const json = JSON.parse(payload) as {
          content?: string;
          choices?: { delta?: { content?: string } }[];
          message?: { content?: string };
          done?: boolean;
        };
        const piece =
          json.content ??
          json.choices?.[0]?.delta?.content ??
          (json.done ? "" : json.message?.content) ??
          "";
        if (piece) {
          full += piece;
          onToken?.(piece);
        }
      } catch {
        /* ignore partial JSON */
      }
    }
  }
  return full;
}

/**
 * Chat en streaming. Sin `format` JSON (el stream es texto libre).
 * Si el servidor responde JSON clásico (no SSE), se trata como un solo token.
 */
export async function aiChatStream(
  messages: AiChatMessage[],
  options?: { settings?: AiSettings } & StreamHandlers,
): Promise<AiChatResult> {
  const settings = options?.settings ?? loadAiSettings();
  if (!settings.enabled) throw new Error("IA desactivada en Ajustes");

  let msgs = messages.map((m) => ({ ...m }));
  if (settings.conciseMode && !msgs.some((m) => m.role === "system")) {
    msgs = [{ role: "system", content: conciseSystemPrompt(settings.maxOutputTokens) }, ...msgs];
  }

  const model = activeModel(settings);
  const provider = settings.provider;

  // Ollama local: NDJSON stream
  if (provider === "ollama" && settings.ollamaMode === "local") {
    const endpoint = `${settings.ollamaBaseUrl || "http://localhost:11434"}/api/chat`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: msgs,
        stream: true,
        options: { num_predict: settings.maxOutputTokens },
      }),
      signal: options?.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama ${res.status}: ${text.slice(0, 240)}`);
    }
    const content = await readSseContent(res, options?.onToken);
    if (!content.trim()) throw new Error("Ollama devolvió respuesta vacía");
    return { content, model, provider: "ollama", maxOutputTokens: settings.maxOutputTokens };
  }

  const sendClientKey = allowClientAiKeys();
  const apiKey = sendClientKey ? activeApiKey(settings) : "";

  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      model,
      messages: msgs,
      format: null,
      stream: true,
      maxTokens: settings.maxOutputTokens,
      ...(sendClientKey && apiKey ? { apiKey } : {}),
      ollamaMode: settings.ollamaMode,
      ollamaBaseUrl: settings.ollamaBaseUrl,
    }),
    signal: options?.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${provider} ${res.status}: ${text.slice(0, 280)}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json") && !ct.includes("event-stream") && !ct.includes("ndjson")) {
    const data = (await res.json()) as { content?: string; model?: string; error?: string };
    if (data.error) throw new Error(data.error);
    const content = data.content ?? "";
    if (content) options?.onToken?.(content);
    if (!content.trim()) throw new Error(`${provider} devolvió respuesta vacía`);
    return {
      content,
      model: data.model ?? model,
      provider: settings.provider as AiProvider,
      maxOutputTokens: settings.maxOutputTokens,
    };
  }

  const content = await readSseContent(res, options?.onToken);
  if (!content.trim()) throw new Error(`${provider} devolvió respuesta vacía`);
  return {
    content,
    model,
    provider: settings.provider as AiProvider,
    maxOutputTokens: settings.maxOutputTokens,
  };
}
