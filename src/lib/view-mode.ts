/** Preferencia de layout: móvil (shell app) vs escritorio (sidebar). */

export type ViewMode = "auto" | "mobile" | "desktop";

export const VIEW_MODE_KEY = "mps-view-mode-v1";
export const VIEW_MODE_EVENT = "mps-view-mode-changed";

export const MOBILE_MQ = "(max-width: 1023px)";

export function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    if (raw === "mobile" || raw === "desktop" || raw === "auto") return raw;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function saveViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(VIEW_MODE_EVENT));
  }
}

export function resolveIsMobile(mode: ViewMode = loadViewMode()): boolean {
  if (typeof window === "undefined") return false;
  if (mode === "mobile") return true;
  if (mode === "desktop") return false;
  return window.matchMedia(MOBILE_MQ).matches;
}
