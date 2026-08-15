/**
 * Proxy unificado → Ollama Cloud | OpenAI | Claude | Gemini.
 * Body: { provider, model, messages, format?, apiKey?, ollamaMode?, ollamaBaseUrl? }
 * Keys también vía env: OLLAMA_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY
 *
 * Seguridad: solo acepta peticiones desde el origen de la app. Sin este control,
 * cualquiera con la URL podría usar el endpoint como pasarela gratuita contra
 * las API keys del servidor.
 *
 * El guard va escrito aquí dentro a propósito: estas funciones son ESM
 * (`"type": "module"`) y un import relativo entre carpetas de /api rompe la
 * invocación en Vercel. Se duplica en api/ollama/chat.ts; son 40 líneas y el
 * coste de que fallen es una factura de API ajena.
 */

type Msg = { role: string; content: string };

type ReqHeaders = Record<string, string | string[] | undefined>;

const MAX_MESSAGES = 40;
const MAX_CHARS = 24_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.AI_RATE_LIMIT ?? 20);

const HITS = new Map<string, number[]>();

function header(headers: ReqHeaders, name: string): string {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return typeof raw === "string" ? raw : "";
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function allowedOrigins(): string[] {
  const list = new Set<string>();
  for (const v of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (v) list.add(`https://${v}`);
  }
  for (const raw of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
    const o = originOf(raw.trim()) || raw.trim();
    if (o) list.add(o);
  }
  if (process.env.VERCEL_ENV !== "production") {
    list.add("http://localhost:5173");
    list.add("http://127.0.0.1:5173");
    list.add("http://localhost:4173");
  }
  return [...list];
}

function rateLimited(headers: ReqHeaders): boolean {
  const fwd = header(headers, "x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0]!.trim() : header(headers, "x-real-ip")) || "unknown";
  const now = Date.now();
  const recent = (HITS.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  HITS.set(ip, recent);
  if (HITS.size > 5_000) {
    for (const [k, v] of HITS) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) HITS.delete(k);
    }
  }
  return recent.length > RATE_MAX;
}

/**
 * Los navegadores mandan `Origin` en toda petición POST, también same-origin.
 * Una petición sin `Origin` ni `Referer` es un cliente no-navegador (curl,
 * script): justo el vector que quema las API keys.
 */
function guard(headers: ReqHeaders): { ok: boolean; status: number; error?: string; origin?: string } {
  const candidate = header(headers, "origin") || originOf(header(headers, "referer"));
  if (!candidate) {
    return { ok: false, status: 403, error: "Origen no permitido: este endpoint solo acepta peticiones desde la app." };
  }
  const allowed = allowedOrigins();
  if (allowed.length > 0 && !allowed.includes(candidate)) {
    return { ok: false, status: 403, error: "Origen no permitido." };
  }
  if (rateLimited(headers)) {
    return { ok: false, status: 429, error: "Demasiadas peticiones. Espera un minuto.", origin: candidate };
  }
  return { ok: true, status: 200, origin: candidate };
}

function envKey(provider: string): string | undefined {
  switch (provider) {
    case "ollama":
      return process.env.OLLAMA_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "claude":
      return process.env.ANTHROPIC_API_KEY;
    case "gemini":
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    default:
      return undefined;
  }
}

function splitSystem(messages: Msg[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const rest = messages.filter((m) => m.role !== "system");
  return { system, rest };
}

async function callOllama(opts: {
  model: string;
  messages: Msg[];
  format: unknown;
  apiKey: string;
  stream?: boolean;
}) {
  const res = await fetch("https://ollama.com/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: Boolean(opts.stream),
      ...(opts.format && !opts.stream ? { format: opts.format } : {}),
    }),
  });
  if (opts.stream && res.ok && res.body) {
    return { status: 200, stream: res.body, contentType: "application/x-ndjson" as const };
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    return { status: res.status, body: { error: text.slice(0, 400), ...data } };
  }
  const message = data.message as { content?: string } | undefined;
  return {
    status: 200,
    body: {
      content: message?.content ?? (data.response as string) ?? "",
      model: (data.model as string) ?? opts.model,
      provider: "ollama",
    },
  };
}

async function callOpenAI(opts: {
  model: string;
  messages: Msg[];
  format: unknown;
  apiKey: string;
  maxTokens?: number;
  stream?: boolean;
}) {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: 0.2,
    max_tokens: opts.maxTokens ?? 600,
    stream: Boolean(opts.stream),
  };
  if (opts.format && !opts.stream) {
    body.response_format = { type: "json_object" };
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (opts.stream && res.ok && res.body) {
    return { status: 200, stream: res.body, contentType: "text/event-stream" as const };
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      status: res.status,
      body: { error: data.error?.message || JSON.stringify(data).slice(0, 400) },
    };
  }
  return {
    status: 200,
    body: {
      content: data.choices?.[0]?.message?.content ?? "",
      model: data.model ?? opts.model,
      provider: "openai",
    },
  };
}

async function callClaude(opts: {
  model: string;
  messages: Msg[];
  format: unknown;
  apiKey: string;
  maxTokens?: number;
}) {
  const { system, rest } = splitSystem(opts.messages);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 600,
      temperature: 0.2,
      system: system || undefined,
      messages: rest.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    }),
  });
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    model?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      status: res.status,
      body: { error: data.error?.message || JSON.stringify(data).slice(0, 400) },
    };
  }
  const text = (data.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text || "")
    .join("\n");
  return {
    status: 200,
    body: {
      content: text,
      model: data.model ?? opts.model,
      provider: "claude",
    },
  };
}

async function callGemini(opts: {
  model: string;
  messages: Msg[];
  format: unknown;
  apiKey: string;
  maxTokens?: number;
}) {
  const { system, rest } = splitSystem(opts.messages);
  const contents = rest.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: opts.maxTokens ?? 600,
      ...(opts.format ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      status: res.status,
      body: { error: data.error?.message || JSON.stringify(data).slice(0, 400) },
    };
  }
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
  return {
    status: 200,
    body: {
      content: text,
      model: opts.model,
      provider: "gemini",
    },
  };
}

export default async function handler(
  req: {
    method?: string;
    headers: ReqHeaders;
    body: {
      provider?: string;
      model?: string;
      messages?: Msg[];
      format?: unknown;
      apiKey?: string;
      stream?: boolean;
      maxTokens?: number;
    };
  },
  res: {
    status: (code: number) => { json: (body: unknown) => void; end: (s?: string) => void };
    setHeader: (k: string, v: string) => void;
    write?: (chunk: string) => void;
    end?: (s?: string) => void;
    flushHeaders?: () => void;
  },
) {
  const verdict = guard(req.headers ?? {});

  if (verdict.origin) {
    res.setHeader("Access-Control-Allow-Origin", verdict.origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    res.status(verdict.ok ? 204 : verdict.status).end();
    return;
  }
  if (!verdict.ok) {
    res.status(verdict.status).json({ error: verdict.error });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const provider = (req.body?.provider || "ollama") as string;
  const model = req.body?.model || "";
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const format = req.body?.format ?? null;
  const wantStream = Boolean(req.body?.stream);
  const maxTokens = Math.min(4000, Math.max(128, Number(req.body?.maxTokens) || 600));

  if (messages.length > MAX_MESSAGES) {
    res.status(413).json({ error: `Demasiados mensajes (máx. ${MAX_MESSAGES})` });
    return;
  }
  if (messages.reduce((n, m) => n + (m.content?.length ?? 0), 0) > MAX_CHARS) {
    res.status(413).json({ error: `Prompt demasiado largo (máx. ${MAX_CHARS} caracteres)` });
    return;
  }

  const isVercelProd = process.env.VERCEL_ENV === "production";
  const allowClientKeys =
    process.env.ALLOW_CLIENT_AI_KEYS === "true" ||
    (!isVercelProd && process.env.ALLOW_CLIENT_AI_KEYS !== "false");
  const clientKey = allowClientKeys ? String(req.body?.apiKey || "").trim() : "";
  const apiKey = (envKey(provider) || clientKey).trim();

  if (!model || !messages.length) {
    res.status(400).json({ error: "Faltan model o messages" });
    return;
  }
  if (!apiKey) {
    res.status(401).json({
      error: `Falta API key para ${provider}. En producción configura ${provider === "claude" ? "ANTHROPIC_API_KEY" : provider === "openai" ? "OPENAI_API_KEY" : provider === "gemini" ? "GEMINI_API_KEY" : "OLLAMA_API_KEY"} en Vercel.`,
    });
    return;
  }

  try {
    // Stream nativo OpenAI / Ollama; Claude/Gemini → respuesta completa (cliente la trata como un token).
    if (wantStream && (provider === "openai" || provider === "ollama") && res.write) {
      const streamed =
        provider === "openai"
          ? await callOpenAI({ model, messages, format, apiKey, maxTokens, stream: true })
          : await callOllama({ model, messages, format, apiKey, stream: true });

      if ("stream" in streamed && streamed.stream) {
        res.setHeader("Content-Type", streamed.contentType || "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.status(200);
        res.flushHeaders?.();
        const reader = streamed.stream.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write?.(decoder.decode(value, { stream: true }));
        }
        res.end?.();
        return;
      }
      if ("body" in streamed) {
        res.status(streamed.status).json(streamed.body);
        return;
      }
    }

    let result: { status: number; body: Record<string, unknown> };
    if (provider === "openai") {
      const r = await callOpenAI({ model, messages, format, apiKey, maxTokens, stream: false });
      result = { status: r.status, body: (r as { body: Record<string, unknown> }).body };
    } else if (provider === "claude") {
      result = await callClaude({ model, messages, format, apiKey, maxTokens });
    } else if (provider === "gemini") {
      result = await callGemini({ model, messages, format, apiKey, maxTokens });
    } else {
      const r = await callOllama({ model, messages, format, apiKey, stream: false });
      result = { status: r.status, body: (r as { body: Record<string, unknown> }).body };
    }
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : "Error al contactar el proveedor IA",
    });
  }
}
