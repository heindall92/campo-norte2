import { Bot, Check, ChevronDown, ChevronRight, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import {
  APPROVAL_KIND_LABEL,
  approve,
  approvalsFromDrafts,
  loadApprovals,
  reject,
  saveApprovals,
  sortApprovals,
  summarizeApprovals,
  type ApprovalRequest,
  type ApprovalStatus,
} from "@/lib/approvals";
import type { ContentDraft } from "@/lib/demo-data";
import { formatRelative } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<ApprovalStatus, StatusTone> = {
  pendiente: "warning",
  aprobada: "positive",
  rechazada: "negative",
};

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

type Filter = "pendientes" | "ia" | "todas";

interface ApprovalsPanelProps {
  drafts?: ContentDraft[];
  /** Email del usuario: queda registrado en cada resolución. */
  currentUser: string;
  lang?: Lang;
  className?: string;
}

/**
 * Bandeja de Aprobaciones.
 *
 * La regla de oro del proyecto hecha interfaz: la IA propone en segundo plano,
 * nada sale sin que una persona lo apruebe, y el rechazo exige motivo.
 */
export function ApprovalsPanel({
  drafts = [],
  currentUser,
  lang = "es",
  className,
}: ApprovalsPanelProps) {
  const [items, setItems] = useState<ApprovalRequest[]>(() => loadApprovals());
  const [filter, setFilter] = useState<Filter>("pendientes");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");

  // Recoge borradores nuevos de la fábrica de contenido como propuestas.
  useEffect(() => {
    if (drafts.length === 0) return;
    setItems((prev) => {
      const fresh = approvalsFromDrafts(drafts, prev);
      if (fresh.length === 0) return prev;
      const next = [...prev, ...fresh];
      saveApprovals(next);
      return next;
    });
  }, [drafts]);

  function update(next: ApprovalRequest[]) {
    setItems(next);
    saveApprovals(next);
  }

  const summary = useMemo(() => summarizeApprovals(items), [items]);

  const visible = useMemo(() => {
    const sorted = sortApprovals(items);
    if (filter === "pendientes") return sorted.filter((i) => i.status === "pendiente");
    if (filter === "ia") return sorted.filter((i) => i.author === "ia" && i.status === "pendiente");
    return sorted;
  }, [items, filter]);

  function confirmReject(id: string) {
    const text = reasonText.trim();
    if (!text) return;
    update(reject(items, id, currentUser, text));
    setRejecting(null);
    setReasonText("");
  }

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "pendientes", label: "Pendientes", count: summary.pending },
    { id: "ia", label: "IA en segundo plano", count: summary.fromAi },
    { id: "todas", label: "Todas", count: items.length },
  ];

  return (
    <section className={cn("glass-panel rounded-2xl p-5", className)}>
      <header className="mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Aprobaciones
        </h2>
        <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          Todo lo que espera tu OK, en un solo sitio. Nada sale sin que lo apruebes.
        </p>
      </header>

      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={cn(
              "mps-choice rounded-lg px-3 py-1 text-sm transition",
              filter === tab.id && "is-active",
            )}
          >
            {tab.label}
            <span className="ml-1.5 tabular-nums opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--positive)" }}>
          {filter === "todas"
            ? "Todavía no hay propuestas. Cuando la IA genere contenido, aparecerá aquí."
            : "Nada pendiente de aprobar."}
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--table-row-border)" }}>
          {visible.map((it) => {
            const open = expanded === it.id;
            const AuthorIcon = it.author === "ia" ? Bot : UserRound;
            return (
              <li key={it.id} className="py-3">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 shrink-0 rounded-lg p-1.5"
                    style={{
                      color: it.author === "ia" ? "var(--info)" : "var(--text-secondary)",
                      background: it.author === "ia" ? "var(--info-soft)" : "var(--neutral-soft)",
                    }}
                    title={it.author === "ia" ? "Propuesto por la IA" : "Propuesto por el equipo"}
                  >
                    <AuthorIcon size={15} aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className="truncate text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {it.title}
                      </p>
                      <StatusBadge tone="neutral">{APPROVAL_KIND_LABEL[it.kind]}</StatusBadge>
                      <StatusBadge tone={STATUS_TONE[it.status]}>
                        {STATUS_LABEL[it.status]}
                      </StatusBadge>
                    </div>
                    <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {it.proposal}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {formatRelative(it.createdAt, lang)}
                      {it.resolvedBy ? ` · resuelto por ${it.resolvedBy}` : ""}
                    </p>
                    {it.status === "rechazada" && it.reason ? (
                      <p className="mt-1 text-xs" style={{ color: "var(--negative)" }}>
                        Motivo: {it.reason}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {it.payload ? (
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : it.id)}
                        className="mps-ai-inline"
                        aria-label={open ? "Ocultar el texto" : "Ver el texto exacto"}
                        title={open ? "Ocultar el texto" : "Ver el texto exacto"}
                      >
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    ) : null}
                    {it.status === "pendiente" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => update(approve(items, it.id, currentUser))}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
                          style={{ color: "var(--positive)", background: "var(--positive-soft)" }}
                        >
                          <Check size={12} aria-hidden />
                          Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejecting(it.id);
                            setReasonText("");
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
                          style={{ color: "var(--negative)", background: "var(--negative-soft)" }}
                        >
                          <X size={12} aria-hidden />
                          Rechazar
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* El texto literal que se publicaría. Aprobar a ciegas no es aprobar. */}
                {open && it.payload ? (
                  <pre
                    className="mt-2 max-h-64 overflow-auto rounded-xl p-3 text-xs whitespace-pre-wrap"
                    style={{
                      background: "var(--surface-sunken)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {it.payload}
                  </pre>
                ) : null}

                {rejecting === it.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      className="mps-field min-w-0 flex-1 rounded-lg px-3 py-1.5 text-sm"
                      placeholder="Motivo del rechazo (obligatorio)"
                      value={reasonText}
                      onChange={(e) => setReasonText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmReject(it.id);
                        if (e.key === "Escape") setRejecting(null);
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => confirmReject(it.id)}
                      disabled={!reasonText.trim()}
                      className="mps-choice rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(null)}
                      className="mps-choice rounded-lg px-3 py-1.5 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
