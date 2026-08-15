/**
 * GET|POST /api/cron/rescore — el reloj del sistema.
 *
 * Repuntúa toda la cola con los datos de hoy: cruza cada lead con la cartera de
 * clientes, recalcula el score y enfría por tiempo el orden de llamada. Deja
 * constancia en `mps_run_log` y comprueba la salud del sistema (si la ingesta
 * lleva más de 26 h muda, lo dice en vez de callar).
 *
 * Agnóstico del reloj a propósito: lo puede disparar Vercel Cron, GitHub
 * Actions, pg_cron o un curl. Solo exige el secreto.
 *
 *   Authorization: Bearer <CRON_SECRET>     (lo que manda Vercel Cron)
 *   x-mps-key: <CRON_SECRET>                (para cualquier otro)
 */

import { timingSafeEqual } from "node:crypto";
import {
  decayedScore,
  scoreLeadHeuristic,
} from "../../src/lib/ai/lead-scoring-core.js";
import type { Client, Lead } from "../../src/lib/demo-data.js";

type ReqHeaders = Record<string, string | string[] | undefined>;

function header(headers: ReqHeaders, name: string): string {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return typeof raw === "string" ? raw : "";
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function authorized(headers: ReqHeaders): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const bearer = header(headers, "authorization").replace(/^Bearer\s+/i, "");
  if (bearer && safeEqual(bearer, secret)) return true;
  const key = header(headers, "x-mps-key");
  return Boolean(key) && safeEqual(key, secret);
}

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

async function loadAll<T>(env: SupabaseEnv, table: string): Promise<T[]> {
  const res = await sbFetch(env, `${table}?select=id,payload`);
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as { id: string; payload: T }[];
  return rows.map((r) => r.payload).filter(Boolean);
}

/** Última ingesta correcta: si hace más de 26 h que no entra nada, algo pasa. */
async function lastIngestAt(env: SupabaseEnv): Promise<string | null> {
  const res = await sbFetch(
    env,
    "mps_run_log?select=created_at&job=eq.leads.ingest&status=eq.ok&order=created_at.desc&limit=1",
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as { created_at: string }[];
  return rows[0]?.created_at ?? null;
}

async function logRun(
  env: SupabaseEnv,
  entry: { job: string; status: "ok" | "warn" | "error"; detail: unknown },
): Promise<void> {
  try {
    await sbFetch(env, "mps_run_log", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(entry),
    });
  } catch {
    // Nunca tumbar la ejecución por no poder escribir la bitácora.
  }
}

export default async function handler(
  req: { method?: string; headers: ReqHeaders },
  res: {
    status: (code: number) => { json: (body: unknown) => void; end: (s?: string) => void };
    setHeader: (k: string, v: string) => void;
  },
) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.CRON_SECRET) {
    res.status(503).json({ error: "Falta CRON_SECRET en las variables de entorno." });
    return;
  }
  if (!authorized(req.headers ?? {})) {
    res.status(401).json({ error: "Credencial inválida." });
    return;
  }

  const env = supabaseEnv();
  if (!env) {
    res.status(503).json({
      error: "Data Hub no configurado: faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    });
    return;
  }

  const startedAt = Date.now();

  try {
    const [leads, clients] = await Promise.all([
      loadAll<Lead>(env, "mps_leads"),
      loadAll<Client>(env, "mps_clients"),
    ]);

    const byEmail = new Map<string, Client>();
    for (const c of clients) {
      if (c?.email) byEmail.set(c.email.trim().toLowerCase(), c);
    }

    const now = new Date();
    const changed: { id: string; from: number; to: number }[] = [];
    const hot: { id: string; name: string; score: number; owner: string }[] = [];

    for (const lead of leads) {
      if (!lead?.id) continue;
      if (lead.status === "descartado" || lead.status === "reservado") continue;

      const linked = byEmail.get((lead.email ?? "").trim().toLowerCase()) ?? null;
      const result = scoreLeadHeuristic(lead, linked);

      if (result.score !== lead.score) {
        changed.push({ id: lead.id, from: lead.score, to: result.score });
        const updated: Lead = {
          ...lead,
          score: result.score,
          scoreReasons: result.reasons,
        };
        const write = await sbFetch(env, "mps_leads", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            id: lead.id,
            payload: updated,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!write.ok) throw new Error(`mps_leads write: ${write.status}`);
      }

      // El decaimiento no se guarda: ordena la cola sin falsear el score auditable.
      const decayed = decayedScore({ ...lead, score: result.score }, now);
      if (decayed.effective >= 70 && lead.status !== "en_contacto") {
        hot.push({
          id: lead.id,
          name: lead.name,
          score: decayed.effective,
          owner: lead.owner,
        });
      }
    }

    const lastIngest = await lastIngestAt(env);
    const staleHours = lastIngest
      ? (Date.now() - new Date(lastIngest).getTime()) / 3_600_000
      : null;
    const stale = staleHours !== null && staleHours > 26;

    const summary = {
      leads: leads.length,
      rescored: changed.length,
      hot: hot.length,
      hotLeads: hot.slice(0, 10),
      lastIngestAt: lastIngest,
      health: stale ? "sin-ingesta-24h" : lastIngest ? "ok" : "sin-ingesta-todavia",
      ms: Date.now() - startedAt,
    };

    await logRun(env, {
      job: "cron.rescore",
      status: stale ? "warn" : "ok",
      detail: summary,
    });

    res.status(200).json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRun(env, { job: "cron.rescore", status: "error", detail: { message } });
    res.status(500).json({ error: "Fallo al repuntuar la cola.", detail: message });
  }
}
