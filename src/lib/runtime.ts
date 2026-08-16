/**
 * Flags de entorno para demo vs producción.
 *
 * Demo (defecto): semilla local, login embebido, sin infraestructura.
 * Producción: Supabase Auth + Postgres. Se activa con
 * VITE_RUNTIME_MODE=production, VITE_STRICT_AUTH=true o
 * VITE_ALLOW_DEMO_AUTH=false (y backend configurado).
 *
 * Las cuentas sofia@ / norte2026 NUNCA son credenciales de producción.
 */

export type RuntimeMode = "demo" | "production";

export function resolveRuntimeMode(input: {
  explicit?: string | undefined;
  strictAuth: boolean;
  allowDemoAuth: boolean;
  supabaseConfigured: boolean;
}): RuntimeMode {
  if (input.explicit === "production") return "production";
  if (input.explicit === "demo") return "demo";
  if (input.strictAuth) return "production";
  if (!input.allowDemoAuth && input.supabaseConfigured) return "production";
  return "demo";
}

export function runtimeMode(): RuntimeMode {
  return resolveRuntimeMode({
    explicit: import.meta.env.VITE_RUNTIME_MODE as string | undefined,
    strictAuth: import.meta.env.VITE_STRICT_AUTH === "true",
    allowDemoAuth: import.meta.env.VITE_ALLOW_DEMO_AUTH !== "false",
    supabaseConfigured: supabaseConfigured(),
  });
}

export function isDemoMode(): boolean {
  return runtimeMode() === "demo";
}

export function wmsUsesSeedSnapshot(): boolean {
  return isDemoMode() || forceLocalHub();
}

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
  if (import.meta.env.VITE_RUNTIME_MODE === "production") return false;
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
