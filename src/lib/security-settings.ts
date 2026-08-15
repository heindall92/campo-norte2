/** Seguridad de sesión (idle timeout) — solo cliente. */

export const SECURITY_SETTINGS_KEY = "mps-security-settings-v1";
export const LAST_ACTIVITY_KEY = "mps-last-activity-v1";

export const IDLE_TIMEOUT_OPTIONS = [5, 15, 30, 60] as const;
export type IdleTimeoutMinutes = (typeof IDLE_TIMEOUT_OPTIONS)[number];

export interface SecuritySettings {
  /** Minutos sin actividad antes de cerrar sesión */
  idleTimeoutMinutes: IdleTimeoutMinutes;
}

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  idleTimeoutMinutes: 15,
};

function isIdleOption(n: unknown): n is IdleTimeoutMinutes {
  return typeof n === "number" && (IDLE_TIMEOUT_OPTIONS as readonly number[]).includes(n);
}

export function loadSecuritySettings(): SecuritySettings {
  try {
    const raw = localStorage.getItem(SECURITY_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SECURITY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<SecuritySettings>;
    return {
      idleTimeoutMinutes: isIdleOption(parsed.idleTimeoutMinutes)
        ? parsed.idleTimeoutMinutes
        : DEFAULT_SECURITY_SETTINGS.idleTimeoutMinutes,
    };
  } catch {
    return { ...DEFAULT_SECURITY_SETTINGS };
  }
}

export function saveSecuritySettings(next: SecuritySettings): void {
  localStorage.setItem(SECURITY_SETTINGS_KEY, JSON.stringify(next));
}

export function touchLastActivity(at = Date.now()): void {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
}

export function readLastActivity(): number | null {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function clearLastActivity(): void {
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function isIdleExpired(now = Date.now()): boolean {
  const last = readLastActivity();
  if (last == null) return false;
  const { idleTimeoutMinutes } = loadSecuritySettings();
  return now - last > idleTimeoutMinutes * 60_000;
}
