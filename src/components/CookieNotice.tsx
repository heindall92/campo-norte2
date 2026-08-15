import { useEffect, useState } from "react";

const KEY = "mps-cookie-notice-dismissed-v1";

/** Aviso mínimo: solo almacenamiento técnico necesario (sin tracking). */
export function CookieNotice({ lang = "es" }: { lang?: "es" | "en" }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 md:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] p-4 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--ink)]">
          {lang === "es"
            ? "Usamos solo almacenamiento técnico necesario (sesión y Data Hub). Sin cookies de tracking. "
            : "We only use necessary technical storage (session and Data Hub). No tracking cookies. "}
          <a href="/legal#cookies" className="font-semibold text-[var(--accent)] underline">
            {lang === "es" ? "Política de cookies" : "Cookie policy"}
          </a>
        </p>
        <button
          type="button"
          className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white"
          onClick={() => {
            localStorage.setItem(KEY, "1");
            setVisible(false);
          }}
        >
          {lang === "es" ? "Entendido" : "Got it"}
        </button>
      </div>
    </div>
  );
}
