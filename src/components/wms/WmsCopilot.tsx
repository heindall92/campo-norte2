import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  askWmsCopilot,
  COPILOT_PROMPTS,
  navigateWmsSection,
  requireConfirmation,
  type CopilotAnswer,
} from "@/lib/wms";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useWmsLive } from "./useWmsLive";

export function WmsCopilot({ lang, siteId }: { lang: Lang; siteId: string }) {
  const { snap } = useWmsLive();
  const [question, setQuestion] = useState<string>(COPILOT_PROMPTS[0]);
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function ask(q: string) {
    setQuestion(q);
    setAnswer(askWmsCopilot(snap, q, siteId));
    setConfirming(false);
    setFeedback(null);
  }

  function runAction() {
    if (!answer?.optionalAction) return;
    const gate = requireConfirmation(confirming);
    if (!gate.ok) {
      setConfirming(true);
      setFeedback(
        lang === "es"
          ? "Confirma: la IA no ejecuta sola. Pulsa otra vez para abrir la pantalla."
          : "Confirm: the copilot does not act alone. Press again to open the screen.",
      );
      return;
    }
    navigateWmsSection(answer.optionalAction.section, {
      waveId: answer.optionalAction.waveId,
      orderId: answer.optionalAction.orderId,
    });
    setFeedback(lang === "es" ? "Pantalla abierta. Tú confirmas el movimiento." : "Screen opened. You confirm the move.");
    setConfirming(false);
  }

  return (
    <Card
      title={lang === "es" ? "Copilot de planta" : "Floor copilot"}
      subtitle={lang === "es" ? "Sobre el snapshot · no es un chat genérico" : "Snapshot only · not a generic chat"}
    >
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
        <Sparkles className="h-3.5 w-3.5" />
        {lang === "es"
          ? "Finding · evidence · confidence · recommendation. Acciones críticas con confirmación."
          : "Finding · evidence · confidence · recommendation. Critical actions need confirmation."}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {COPILOT_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => ask(q)}
            className="min-h-11 rounded-full border border-[var(--glass-border)] px-3 py-1.5 text-left text-xs font-semibold text-[var(--ink)]"
          >
            {q}
          </button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="sr-only">{lang === "es" ? "Pregunta" : "Question"}</span>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask(question);
          }}
          className="w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          placeholder={lang === "es" ? "Pregunta operativa…" : "Operational question…"}
        />
      </label>
      <button
        type="button"
        className="mt-2 min-h-11 rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-white"
        onClick={() => ask(question)}
      >
        {lang === "es" ? "Preguntar al snapshot" : "Ask the snapshot"}
      </button>

      {!answer && (
        <p className="mt-3 text-sm text-[var(--ink-muted)]" role="status">
          {lang === "es"
            ? "Elige una pregunta. La respuesta cita códigos reales (olas, ASN, SKU)."
            : "Pick a question. The answer cites real codes (waves, ASN, SKU)."}
        </p>
      )}

      {answer && (
        <div className="mt-3 space-y-2 rounded-xl bg-[var(--field-bg)] px-3 py-3" aria-live="polite">
          <p className="text-sm font-semibold text-[var(--ink)]">{answer.finding}</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-[var(--ink-muted)]">
            {answer.evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="text-sm text-[var(--ink)]">{answer.recommendation}</p>
          <Badge tone={answer.confidence >= 0.8 ? "good" : answer.confidence >= 0.5 ? "warn" : "neutral"}>
            confidence {Math.round(answer.confidence * 100)}%
          </Badge>
          {answer.optionalAction && (
            <button
              type="button"
              className="mt-1 block min-h-11 text-xs font-semibold text-[var(--accent)]"
              onClick={runAction}
            >
              {confirming
                ? lang === "es"
                  ? "Confirmar y abrir"
                  : "Confirm and open"
                : lang === "es"
                  ? answer.optionalAction.labelEs
                  : answer.optionalAction.labelEn}
            </button>
          )}
          {feedback && (
            <p className="text-xs font-semibold text-[var(--warn-ink)]" role="status">
              {feedback}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
