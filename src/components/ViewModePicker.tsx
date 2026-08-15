import { cn } from "@/lib/utils";
import {
  loadViewMode,
  saveViewMode,
  type ViewMode,
} from "@/lib/view-mode";
import { Laptop, Smartphone, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const OPTIONS: {
  id: ViewMode;
  labelEs: string;
  labelEn: string;
  hintEs: string;
  hintEn: string;
  icon: typeof Smartphone;
}[] = [
  {
    id: "mobile",
    labelEs: "Móvil",
    labelEn: "Mobile",
    hintEs: "App Android/iOS · barra inferior",
    hintEn: "Android/iOS app · bottom nav",
    icon: Smartphone,
  },
  {
    id: "desktop",
    labelEs: "Ordenador",
    labelEn: "Desktop",
    hintEs: "Sidebar completa del CRM",
    hintEn: "Full CRM sidebar",
    icon: Laptop,
  },
  {
    id: "auto",
    labelEs: "Auto",
    labelEn: "Auto",
    hintEs: "Según el tamaño de pantalla",
    hintEn: "Based on screen size",
    icon: Sparkles,
  },
];

export function ViewModePicker({
  lang = "es",
  variant = "login",
}: {
  lang?: "es" | "en";
  variant?: "login" | "inline";
}) {
  const [mode, setMode] = useState<ViewMode>(() => loadViewMode());
  const es = lang === "es";

  useEffect(() => {
    setMode(loadViewMode());
  }, []);

  function pick(next: ViewMode) {
    setMode(next);
    saveViewMode(next);
    // Forzar overlay de bienvenida móvil la próxima vez que entre en shell móvil
    if (next === "mobile") {
      try {
        sessionStorage.removeItem("mps-mobile-view-notice-v1");
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div
      className={cn(
        variant === "login"
          ? "mt-4 rounded-[1.25rem] border border-white/25 bg-[color-mix(in_oklab,white_82%,transparent)] p-3 shadow-lg backdrop-blur-xl"
          : "rounded-[1.25rem] border border-[var(--field-border)] bg-[var(--field-bg)] p-3",
      )}
    >
      <p
        className={cn(
          "mb-2 text-center text-[11px] font-bold uppercase tracking-wide",
          variant === "login" ? "text-[var(--ink-muted)]" : "text-[var(--ink-muted)]",
        )}
      >
        {es ? "Modo de vista del CRM" : "CRM view mode"}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => pick(opt.id)}
              className={cn(
                "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition",
                active
                  ? "border-transparent bg-[var(--accent)] text-white shadow-md"
                  : variant === "login"
                    ? "border-slate-200/80 bg-white text-slate-900 hover:border-slate-300"
                    : "border-[var(--glass-border)] bg-[var(--glass-strong)] text-[var(--ink)] hover:border-[color-mix(in_oklab,var(--accent)_50%,var(--glass-border))]",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  !active && variant === "login" && "text-slate-800",
                  !active && variant !== "login" && "text-[var(--ink)]",
                )}
                strokeWidth={active ? 2.4 : 2}
              />
              <span className="text-[11px] font-bold leading-tight">
                {es ? opt.labelEs : opt.labelEn}
              </span>
              <span
                className={cn(
                  "text-[9px] leading-tight",
                  active
                    ? "text-white/90"
                    : variant === "login"
                      ? "text-slate-600"
                      : "text-[color-mix(in_oklab,var(--ink)_78%,transparent)]",
                )}
              >
                {es ? opt.hintEs : opt.hintEn}
              </span>
            </button>
          );
        })}
      </div>
      <p
        className={cn(
          "mt-2 text-center text-[10px] text-pretty",
          variant === "login"
            ? "text-slate-600"
            : "text-[color-mix(in_oklab,var(--ink)_70%,transparent)]",
        )}
      >
        {es
          ? "Si en el móvil no ves la app, elige Móvil y vuelve a entrar."
          : "If the phone still shows desktop, pick Mobile and sign in again."}
      </p>
    </div>
  );
}
