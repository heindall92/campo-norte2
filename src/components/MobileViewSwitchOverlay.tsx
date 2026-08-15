import type { Lang } from "@/lib/i18n";
import { Check, Laptop, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

export const MOBILE_VIEW_NOTICE_KEY = "mps-mobile-view-notice-v1";

export function MobileViewSwitchOverlay({
  lang,
  open,
  onDone,
}: {
  lang: Lang;
  open: boolean;
  onDone: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProgress(0);
    setDone(false);

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setProgress(100);
      setDone(true);
      return;
    }

    const duration = 1400;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.round(eased * 100));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  const es = lang === "es";

  function finish() {
    try {
      sessionStorage.setItem(MOBILE_VIEW_NOTICE_KEY, "1");
    } catch {
      /* ignore */
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[color-mix(in_oklab,#0f172a_45%,transparent)] p-4 backdrop-blur-md sm:items-center">
      <div className="w-full max-w-sm rounded-[1.75rem] bg-[var(--glass-strong)] p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-center gap-2 text-[var(--ink)] sm:gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <span className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-[1.25rem] border border-[var(--glass-border)] bg-[var(--field-bg)] text-[var(--accent)] shadow-sm">
              <Smartphone className="h-10 w-10" strokeWidth={1.75} />
            </span>
            <span className="text-[11px] font-semibold text-[var(--ink)]">
              {es ? "Móvil" : "Mobile"}
            </span>
          </div>
          <div className="flex min-w-[3.5rem] flex-1 flex-col items-center gap-1.5 px-1 pt-1">
            <div className="h-px w-full border-t-2 border-dashed border-[color-mix(in_oklab,var(--ink)_22%,transparent)]" />
            <span className="rounded-full bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
              {done ? (es ? "Listo" : "Ready") : `${progress}%`}
            </span>
            <div className="h-px w-full border-t-2 border-dashed border-[color-mix(in_oklab,var(--ink)_22%,transparent)]" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-[1.25rem] border border-[var(--glass-border)] bg-[var(--field-bg)] text-[var(--ink-muted)] shadow-sm">
              <Laptop className="h-10 w-10" strokeWidth={1.75} />
            </span>
            <span className="text-[11px] font-semibold text-[var(--ink-muted)]">
              {es ? "Escritorio" : "Desktop"}
            </span>
          </div>
        </div>

        <h2 className="text-center font-[family-name:var(--mps-display)] text-xl text-[var(--ink)]">
          {done
            ? es
              ? "Vista móvil activa"
              : "Mobile view on"
            : es
              ? "Activando vista móvil"
              : "Switching to mobile view"}
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-[var(--ink-muted)] text-pretty">
          {es
            ? "La navegación en el móvil no es igual que en el ordenador: atajos y barra inferior."
            : "Mobile navigation differs from desktop: shortcuts and a bottom bar."}
        </p>

        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--ink)_10%,transparent)]">
            <div
              className="h-full rounded-full transition-[width] duration-75"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
              }}
            />
          </div>
          <p className="mt-2 text-center text-xs font-semibold text-[var(--ink-muted)]">
            {es
              ? `Progreso de adaptación · ${progress}%`
              : `Adaptation progress · ${progress}%`}
          </p>
        </div>

        {done && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_oklab,#22c55e_18%,white)] text-[#15803d]">
              <Check className="h-7 w-7" strokeWidth={2.5} />
            </span>
            <button
              type="button"
              onClick={finish}
              className="w-full rounded-2xl bg-[var(--accent)] py-3.5 text-sm font-bold text-white"
            >
              {es ? "Entendido" : "Got it"}
            </button>
          </div>
        )}

        {!done && (
          <button
            type="button"
            onClick={finish}
            className="mt-4 w-full text-center text-xs font-semibold text-[var(--ink-muted)]"
          >
            {es ? "Saltar" : "Skip"}
          </button>
        )}
      </div>
    </div>
  );
}
