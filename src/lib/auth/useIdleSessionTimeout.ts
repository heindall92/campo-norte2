import { useEffect, useRef } from "react";
import {
  clearLastActivity,
  isIdleExpired,
  loadSecuritySettings,
  touchLastActivity,
} from "@/lib/security-settings";

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "pointerdown",
  "keydown",
  "scroll",
  "touchstart",
];

/**
 * Cierra sesión tras idleTimeoutMinutes sin actividad.
 * También al volver a la pestaña / remount si el tiempo ya expiró.
 */
export function useIdleSessionTimeout(active: boolean, signOut: () => Promise<void>): void {
  const signingOut = useRef(false);

  useEffect(() => {
    if (!active) {
      clearLastActivity();
      return;
    }

    signingOut.current = false;
    touchLastActivity();

    async function logoutIfIdle() {
      if (signingOut.current) return;
      if (!isIdleExpired()) return;
      signingOut.current = true;
      clearLastActivity();
      try {
        await signOut();
      } finally {
        signingOut.current = false;
      }
    }

    function onActivity() {
      if (document.visibilityState === "hidden") return;
      touchLastActivity();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void logoutIfIdle();
        if (!signingOut.current) touchLastActivity();
      }
    }

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    void logoutIfIdle();

    const tick = window.setInterval(() => {
      void logoutIfIdle();
    }, 15_000);

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(tick);
    };
  }, [active, signOut]);

  /** Si cambian los minutos en otra pestaña / Ajustes, revalidar pronto */
  useEffect(() => {
    if (!active) return;
    function onStorage(e: StorageEvent) {
      if (e.key === "mps-security-settings-v1" || e.key === "mps-last-activity-v1") {
        loadSecuritySettings();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [active]);
}
