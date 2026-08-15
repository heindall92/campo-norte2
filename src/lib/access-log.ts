/**
 * Analítica propia de accesos (gratis, sin Vercel Analytics).
 * Envía eventos al servidor; la IP real la pone Vercel en el API.
 */

import type { AppUser } from "@/lib/auth/types";
import type { AppSection } from "@/lib/notifications";

export type AccessEvent = "login" | "view_proposal" | "view_product" | "session";

export interface AccessLogEntry {
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
  created_at: string;
  /** true si solo está en este dispositivo (API no disponible) */
  localOnly?: boolean;
}

const LOCAL_KEY = "mps-access-log-local-v1";
const MAX_LOCAL = 120;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dedupeKey(event: AccessEvent, userId: string, section?: string): string {
  return `mps-access-dedupe:${event}:${userId}:${section ?? ""}:${todayKey()}`;
}

function orgTag(email: string): string {
  const domain = (email.split("@")[1] ?? "").toLowerCase();
  if (domain === "example.com") return "Campo Norte";
  if (domain.includes("evolve")) return "Evolve";
  if (domain.includes("camponorte") || domain.includes("demo")) return "Heindall";
  if (!domain) return "Desconocido";
  return "Externo";
}

function readLocal(): AccessLogEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AccessLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(entries: AccessLogEntry[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL)));
  } catch {
    /* ignore quota */
  }
}

function pushLocal(entry: AccessLogEntry): void {
  const next = [{ ...entry, localOnly: true }, ...readLocal()].slice(0, MAX_LOCAL);
  writeLocal(next);
}

export function eventLabel(event: AccessEvent, lang: "es" | "en" = "es"): string {
  const es: Record<AccessEvent, string> = {
    login: "Login",
    session: "Sesión activa",
    view_proposal: "Vio la propuesta",
    view_product: "Entró al producto",
  };
  const en: Record<AccessEvent, string> = {
    login: "Login",
    session: "Active session",
    view_proposal: "Viewed proposal",
    view_product: "Opened product",
  };
  return (lang === "es" ? es : en)[event];
}

export function sectionToAccessEvent(section: AppSection): AccessEvent | null {
  if (section === "slides" || section === "propuesta") return "view_proposal";
  if (
    section === "dashboard" ||
    section === "hub" ||
    section === "stock" ||
    section === "huecos" ||
    section === "picking" ||
    section === "palets" ||
    section === "flota" ||
    section === "recepcion" ||
    section === "expedicion" ||
    section === "operarios" ||
    section === "costes" ||
    section === "leads" ||
    section === "clientes" ||
    section === "reservas" ||
    section === "facturas" ||
    section === "contenido" ||
    section === "conocimiento" ||
    section === "automatizaciones"
  ) {
    return "view_product";
  }
  return null;
}

/** Registra un acceso (dedupe 1/día por usuario+evento+sección). */
export async function trackAccess(
  event: AccessEvent,
  user: Pick<AppUser, "id" | "email" | "name" | "provider">,
  section?: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  const key = dedupeKey(event, user.id, section);
  try {
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* continue */
  }

  const payload = {
    event,
    email: user.email,
    name: user.name,
    userId: user.id,
    provider: user.provider,
    section: section ?? null,
  };

  const optimistic: AccessLogEntry = {
    event,
    email: user.email,
    name: user.name,
    user_id: user.id,
    provider: user.provider,
    section: section ?? null,
    ip: "pendiente…",
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 280) : "",
    org_tag: orgTag(user.email),
    created_at: new Date().toISOString(),
    localOnly: true,
  };

  try {
    const res = await fetch("/api/auth/access-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    });
    if (!res.ok) {
      pushLocal(optimistic);
      return;
    }
    const data = (await res.json()) as { entry?: AccessLogEntry };
    if (data.entry) {
      const merged = [{ ...data.entry, localOnly: false }, ...readLocal().filter((e) => e.id !== data.entry?.id)].slice(
        0,
        MAX_LOCAL,
      );
      writeLocal(merged);
    }
  } catch {
    pushLocal(optimistic);
  }
}

export async function fetchAccessLog(limit = 80): Promise<{
  configured: boolean;
  entries: AccessLogEntry[];
  error?: string;
}> {
  try {
    const res = await fetch(`/api/auth/access-log?limit=${limit}`, {
      method: "GET",
      credentials: "same-origin",
    });
    if (res.status === 503) {
      return { configured: false, entries: readLocal(), error: "Servidor sin SUPABASE_SERVICE_ROLE_KEY" };
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        configured: false,
        entries: readLocal(),
        error: body.error || `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { entries?: AccessLogEntry[]; configured?: boolean };
    const remote = Array.isArray(data.entries) ? data.entries : [];
    // Mezcla remota + local pendiente (sin duplicar por id)
    const ids = new Set(remote.map((e) => e.id).filter(Boolean));
    const localExtra = readLocal().filter((e) => !e.id || !ids.has(e.id));
    return {
      configured: true,
      entries: [...remote, ...localExtra].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    };
  } catch {
    return { configured: false, entries: readLocal(), error: "Sin conexión al API" };
  }
}

/** Formato corto de fecha/hora en zona local. */
export function formatAccessWhen(iso: string, lang: "es" | "en" = "es"): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}
