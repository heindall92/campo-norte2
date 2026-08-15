"use client";

import { COMPANY, GOLDEN_RULE } from "@/lib/assumptions";
import type { Lang } from "@/lib/i18n";
import { BookOpen, CircleHelp, ExternalLink, X } from "lucide-react";

export function SupportModal({
  open,
  onClose,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
}) {
  if (!open) return null;

  const es = lang === "es";
  const bullets = es
    ? [
        ["Hub / Dashboard", "KPIs y datos vivos del equipo."],
        ["Leads · Clientes", "Clasificación humana + IA. Nada escribe al viajero."],
        ["WhatsApp", "Solo desde el número de negocio confirmado."],
        ["Roles", "Cada sesión ve solo las secciones de su rol."],
        ["Licencia", "Uso interno. Sin copia ni redistribución sin licencia."],
      ]
    : [
        ["Hub / Dashboard", "Live team KPIs and data."],
        ["Leads · Clients", "Human ranking + AI. Nothing writes to travellers."],
        ["WhatsApp", "Only from the confirmed business number."],
        ["Roles", "Each session only sees its allowed sections."],
        ["License", "Internal use. No copy or redistribution without a license."],
      ];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[color-mix(in_oklab,#020617_55%,transparent)] p-3 backdrop-blur-md sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-modal-title"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col rounded-[1.5rem] border border-[color-mix(in_oklab,var(--accent)_45%,var(--glass-border))] bg-[var(--glass-strong)] p-4 shadow-[0_0_40px_color-mix(in_oklab,var(--accent)_25%,transparent)] sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-[var(--accent)]">
              <CircleHelp className="h-5 w-5" />
            </span>
            <h2
              id="support-modal-title"
              className="text-lg font-bold text-[var(--ink)]"
            >
              {es ? "Soporte" : "Support"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--glass-border)] p-2 text-[var(--ink-muted)] hover:text-[var(--ink)]"
            aria-label={es ? "Cerrar" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-[13px] leading-snug text-[var(--ink-muted)] text-pretty">
          {es
            ? `${COMPANY.name} Growth OS es el CRM interno. La tecnología clasifica; nunca escribe al viajero. Licencia de uso interno para ${COMPANY.legal}. Incidencias: ${COMPANY.ceo} o Admin.`
            : `${COMPANY.name} Growth OS is the internal CRM. Tech ranks; never messages travellers. Internal license for ${COMPANY.legal}. Incidents: ${COMPANY.ceo} or Admin.`}
        </p>
        <p className="mt-2 text-[11px] italic leading-snug text-[var(--ink)] text-pretty">
          {GOLDEN_RULE}
        </p>

        <div className="mt-3 grid gap-1.5">
          <a
            href={COMPANY.website}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl border border-[color-mix(in_oklab,var(--accent)_40%,var(--glass-border))] px-3.5 py-2.5 text-sm font-semibold text-[var(--accent)]"
          >
            <span>{es ? "Web · Campo Norte" : "Website · Campo Norte"}</span>
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href="/legal#aviso"
            className="flex items-center justify-between rounded-xl border border-[color-mix(in_oklab,var(--accent)_40%,var(--glass-border))] px-3.5 py-2.5 text-sm font-semibold text-[var(--accent)]"
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {es ? "Licencia y aviso legal" : "License & legal notice"}
            </span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <ul className="mt-3 space-y-1.5 text-[13px] leading-snug text-[var(--ink)]">
          {bullets.map(([title, detail]) => (
            <li key={title} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>
                <strong>{title}:</strong>{" "}
                <span className="text-[var(--ink-muted)]">{detail}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 border-t border-[var(--glass-border)] pt-2.5 text-center text-[10px] text-[var(--ink-muted)]">
          {es
            ? "Campo Norte · Growth OS · Licencia interna · Documentación en línea"
            : "Campo Norte · Growth OS · Internal license · Online docs"}
        </p>
      </div>
    </div>
  );
}
