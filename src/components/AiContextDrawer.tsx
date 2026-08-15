import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface AiContextDrawerProps {
  lang?: Lang;
  open: boolean;
  title?: string;
  subtitle?: string;
  thinking?: boolean;
  step?: number;
  children?: React.ReactNode;
  onClose: () => void;
}

/**
 * Panel lateral de IA contextual — glow + pasos «Trabajando…».
 * Anatomía de la demo; tokens/estética camponorte.
 */
export function AiContextDrawer({
  lang = "es",
  open,
  title,
  subtitle,
  thinking,
  step = 1,
  children,
  onClose,
}: AiContextDrawerProps) {
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) setVisible(true);
    else {
      const id = window.setTimeout(() => setVisible(false), 220);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_oklab,#0f172a_45%,transparent)]"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <aside
        className={cn(
          "relative flex h-full w-full max-w-md flex-col border-l shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{
          background: "var(--surface-elevated)",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
        }}
      >
        <header className="flex items-start justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-start gap-3">
            <span className="mps-ai-fab is-alive !h-10 !w-10 shrink-0">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">
                {title ?? (lang === "es" ? "Asistente Campo Norte" : "Campo Norte assistant")}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {thinking
                  ? lang === "es"
                    ? `Trabajando… paso ${step}`
                    : `Working… step ${step}`
                  : subtitle ??
                    (lang === "es"
                      ? "Contexto cargado · solo equipo"
                      : "Context loaded · team only")}
              </p>
            </div>
          </div>
          <button type="button" className="rounded-full p-2" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        <footer className="border-t px-4 py-2 text-[11px]" style={{ borderColor: "var(--border-subtle)", color: "var(--text-tertiary)" }}>
          {lang === "es"
            ? "El asistente puede equivocarse. Revisa la información importante. Nada escribe al viajero."
            : "The assistant can be wrong. Review important info. Nothing messages the traveller."}
        </footer>
      </aside>
    </div>
  );
}
