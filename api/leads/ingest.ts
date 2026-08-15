/**
 * POST /api/leads/ingest — puerta de entrada de leads.
 *
 * Un formulario (el de la propia app en /captura, o cualquier plataforma
 * externa) envía JSON aquí. La función valida, deduplica por email, cruza con
 * la cartera de clientes, puntúa con el MISMO motor que la interfaz y guarda en
 * Supabase. Nada sale hacia el viajero: solo se crea la ficha y se ordena la cola.
 *
 * Autenticación, dos caminos:
 *   1. Integraciones externas (el formulario de example.com, n8n, Make):
 *        x-mps-key: <LEADS_INGEST_SECRET>                     — clave compartida
 *        x-mps-signature: sha256=<hex hmac del cuerpo crudo>  — firma, preferible
 *   2. El formulario público de esta misma app (/captura): se acepta por origen.
 *      La clave no puede viajar en el navegador — publicarla sería regalarla —
 *      así que ahí la defensa es origen permitido + validación + límite de tasa,
 *      que es lo que protege a cualquier formulario público.
 *
 * El scoring se importa de `src/lib/ai/lead-scoring-core.js`: una sola fuente de
 * verdad. Si aquí y en pantalla salieran números distintos, el CRM no valdría nada.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { scoreLeadHeuristic } from "../../src/lib/ai/lead-scoring-core.js";
import {
  leadFromPayload,
  mergeLead,
  pickOwner,
  validateLeadPayload,
} from "../../src/lib/leads/ingest-core.js";
import type { Client, Lead } from "../../src/lib/demo-data.js";

type ReqHeaders = Record<string, string | string[] | undefined>;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.INGEST_RATE_LIMIT ?? 12);
const HITS = new Map<string, number[]>();

function header(headers: ReqHeaders, name: string): string {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return typeof raw === "string" ? raw : "";
}

/** Comparación en tiempo constante: un `===` filtra la clave carácter a carácter. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/** Orígenes de la propia app: los despliegues de Vercel y el dev local. */
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

function sameOriginForm(headers: ReqHeaders): boolean {
  const candidate = header(headers, "origin") || originOf(header(headers, "referer"));
  if (!candidate) return false;
  const allowed = allowedOrigins();
  return allowed.includes(candidate);
}

function authorized(headers: ReqHeaders, rawBody: string): boolean {
  const secret = process.env.LEADS_INGEST_SECRET ?? "";

  const signature = header(headers, "x-mps-signature");
  if (signature && secret) {
    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    return safeEqual(signature, expected);
  }

  const key = header(headers, "x-mps-key");
  if (key && secret) return safeEqual(key, secret);

  return sameOriginForm(headers);
}

/**
 * Límite por IP, best-effort: la memoria no se comparte entre instancias de
 * Vercel, así que frena un script pesado pero no un ataque distribuido. Para
 * eso haría falta almacenamiento compartido; queda dicho, no simulado.
 */
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

/* ------------------------------------------------------------------ *
 * Supabase por REST — sin dependencias: `fetch` y credenciales de servidor.
 * ------------------------------------------------------------------ */

interface SupabaseEnv {
  url: string;
  key: string;
}

function supabaseEnv(): SupabaseEnv | null {
  const url = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
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

/** Reintenta lo que puede fallar por red antes de dar el lead por perdido. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 250 * 2 ** i));
      }
    }
  }
  throw lastError;
}

async function findByEmail<T>(
  env: SupabaseEnv,
  table: string,
  email: string,
): Promise<T | null> {
  const query = `${table}?select=id,payload&payload->>email=eq.${encodeURIComponent(email)}&limit=1`;
  const res = await sbFetch(env, query);
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as { id: string; payload: T }[];
  return rows[0]?.payload ?? null;
}

async function upsertLead(env: SupabaseEnv, lead: Lead): Promise<void> {
  const res = await sbFetch(env, "mps_leads", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: lead.id,
      payload: lead,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`mps_leads: ${res.status} ${await res.text()}`);
}

/** Bitácora de ejecuciones: la prueba de vida del sistema, no un contador inventado. */
async function logRun(
  env: SupabaseEnv,
  entry: { job: string; status: "ok" | "warn" | "error"; detail: unknown },
): Promise<void> {
  try {
    await sbFetch(env, "mps_run_log", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        job: entry.job,
        status: entry.status,
        detail: entry.detail,
      }),
    });
  } catch {
    // La bitácora nunca puede tumbar la ingesta.
  }
}

export default async function handler(
  req: { method?: string; headers: ReqHeaders; body?: unknown },
  res: {
    status: (code: number) => { json: (body: unknown) => void; end: (s?: string) => void };
    setHeader: (k: string, v: string) => void;
  },
) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-mps-key, x-mps-signature");
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido. Usa POST." });
    return;
  }

  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});

  if (!authorized(req.headers ?? {}, rawBody)) {
    res.status(401).json({
      error:
        "Credencial inválida. Usa x-mps-key o x-mps-signature, o envía desde el formulario de la app.",
    });
    return;
  }
  if (rateLimited(req.headers ?? {})) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Demasiadas peticiones. Espera un minuto." });
    return;
  }

  const env = supabaseEnv();
  if (!env) {
    res.status(503).json({
      error:
        "Data Hub no configurado: faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.",
    });
    return;
  }

  const parsed = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const validation = validateLeadPayload(parsed);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error, field: validation.field });
    return;
  }
  const payload = validation.value;

  try {
    const [existing, client] = await Promise.all([
      withRetry(() => findByEmail<Lead>(env, "mps_leads", payload.email)),
      withRetry(() => findByEmail<Client>(env, "mps_clients", payload.email)),
    ]);

    const now = new Date();
    const base = existing ? mergeLead(existing, payload, now) : leadFromPayload(payload, now);

    // El cruce con la cartera es lo que separa a un repetidor de un desconocido.
    const scored = scoreLeadHeuristic(base, client);
    const lead: Lead = {
      ...base,
      score: scored.score,
      scoreReasons: scored.reasons,
      owner: base.owner === "Sin asignar" ? pickOwner(base.origin, scored.score) : base.owner,
    };

    await withRetry(() => upsertLead(env, lead));

    await logRun(env, {
      job: "leads.ingest",
      status: "ok",
      detail: {
        leadId: lead.id,
        merged: Boolean(existing),
        origin: lead.origin,
        score: lead.score,
        knownClient: Boolean(client),
      },
    });

    res.status(existing ? 200 : 201).json({
      ok: true,
      merged: Boolean(existing),
      lead: {
        id: lead.id,
        name: lead.name,
        origin: lead.origin,
        campaign: lead.campaign,
        interestRoute: lead.interestRoute,
        score: lead.score,
        priority: scored.priority,
        reasons: lead.scoreReasons,
        owner: lead.owner,
        knownClient: Boolean(client),
      },
      note: "Ficha creada y priorizada. No se ha enviado ningún mensaje al viajero.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRun(env, { job: "leads.ingest", status: "error", detail: { message } });
    // 503 + Retry-After: quien envía puede reintentar y el lead no se pierde.
    res.setHeader("Retry-After", "30");
    res.status(503).json({
      error: "No se pudo guardar el lead. Reintenta en unos segundos.",
      detail: message,
    });
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
