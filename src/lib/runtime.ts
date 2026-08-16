/**
 * Flags de entorno para demo vs producción.
 *
 * Con Supabase configurado el login demo está cerrado.
 * Para reabrirlo hace falta `VITE_ALLOW_DEMO_AUTH=true` (no es el defecto).
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
 *  3. `VITE_ALLOW_DEMO_AUTH=true` → sí (solo si lo pides).
 *  4. Con Supabase configurado → nunca (producción real).
 *  5. Sin backend → sí, para tests / build sin .env.
 */
export function allowLocalDemoAuth(): boolean {
  if (import.meta.env.VITE_STRICT_AUTH === "true") return false;
  if (import.meta.env.VITE_ALLOW_DEMO_AUTH === "false") return false;
  if (import.meta.env.VITE_ALLOW_DEMO_AUTH === "true") return true;
  if (supabaseConfigured()) return false;
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

export type WmsMode = "demo" | "production";

/**
 * PRODUCTION si hay Supabase y no se forzó demo.
 * `VITE_WMS_MODE=demo` vuelve al snapshot. El login demo nunca escribe wms_*.
 */
export function wmsMode(): WmsMode {
  const forced = (import.meta.env.VITE_WMS_MODE as string | undefined)?.trim().toLowerCase();
  if (forced === "demo") return "demo";
  if (supabaseConfigured() && !forceLocalHub()) return "production";
  return "demo";
}

export function isWmsProduction(): boolean {
  return wmsMode() === "production";
}
