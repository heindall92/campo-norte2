/**
 * POST /api/auth/access-log — registra login o vista de producto.
 * GET  /api/auth/access-log — lista recientes para el equipo.
 *
 * Analítica propia (gratis): la IP sale de x-forwarded-for de Vercel,
 * nunca del body del cliente. Sustituye Vercel Analytics de pago para
 * saber si revisores demo entraron y vieron la propuesta.
 *
 * Persistencia: Supabase `mps_access_log` con SUPABASE_SERVICE_ROLE_KEY.
 * Si falta la key, responde 503 (el cliente puede cachear en local).
 */

type ReqHeaders = Record<string, string | string[] | undefined>;

type AccessEvent = "login" | "view_proposal" | "view_product" | "session";

interface AccessRow {
  id?: string;
  event: AccessEvent;
  email: string;
  name: string;
  user_id: string;
  provider: string;
  section: string | null;
  ip: string;
  user_agent: string;
  org_tag: string;
  created_at?: string;
}

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_POST = 30;
const RATE_MAX_GET = 40;
const HITS = new Map<string, number[]>();

const EVENTS = new Set<AccessEvent>(["login", "view_proposal", "view_product", "session"]);

function header(headers: ReqHeaders, name: string): string {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return typeof raw === "string" ? raw : "";
}

function clientIp(headers: ReqHeaders): string {
  const fwd = header(headers, "x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0]!.trim() : header(headers, "x-real-ip")) || "unknown";
  return ip.slice(0, 64);
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

function rateLimited(headers: ReqHeaders, max: number): boolean {
  const ip = clientIp(headers);
  const now = Date.now();
  const recent = (HITS.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  HITS.set(ip, recent);
  if (HITS.size > 5_000) {
    for (const [k, v] of HITS) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) HITS.delete(k);
    }
  }
  return recent.length > max;
}

function guard(headers: ReqHeaders, max: number): { ok: boolean; status: number; error?: string } {
  const candidate = header(headers, "origin") || originOf(header(headers, "referer"));
  if (!candidate) {
    return { ok: false, status: 403, error: "Origen no permitido." };
  }
  const allowed = allowedOrigins();
  if (allowed.length > 0 && !allowed.includes(candidate)) {
    return { ok: false, status: 403, error: "Origen no permitido." };
  }
  if (rateLimited(headers, max)) {
    return { ok: false, status: 429, error: "Demasiadas peticiones." };
  }
  return { ok: true, status: 200 };
}

function orgTag(email: string): string {
  const domain = (email.split("@")[1] ?? "").toLowerCase();
  if (domain === "example.com") return "Campo Norte";
  if (domain.includes("evolve")) return "Evolve";
  if (domain.includes("camponorte") || domain.includes("demo")) return "Heindall";
  if (!domain) return "Desconocido";
  return "Externo";
}

interface SupabaseEnv {
  url: string;
  key: string;
}

function supabaseEnv(): SupabaseEnv | null {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return { url, key };
}

async function sbFetch(env: SupabaseEnv, path: string, init: RequestInit = {}) {
  return fetch(`${env.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

function parseBody(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

function sanitizeEvent(body: Record<string, unknown>, headers: ReqHeaders): AccessRow | { error: string } {
  const event = String(body.event ?? "").trim() as AccessEvent;
  if (!EVENTS.has(event)) {
    return { error: "event inválido (login | view_proposal | view_product | session)" };
  }
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 160);
  if (!email || !email.includes("@")) {
    return { error: "email requerido" };
  }
  const name = String(body.name ?? email.split("@")[0] ?? "Usuario")
    .trim()
    .slice(0, 120);
  const user_id = String(body.userId ?? body.user_id ?? email)
    .trim()
    .slice(0, 120);
  const provider = String(body.provider ?? "unknown")
    .trim()
    .slice(0, 32);
  const sectionRaw = body.section == null ? null : String(body.section).trim().slice(0, 64);
  const ua = header(headers, "user-agent").slice(0, 280) || "unknown";

  return {
    event,
    email,
    name,
    user_id,
    provider,
    section: sectionRaw || null,
    ip: clientIp(headers),
    user_agent: ua,
    org_tag: orgTag(email),
  };
}

type Res = {
  status: (code: number) => { json: (body: unknown) => void; end: (s?: string) => void };
  setHeader: (k: string, v: string) => void;
};

export default async function handler(
  req: { method?: string; headers: ReqHeaders; body?: unknown; query?: Record<string, string | string[]> },
  res: Res,
) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const method = (req.method ?? "GET").toUpperCase();
  const g = guard(req.headers ?? {}, method === "GET" ? RATE_MAX_GET : RATE_MAX_POST);
  if (!g.ok) {
    if (g.status === 429) res.setHeader("Retry-After", "60");
    res.status(g.status).json({ error: g.error });
    return;
  }

  const env = supabaseEnv();
  if (!env) {
    res.status(503).json({
      error:
        "Bitácora no configurada: faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel.",
      configured: false,
    });
    return;
  }

  if (method === "POST") {
    const row = sanitizeEvent(parseBody(req.body), req.headers ?? {});
    if ("error" in row) {
      res.status(400).json({ error: row.error });
      return;
    }
    try {
      const insert = await sbFetch(env, "mps_access_log", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
      if (!insert.ok) {
        const text = await insert.text();
        res.status(502).json({ error: `No se pudo guardar: ${insert.status} ${text}` });
        return;
      }
      const saved = (await insert.json()) as AccessRow[];
      res.status(201).json({ ok: true, entry: saved[0] ?? row });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Error al guardar bitácora",
      });
    }
    return;
  }

  if (method === "GET") {
    const limitRaw = req.query?.limit;
    const limitStr = Array.isArray(limitRaw) ? limitRaw[0] : limitRaw;
    const limit = Math.min(200, Math.max(1, Number(limitStr) || 80));
    try {
      const path =
        `mps_access_log?select=id,event,email,name,user_id,provider,section,ip,user_agent,org_tag,created_at` +
        `&order=created_at.desc&limit=${limit}`;
      const list = await sbFetch(env, path);
      if (!list.ok) {
        const text = await list.text();
        res.status(502).json({ error: `No se pudo leer: ${list.status} ${text}` });
        return;
      }
      const entries = (await list.json()) as AccessRow[];
      res.status(200).json({ ok: true, configured: true, entries });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Error al leer bitácora",
      });
    }
    return;
  }

  res.status(405).json({ error: "Método no permitido. Usa GET o POST." });
}
