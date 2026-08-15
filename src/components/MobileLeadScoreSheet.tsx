"use client";

import { Badge } from "@/components/CrmChrome";
import { ORIGIN_LABEL, type Lead } from "@/lib/demo-data";
import { priorityFromScore, priorityLabel } from "@/lib/ai";
import type { Lang } from "@/lib/i18n";
import { X } from "lucide-react";

function scoreTone(score: number): "good" | "warn" | "bad" | "neutral" {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  if (score >= 40) return "neutral";
  return "bad";
}

export function MobileLeadScoreSheet({
  open,
  lead,
  lang,
  onClose,
}: {
  open: boolean;
  lead: Lead | null;
  lang: Lang;
  onClose: () => void;
}) {
  if (!open || !lead) return null;

  const priority = priorityFromScore(lead.score);
  const reasons =
    lead.scoreReasons?.length > 0
      ? lead.scoreReasons
      : [
          lang === "es"
            ? "Sin desglose aún. Pulsa «Clasificar con IA» en la ficha completa."
            : "No breakdown yet. Tap AI classify on the full record.",
        ];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-[color-mix(in_oklab,#0f172a_45%,transparent)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-score-sheet-title"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] border border-[var(--glass-border)] bg-[var(--glass-strong)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[color-mix(in_oklab,var(--ink)_18%,transparent)]" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              {lang === "es" ? "Puntuación explicada" : "Score explained"}
            </p>
            <h2
              id="lead-score-sheet-title"
              className="mt-0.5 truncate font-[family-name:var(--mps-display)] text-xl text-[var(--ink)]"
            >
              {lead.name}
            </h2>
            <p className="text-xs text-[var(--ink-muted)]">
              {lead.id} · {ORIGIN_LABEL[lead.origin]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-[var(--glass-border)] p-2 text-[var(--ink-muted)]"
            aria-label={lang === "es" ? "Cerrar" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-end gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              Score
            </p>
            <p className="font-[family-name:var(--mps-display)] text-4xl leading-none text-[var(--ink)]">
              {lead.score}
              <span className="text-lg text-[var(--ink-muted)]">/100</span>
            </p>
          </div>
          <Badge tone={scoreTone(lead.score)}>
            {priorityLabel(priority, lang === "en" ? "en" : "es")}
          </Badge>
        </div>

        <ol className="mt-4 space-y-2.5">
          {reasons.map((r, i) => (
            <li
              key={`${i}-${r}`}
              className="flex gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2.5 text-sm text-[var(--ink)]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-xs font-bold text-[var(--accent)]">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-snug">{r}</span>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-xs leading-relaxed text-[var(--ink-muted)]">
          {lang === "es"
            ? "La IA prioriza el tiempo comercial. Nada escribe al cliente."
            : "AI prioritizes sales time. Nothing writes to the customer."}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-2xl bg-[var(--accent)] py-3 text-sm font-bold text-white"
        >
          {lang === "es" ? "Entendido" : "Got it"}
        </button>
      </div>
    </div>
  );
}
