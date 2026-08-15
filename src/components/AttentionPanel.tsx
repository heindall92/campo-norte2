import { AlertTriangle, ArrowRight, FileText, Route, Sparkles, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import {
  buildAttentionQueue,
  summarizeAttention,
  type AttentionItem,
  type AttentionSeverity,
  type AttentionSource,
} from "@/lib/attention";
import type { Lead } from "@/lib/demo-data";
import { formatEur, formatRelative } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { Invoice, Reservation } from "@/lib/ops-data";
import { cn } from "@/lib/utils";

const SEVERITY_TONE: Record<AttentionSeverity, StatusTone> = {
  vencido: "negative",
  proximo: "warning",
  seguimiento: "info",
};

const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  vencido: "Vencido",
  proximo: "Próximo",
  seguimiento: "Seguimiento",
};

const SOURCE_ICON: Record<AttentionSource, typeof UserRound> = {
  lead: UserRound,
  reserva: Route,
  factura: FileText,
};

const SOURCE_LABEL: Record<AttentionSource, string> = {
  lead: "Leads",
  reserva: "Reservas",
  factura: "Facturas",
};

type Filter = "todos" | AttentionSource;

interface AttentionPanelProps {
  leads?: Lead[];
  reservations?: Reservation[];
  invoices?: Invoice[];
  avgTicket?: number;
  lang?: Lang;
  now?: Date;
  /** Navega a donde se resuelve el asunto. */
  onResolve?: (item: AttentionItem) => void;
  /** Abre el asistente con el contexto de esta fila ya cargado. */
  onAsk?: (item: AttentionItem) => void;
  className?: string;
}

/**
 * Cola de acción unificada.
 *
 * Anatomía (docs/GAP-DEMO-ANATOMIA.md): recuento agregado arriba · badge de
 * estado · motivo en lenguaje natural · impacto en € · ordenado por urgencia ·
 * IA por fila · y cada fila lleva a donde se resuelve.
 *
 * No escribe a nadie: solo señala. La regla de oro sigue intacta.
 */
export function AttentionPanel({
  leads,
  reservations,
  invoices,
  avgTicket,
  lang = "es",
  now,
  onResolve,
  onAsk,
  className,
}: AttentionPanelProps) {
  const [filter, setFilter] = useState<Filter>("todos");

  const all = useMemo(
    () => buildAttentionQueue({ leads, reservations, invoices, avgTicket, lang, now }),
    [leads, reservations, invoices, avgTicket, lang, now],
  );

  const visible = useMemo(
    () => (filter === "todos" ? all : all.filter((i) => i.source === filter)),
    [all, filter],
  );

  const summary = useMemo(() => summarizeAttention(visible), [visible]);

  if (all.length === 0) {
    return (
      <section className={cn("glass-panel rounded-2xl p-5", className)}>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Requiere tu atención
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--positive)" }}>
          Nada pendiente. Ningún lead se enfría, ninguna reserva sin saldo y ninguna factura
          vencida.
        </p>
      </section>
    );
  }

  const tabs: Filter[] = ["todos", "lead", "reserva", "factura"];

  return (
    <section className={cn("glass-panel rounded-2xl p-5", className)}>
      <header className="mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Requiere tu atención
        </h2>
        <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          Vencimientos y riesgos ordenados por urgencia.
        </p>

        {/* Recuento agregado: cuantifica el coste de no hacer nada. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge tone="neutral">
            {summary.total} {summary.total === 1 ? "asunto" : "asuntos"}
          </StatusBadge>
          {summary.overdue > 0 ? (
            <StatusBadge tone="negative">
              <AlertTriangle size={12} className="mr-1" aria-hidden />
              {summary.overdue} vencidos
            </StatusBadge>
          ) : null}
          {summary.amountAtStake > 0 ? (
            <StatusBadge tone="warning">
              {formatEur(summary.amountAtStake, lang)} en juego
            </StatusBadge>
          ) : null}
        </div>
      </header>

      {/* Filtros por fuente, con su recuento propio. */}
      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const count = tab === "todos" ? all.length : all.filter((i) => i.source === tab).length;
          if (count === 0 && tab !== "todos") return null;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={cn(
                "mps-choice rounded-lg px-3 py-1 text-sm transition",
                filter === tab && "is-active",
              )}
            >
              {tab === "todos" ? "Todos" : SOURCE_LABEL[tab]}
              <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <ul className="divide-y" style={{ borderColor: "var(--table-row-border)" }}>
        {visible.map((item) => {
          const Icon = SOURCE_ICON[item.source];
          return (
            <li
              key={item.id}
              className="flex items-start gap-3 py-3 transition"
              style={{ borderColor: "var(--table-row-border)" }}
            >
              <span
                className="mt-0.5 shrink-0 rounded-lg p-1.5"
                style={{
                  color: `var(--attention-${item.severity === "vencido" ? "overdue" : item.severity === "proximo" ? "soon" : "ok"})`,
                  background: "var(--neutral-soft)",
                }}
                aria-hidden
              >
                <Icon size={15} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.title}
                  </p>
                  <StatusBadge tone={SEVERITY_TONE[item.severity]}>
                    {SEVERITY_LABEL[item.severity]}
                  </StatusBadge>
                </div>
                {/* El "por qué", en lenguaje natural. Nunca un código de estado. */}
                <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {item.reason}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {formatRelative(item.dueAt, lang, now)}
                </p>
              </div>

              {item.amount != null ? (
                <span
                  className="shrink-0 text-sm font-semibold tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatEur(item.amount, lang)}
                </span>
              ) : null}

              <div className="flex shrink-0 items-center gap-1">
                {onAsk ? (
                  <button
                    type="button"
                    className="mps-ai-inline"
                    onClick={() => onAsk(item)}
                    aria-label={`Preguntar al asistente sobre ${item.title}`}
                    title={`Preguntar al asistente sobre ${item.title}`}
                  >
                    <Sparkles size={15} aria-hidden />
                  </button>
                ) : null}
                {onResolve ? (
                  <button
                    type="button"
                    onClick={() => onResolve(item)}
                    className="mps-choice inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
                  >
                    {item.actionLabel}
                    <ArrowRight size={12} aria-hidden />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
