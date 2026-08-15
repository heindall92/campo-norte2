/**
 * Flags de entorno para demo vs producción.
 *
 * Principio (pitch): las cuentas demo del equipo siguen disponibles aunque
 * haya Supabase. En producción real, cierra la puerta con
 * VITE_STRICT_AUTH=true o VITE_ALLOW_DEMO_AUTH=false.
 */

/** Build de producción (Vite). */
export function isProdBuild(): boolean {
  return import.meta.env.PROD === true;
}

/** ¿Hay backend real configurado? */
export function supabaseConfigured(): boolean {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  return Boolean(url && key);
}

/**
 * ¿Se pueden pegar API keys en Ajustes / localStorage?
 * Demo/local: sí. Producción: no, salvo VITE_ALLOW_CLIENT_AI_KEYS=true.
 */
export function allowClientAiKeys(): boolean {
  if (import.meta.env.VITE_ALLOW_CLIENT_AI_KEYS === "true") return true;
  if (import.meta.env.VITE_ALLOW_CLIENT_AI_KEYS === "false") return false;
  return !isProdBuild();
}

/**
 * ¿Login demo con usuarios embebidos (sofia@ / norte2026…)?
 *
 * Orden de decisión:
 *  1. `VITE_STRICT_AUTH=true`  → nunca.
 *  2. `VITE_ALLOW_DEMO_AUTH=false` → nunca.
 *  3. Resto → sí (también con Supabase: fallback a Hub local semilla).
 */
export function allowLocalDemoAuth(): boolean {
  if (import.meta.env.VITE_STRICT_AUTH === "true") return false;
  if (import.meta.env.VITE_ALLOW_DEMO_AUTH === "false") return false;
  return true;
}

/** ¿El despliegue actual es una demo pública sin backend? */
export function isPublicDemo(): boolean {
  return isProdBuild() && !supabaseConfigured();
}

/** Fuerza Data Hub local tras login demo (aunque haya Supabase). */
export const FORCE_LOCAL_HUB_KEY = "mps-force-local-hub-v1";

export function forceLocalHub(): boolean {
  try {
    return localStorage.getItem(FORCE_LOCAL_HUB_KEY) === "1";
  } catch {
    return false;
  }
}

export function setForceLocalHub(on: boolean): void {
  try {
    if (on) localStorage.setItem(FORCE_LOCAL_HUB_KEY, "1");
    else localStorage.removeItem(FORCE_LOCAL_HUB_KEY);
  } catch {
    /* ignore */
  }
}
