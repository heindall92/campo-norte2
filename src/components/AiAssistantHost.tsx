"use client";

import { BookOpen, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AiContextDrawer } from "@/components/AiContextDrawer";
import { DraggableAiFab } from "@/components/DraggableAiFab";
import {
  EXPEDITIONS,
  KNOWLEDGE_ANSWERS,
} from "@/lib/demo-data";
import {
  askKnowledgeStream,
  loadAiSettings,
  loadKnowledgeDocs,
  type KnowledgeAskResult,
} from "@/lib/ai";
import {
  consumePendingAsk,
  onAskRequested,
  onAssistantOpen,
  openAssistant,
} from "@/lib/ai/ask-bus";
import { estimateTokens, recordAiUsage } from "@/lib/ai/token-budget";
import { upsertAiThread } from "@/lib/ai/threads";
import { useDataHub } from "@/lib/data";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = { lang: Lang };

/**
 * Host global del asistente: drawer lateral + FAB arrastrable + streaming.
 * Escucha ask-bus; no obliga a navegar a Conocimiento.
 */
export function AiAssistantHost({ lang }: Props) {
  const hub = useDataHub();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [step, setStep] = useState(1);
  const [question, setQuestion] = useState("");
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<KnowledgeAskResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef<(q: string) => void>(() => {});

  async function runAsk(q: string) {
    const text = q.trim();
    if (!text) {
      setOpen(true);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setQuestion(text);
    setOpen(true);
    setAsking(true);
    setStep(1);
    setStreamText("");
    setResult(null);
    const t1 = window.setTimeout(() => setStep(2), 400);
    const t2 = window.setTimeout(() => setStep(3), 850);
    try {
      const docs = loadKnowledgeDocs();
      const res = await askKnowledgeStream(
        text,
        {
          docs,
          reservations: hub.reservations,
          invoices: hub.invoices,
          clients: hub.clients,
          expeditions: EXPEDITIONS,
          faq: KNOWLEDGE_ANSWERS,
        },
        (chunk) => setStreamText((prev) => prev + chunk),
        ac.signal,
      );
      setResult(res);
      setStreamText(res.answer);
      const settings = loadAiSettings();
      recordAiUsage({ prompt: text, reply: res.answer });
      upsertAiThread({
        question: text,
        answer: res.answer,
        tokensOut: estimateTokens(res.answer),
        tokensMax: settings.maxOutputTokens,
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setResult({
        answer: err instanceof Error ? err.message : String(err),
        sources: [],
        chunksUsed: [],
        engine: "retrieval",
        why: [lang === "es" ? "Error al consultar" : "Query error"],
      });
    } finally {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setAsking(false);
    }
  }

  runRef.current = runAsk;

  useEffect(() => {
    const queued = consumePendingAsk();
    if (queued) void runRef.current(queued);
    const offAsk = onAskRequested((q) => {
      consumePendingAsk();
      void runRef.current(q);
    });
    const offOpen = onAssistantOpen(() => {
      setOpen(true);
      setAsking(false);
    });
    return () => {
      offAsk();
      offOpen();
      abortRef.current?.abort();
    };
  }, []);

  const display = streamText || result?.answer || "";

  return (
    <>
      <DraggableAiFab
        ariaLabel={lang === "es" ? "Abrir asistente" : "Open assistant"}
        onClick={() => openAssistant()}
      />

      <AiContextDrawer
        lang={lang}
        open={open}
        thinking={asking}
        step={step}
        title={lang === "es" ? "Asistente Campo Norte" : "Campo Norte assistant"}
        subtitle={
          asking
            ? undefined
            : question
              ? question.slice(0, 72)
              : lang === "es"
                ? "Pregunta desde cualquier fila · solo equipo"
                : "Ask from any row · team only"
        }
        onClose={() => {
          abortRef.current?.abort();
          setOpen(false);
        }}
      >
        {!question && !asking && !result ? (
          <div className="space-y-3 text-sm">
            <p style={{ color: "var(--text-secondary)" }}>
              {lang === "es"
                ? "Pulsa «Preguntar» en una fila o escribe desde Conocimiento. Nada se envía al viajero."
                : "Hit Ask on a row or type in Knowledge. Nothing is sent to the traveller."}
            </p>
            <div className="flex flex-wrap gap-2">
              {(lang === "es"
                ? [
                    "¿Qué leads se enfrían esta semana?",
                    "¿Qué facturas llevan +30 días?",
                    "¿Qué reservas salen con saldo?",
                  ]
                : [
                    "Which leads cool this week?",
                    "Which invoices are 30+ days?",
                    "Which trips leave with balance due?",
                  ]
              ).map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="mps-choice rounded-full px-3 py-1 text-xs font-semibold"
                  onClick={() => void runAsk(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : asking && !display ? (
          <ol className="space-y-3 text-sm">
            {(
              lang === "es"
                ? ["Buscando en docs + Hub", "Ordenando fragmentos", "Redactando (stream)"]
                : ["Searching docs + Hub", "Ranking chunks", "Drafting (stream)"]
            ).map((label, i) => (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2",
                  step > i
                    ? "border-[var(--accent)]"
                    : "border-[var(--border-subtle)]",
                )}
                style={{ color: step > i ? "var(--text-primary)" : "var(--text-tertiary)" }}
              >
                {step === i + 1 ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
                ) : (
                  <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                )}
                {label}
              </li>
            ))}
          </ol>
        ) : (
          <div className="space-y-3 text-sm">
            {question ? (
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                {question}
              </p>
            ) : null}
            <p className="whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {display}
              {asking ? <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-[var(--accent)] align-middle" /> : null}
            </p>
            {result?.why?.length ? (
              <ul className="space-y-1.5">
                {result.why.map((w) => (
                  <li key={w} className="flex gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    {w}
                  </li>
                ))}
              </ul>
            ) : null}
            {result?.sources?.length ? (
              <ul className="space-y-1">
                {result.sources.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    <BookOpen className="h-3.5 w-3.5 text-[var(--accent)]" />
                    {s}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </AiContextDrawer>
    </>
  );
}
