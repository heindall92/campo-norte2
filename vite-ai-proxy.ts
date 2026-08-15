/**
 * Middleware Vite: POST /api/ai/chat → Ollama | OpenAI | Claude | Gemini
 * (en producción lo cubre api/ai/chat.ts de Vercel)
 */
import type { Plugin } from "vite";

type Msg = { role: string; content: string };

async function readJson(req: import("http").IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function splitSystem(messages: Msg[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const rest = messages.filter((m) => m.role !== "system");
  return { system, rest };
}

function envKey(provider: string): string {
  switch (provider) {
    case "ollama":
      return (process.env.OLLAMA_API_KEY || process.env.VITE_OLLAMA_API_KEY || "").trim();
    case "openai":
      return (process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "").trim();
    case "claude":
      return (process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || "").trim();
    case "gemini":
      return (
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.VITE_GEMINI_API_KEY ||
        ""
      ).trim();
    default:
      return "";
  }
}

async function dispatch(body: Record<string, unknown>) {
  const provider = String(body.provider || "ollama");
  const model = String(body.model || "");
  const messages = (Array.isArray(body.messages) ? body.messages : []) as Msg[];
  const format = body.format ?? null;
  // Dev proxy: env primero, luego body (demo local).
  const apiKey = (envKey(provider) || String(body.apiKey || "")).trim();

  if (!model || !messages.length) {
    return { status: 400, json: { error: "Faltan model o messages" } };
  }
  if (!apiKey) {
    return {
      status: 401,
      json: {
        error: `Falta API key para ${provider} (env del server o Ajustes en demo local)`,
      },
    };
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        ...(format ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return { status: res.status, json: { error: data.error?.message || "OpenAI error" } };
    }
    return {
      status: 200,
      json: {
        content: data.choices?.[0]?.message?.content ?? "",
        model: data.model ?? model,
        provider: "openai",
      },
    };
  }

  if (provider === "claude") {
    const { system, rest } = splitSystem(messages);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
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
      return { status: res.status, json: { error: data.error?.message || "Claude error" } };
    }
    const text = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("\n");
    return {
      status: 200,
      json: { content: text, model: data.model ?? model, provider: "claude" },
    };
  }

  if (provider === "gemini") {
    const { system, rest } = splitSystem(messages);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const payload: Record<string, unknown> = {
      contents: rest.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: 0.2,
        ...(format ? { responseMimeType: "application/json" } : {}),
      },
    };
    if (system) payload.systemInstruction = { parts: [{ text: system }] };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return { status: res.status, json: { error: data.error?.message || "Gemini error" } };
    }
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
    return { status: 200, json: { content: text, model, provider: "gemini" } };
  }

  // ollama cloud
  const res = await fetch("https://ollama.com/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      ...(format ? { format } : {}),
    }),
  });
  const data = (await res.json()) as {
    message?: { content?: string };
    response?: string;
    model?: string;
    error?: string;
  };
  if (!res.ok) {
    return {
      status: res.status,
      json: { error: data.error || JSON.stringify(data).slice(0, 400) },
    };
  }
  return {
    status: 200,
    json: {
      content: data.message?.content ?? data.response ?? "",
      model: data.model ?? model,
      provider: "ollama",
    },
  };
}

export function aiDevProxyPlugin(): Plugin {
  return {
    name: "mps-ai-dev-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/ai/chat") || req.method !== "POST") {
          next();
          return;
        }
        try {
          const body = await readJson(req);
          const result = await dispatch(body);
          res.statusCode = result.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result.json));
        } catch (err) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : "AI proxy error",
            }),
          );
        }
      });
    },
  };
}
