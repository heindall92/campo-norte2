/**
 * Proxy Vercel → Ollama Cloud (https://ollama.com/api/chat).
 * El API key viaja en Authorization desde el CRM (Ajustes) o OLLAMA_API_KEY en el entorno.
 *
 * Seguridad: mismo criterio que /api/ai/chat. Sin él, con OLLAMA_API_KEY
 * configurada este endpoint era una pasarela anónima contra la cuenta del
 * servidor. El guard va inline: son funciones ESM y un import relativo entre
 * carpetas de /api rompe la invocación en Vercel.
 */

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

export default async function handler(
  req: { method?: string; headers: ReqHeaders; body: unknown },
  res: {
    status: (code: number) => { json: (body: unknown) => void; end: (s?: string) => void };
    setHeader: (k: string, v: string) => void;
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

  const messages = (req.body as { messages?: { content?: string }[] } | null)?.messages;
  const list = Array.isArray(messages) ? messages : [];
  if (list.length > MAX_MESSAGES) {
    res.status(413).json({ error: `Demasiados mensajes (máx. ${MAX_MESSAGES})` });
    return;
  }
  if (list.reduce((n, m) => n + (m.content?.length ?? 0), 0) > MAX_CHARS) {
    res.status(413).json({ error: `Prompt demasiado largo (máx. ${MAX_CHARS} caracteres)` });
    return;
  }

  const authHeader = req.headers.authorization;
  const auth =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader
      : process.env.OLLAMA_API_KEY
        ? `Bearer ${process.env.OLLAMA_API_KEY}`
        : null;

  if (!auth) {
    res.status(401).json({
      error: "Falta Authorization Bearer o variable OLLAMA_API_KEY",
    });
    return;
  }

  try {
    const upstream = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify(req.body ?? {}),
    });
    const text = await upstream.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* keep text */
    }
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : "Error al contactar Ollama Cloud",
    });
  }
}
