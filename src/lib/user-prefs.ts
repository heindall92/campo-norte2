/** Preferencias visuales por usuario (tema + acento). Aisladas por userId. */

import {
  DEFAULT_LEAD_PRIORITY_MODE,
  isLeadPriorityMode,
  type LeadPriorityMode,
} from "@/lib/ai/lead-priority";

export type UiTheme = "light" | "dark";

export type AccentId =
  | "electric"
  | "teal"
  | "green"
  | "amber"
  | "orange"
  | "rose"
  | "violet"
  | "cyan";

export type ProfileLayoutId = "settings" | "hub";

export type { LeadPriorityMode };

/**
 * Layout B (hub centrado) se conserva en código y en `profileLayout`,
 * pero está oculto en UI. Activar a `true` si se vuelve a pedir en móvil.
 */
export const PROFILE_LAYOUT_B_ENABLED = false;

export interface UserPrefs {
  theme: UiTheme;
  accent: AccentId;
  /** Vista del perfil móvil: lista Settings (A) o hub centrado (B). */
  profileLayout: ProfileLayoutId;
  /**
   * Cómo ordenar la cola de leads. Solo reordena; no reescribe el score.
   * Preferencia por usuario (mismo patrón que el timeout de inactividad).
   */
  leadPriorityMode: LeadPriorityMode;
}

const PREFS_PREFIX = "mps-user-prefs-v1:";

/** Azul eléctrico por defecto en modo claro (y base en oscuro). */
export const ACCENT_PALETTE: Record<
  AccentId,
  { label: string; light: string; dark: string; light2: string; dark2: string }
> = {
  electric: {
    label: "Azul eléctrico",
    light: "#2563eb",
    dark: "#3b82f6",
    light2: "#0ea5e9",
    dark2: "#38bdf8",
  },
  teal: {
    label: "Teal",
    light: "#0f766e",
    dark: "#2dd4bf",
    light2: "#0369a1",
    dark2: "#38bdf8",
  },
  green: {
    label: "Verde",
    light: "#15803d",
    dark: "#4ade80",
    light2: "#0d9488",
    dark2: "#2dd4bf",
  },
  amber: {
    label: "Ámbar",
    light: "#d97706",
    dark: "#fbbf24",
    light2: "#ea580c",
    dark2: "#fb923c",
  },
  orange: {
    label: "Naranja",
    light: "#ea580c",
    dark: "#fb923c",
    light2: "#dc2626",
    dark2: "#f87171",
  },
  rose: {
    label: "Rosa",
    light: "#e11d48",
    dark: "#fb7185",
    light2: "#db2777",
    dark2: "#f472b6",
  },
  violet: {
    label: "Violeta",
    light: "#7c3aed",
    dark: "#a78bfa",
    light2: "#6366f1",
    dark2: "#818cf8",
  },
  cyan: {
    label: "Cian",
    light: "#0891b2",
    dark: "#22d3ee",
    light2: "#0284c7",
    dark2: "#38bdf8",
  },
};

export const DEFAULT_USER_PREFS: UserPrefs = {
  theme: "light",
  accent: "amber",
  profileLayout: "settings",
  leadPriorityMode: DEFAULT_LEAD_PRIORITY_MODE,
};

function key(userId: string) {
  return `${PREFS_PREFIX}${userId}`;
}

export function loadUserPrefs(userId: string | undefined | null): UserPrefs {
  if (!userId) return { ...DEFAULT_USER_PREFS };
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return { ...DEFAULT_USER_PREFS };
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    const theme = parsed.theme === "dark" ? "dark" : "light";
    const accent =
      parsed.accent && parsed.accent in ACCENT_PALETTE
        ? parsed.accent
        : DEFAULT_USER_PREFS.accent;
    // Conservamos "hub" en storage por si se reactiva PROFILE_LAYOUT_B_ENABLED.
    const profileLayout: ProfileLayoutId =
      parsed.profileLayout === "hub" ? "hub" : "settings";
    const leadPriorityMode = isLeadPriorityMode(parsed.leadPriorityMode)
      ? parsed.leadPriorityMode
      : DEFAULT_USER_PREFS.leadPriorityMode;
    return { theme, accent, profileLayout, leadPriorityMode };
  } catch {
    return { ...DEFAULT_USER_PREFS };
  }
}

export function saveUserPrefs(userId: string, prefs: UserPrefs): void {
  localStorage.setItem(key(userId), JSON.stringify(prefs));
}

/** Aplica data-theme + --accent* en <html> según prefs del usuario. */
export function applyUserPrefsToDocument(prefs: UserPrefs): void {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  const pal = ACCENT_PALETTE[prefs.accent];
  const accent = prefs.theme === "light" ? pal.light : pal.dark;
  const accent2 = prefs.theme === "light" ? pal.light2 : pal.dark2;
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-2", accent2);
  root.style.setProperty("--chart", accent);
  root.style.setProperty("--chart-2", accent2);
}
