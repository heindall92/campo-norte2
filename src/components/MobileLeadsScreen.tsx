"use client";

import { applyScoreToLead, coldByLabel, priorityFromScore, priorityLabel, scoreLead } from "@/lib/ai";
import { rankLeads } from "@/lib/ai/lead-priority";
import { LeadPriorityModeSelect } from "@/components/LeadPriorityModeSelect";
import { useDataHub } from "@/lib/data";
import {
  ORIGIN_LABEL,
  ROUTE_LABEL,
  type Lead,
  type LeadStatus,
} from "@/lib/demo-data";
import type { Lang } from "@/lib/i18n";
import { useNotifications } from "@/lib/notifications";
import { showMobileSuccess } from "@/lib/mobile-confirm";
import { useLeadPriorityMode } from "@/lib/use-lead-priority-mode";
import { cn } from "@/lib/utils";
import {
  MobileCard,
  MobileChip,
  MobileFilterRow,
  MobileKv,
  MobileRing,
  MobileScreenTitle,
  type MobileTone,
} from "@/components/MobileBits";
import { MobileSheet } from "@/components/MobileSheet";
import { ChevronRight, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

const STATUS_LABEL: Record<LeadStatus, { es: string; en: string; tone: MobileTone }> = {
  nuevo: { es: "Nuevo", en: "New", tone: "neutral" },
  en_contacto: { es: "En contacto", en: "In contact", tone: "accent" },
  cualificado: { es: "Cualificado", en: "Qualified", tone: "ok" },
  reservado: { es: "Reservado", en: "Booked", tone: "ok" },
  descartado: { es: "Descartado", en: "Dropped", tone: "danger" },
};

const STATUS_ORDER: LeadStatus[] = [
  "nuevo",
  "en_contacto",
  "cualificado",
  "reservado",
  "descartado",
];

type LeadFilter = "all" | LeadStatus;

function scoreTone(score: number): MobileTone {
  if (score >= 85) return "ok";
  if (score >= 65) return "accent";
  if (score >= 45) return "warn";
  return "danger";
}

function daysAgo(iso: string, es: boolean): string {
  const then = new Date(`${iso}T00:00:00`).getTime();
  if (Number.isNaN(then)) return iso;
  const days = Math.max(0, Math.round((Date.now() - then) / 86_400_000));
  if (days === 0) return es ? "hoy" : "today";
  if (days === 1) return es ? "ayer" : "yesterday";
  return es ? `hace ${days} días` : `${days} days ago`;
}

export function MobileLeadsScreen({ lang }: { lang: Lang }) {
  const hub = useDataHub();
  const es = lang === "es";
  const { mode, setLeadPriorityMode } = useLeadPriorityMode();
  const [filter, setFilter] = useState<LeadFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  // El modo solo reordena. El score del anillo sigue siendo el auditable.
  const list = useMemo(() => {
    const filtered = hub.leads.filter((l) => filter === "all" || l.status === filter);
    return rankLeads({
      leads: filtered,
      clients: hub.clients,
      mode,
      lang,
    });
  }, [hub.leads, hub.clients, filter, mode, lang]);

  const filters: { id: LeadFilter; label: string }[] = [
    { id: "all", label: es ? "Todos" : "All" },
    { id: "nuevo", label: es ? "Nuevos" : "New" },
    { id: "en_contacto", label: es ? "En contacto" : "In contact" },
    { id: "cualificado", label: es ? "Cualificados" : "Qualified" },
    { id: "reservado", label: es ? "Reservados" : "Booked" },
  ];

  const open = hub.leads.find((l) => l.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <MobileScreenTitle
        title="Leads"
        subtitle={
          es
            ? "Cola priorizada por negocio. Tú decides quién recibe la llamada."
            : "Queue ranked by business mode. You decide who gets the call."
        }
      />

      <LeadPriorityModeSelect
        value={mode}
        onChange={setLeadPriorityMode}
        lang={lang}
        compact
      />

      <MobileFilterRow options={filters} value={filter} onChange={setFilter} />

      <div className="flex flex-col gap-2.5">
        {list.length === 0 ? (
          <MobileCard>
            <p className="px-4 py-8 text-center text-[13px] text-[var(--ink-muted)]">
              {es ? "No hay leads con ese filtro." : "No leads with that filter."}
            </p>
          </MobileCard>
        ) : (
          list.map(({ lead, effective, base, why }) => {
            const status = STATUS_LABEL[lead.status];
            const cooled = base - effective >= 5;
            const cold = coldByLabel(lead, es ? "es" : "en");
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => setOpenId(lead.id)}
                className="flex w-full items-center gap-3 rounded-[1.25rem] border border-[color-mix(in_oklab,var(--ink)_8%,transparent)] bg-[var(--glass-strong)] p-3.5 text-left shadow-sm"
              >
                <MobileRing
                  value={lead.score}
                  tone={scoreTone(lead.score)}
                  size={46}
                  label={`Score ${lead.score}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[var(--ink)]">
                    {lead.name}
                  </span>
                  <span className="block truncate text-xs text-[var(--ink-muted)]">
                    {why}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    <MobileChip tone={status.tone}>{es ? status.es : status.en}</MobileChip>
                    <MobileChip>{ORIGIN_LABEL[lead.origin]}</MobileChip>
                    {cooled && (
                      <MobileChip tone="warn">
                        {es ? `→ ${effective} · ${cold}` : `→ ${effective} · ${cold}`}
                      </MobileChip>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[11px] text-[var(--ink-muted)]">
                    {daysAgo(lead.lastTouchAt || lead.createdAt, es)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" />
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="flex gap-2.5 rounded-[1.15rem] border border-[color-mix(in_oklab,var(--accent)_24%,transparent)] bg-[color-mix(in_oklab,var(--accent)_8%,var(--glass-strong))] p-3.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
        <p className="text-[12.5px] leading-relaxed text-[var(--ink)]">
          {es ? (
            <>
              <b className="font-semibold">Regla de oro:</b> el scoring prioriza la cola,
              pero el primer mensaje lo escribe siempre una persona del equipo.
            </>
          ) : (
            <>
              <b className="font-semibold">Golden rule:</b> scoring ranks the queue, but the
              first message is always written by a human.
            </>
          )}
        </p>
      </div>

      <MobileLeadSheet lead={open} lang={lang} onClose={() => setOpenId(null)} />
    </div>
  );
}

export function MobileLeadSheet({
  lead,
  lang,
  onClose,
}: {
  lead: Lead | null;
  lang: Lang;
  onClose: () => void;
}) {
  const hub = useDataHub();
  const { push } = useNotifications();
  const es = lang === "es";
  const [scoring, setScoring] = useState(false);

  async function changeStatus(current: Lead, status: LeadStatus) {
    if (current.status === status) return;
    await hub.saveLead({
      ...current,
      status,
      lastTouchAt: new Date().toISOString().slice(0, 10),
    });
  }

  async function runScore(current: Lead) {
    if (scoring) return;
    setScoring(true);
    try {
      const linked =
        hub.clients.find((c) => c.email.toLowerCase() === current.email.toLowerCase()) ??
        null;
      const result = await scoreLead(current, linked);
      await hub.saveLead(applyScoreToLead(current, result));
      push({
        kind: "lead",
        tone: result.score >= 80 ? "ok" : "info",
        actor: current.name,
        statusLabel: es ? "SCORE IA" : "AI SCORE",
        body: `Lead score ${result.score}/100 · ${priorityLabel(result.priority, lang)}`,
        detail: result.reasons.slice(0, 3).join(" · "),
        section: "leads",
        entityId: current.id,
      });
      showMobileSuccess({
        title: es ? "Scoring actualizado" : "Scoring updated",
        description: `${current.name} · ${result.score}/100 · ${
          es ? "nadie ha sido contactado" : "nobody was contacted"
        }`,
      });
    } finally {
      setScoring(false);
    }
  }

  return (
    <MobileSheet
      open={Boolean(lead)}
      title={es ? "Ficha de lead" : "Lead profile"}
      onClose={onClose}
    >
      {lead && (
        <>
          <MobileCard className="flex items-center gap-3.5 p-4">
            <MobileRing
              value={lead.score}
              tone={scoreTone(lead.score)}
              size={62}
              label={`Score ${lead.score}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-bold tracking-tight text-[var(--ink)]">
                {lead.name}
              </span>
              <span className="block truncate text-xs text-[var(--ink-muted)]">
                {lead.id} · {es ? "Resp." : "Owner"} {lead.owner}
              </span>
              <span className="mt-2 flex flex-wrap gap-1.5">
                <MobileChip tone={STATUS_LABEL[lead.status].tone}>
                  {es ? STATUS_LABEL[lead.status].es : STATUS_LABEL[lead.status].en}
                </MobileChip>
                <MobileChip tone={scoreTone(lead.score)}>
                  {priorityLabel(priorityFromScore(lead.score), lang)}
                </MobileChip>
              </span>
            </span>
          </MobileCard>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={scoring}
              onClick={() => void runScore(lead)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-sm font-bold text-white shadow-[0_8px_20px_color-mix(in_oklab,var(--accent)_34%,transparent)] disabled:opacity-60"
            >
              {scoring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {es ? "Clasificar con IA" : "Score with AI"}
            </button>
            <a
              href={`mailto:${lead.email}`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[color-mix(in_oklab,var(--ink)_10%,transparent)] bg-[var(--glass-strong)] text-sm font-bold text-[var(--ink)]"
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
          </div>

          <MobileCard className="divide-y divide-[color-mix(in_oklab,var(--ink)_8%,transparent)]">
            <MobileKv
              label={es ? "Ruta de interés" : "Route of interest"}
              value={lead.interestRoute ? ROUTE_LABEL[lead.interestRoute] : "—"}
            />
            <MobileKv
              label={es ? "Vehículo" : "Vehicle"}
              value={lead.vehicle ? (lead.vehicle === "moto" ? "Moto" : "4x4") : "—"}
            />
            <MobileKv label={es ? "Origen" : "Source"} value={ORIGIN_LABEL[lead.origin]} />
            <MobileKv label={es ? "Campaña" : "Campaign"} value={lead.campaign ?? "—"} />
            <MobileKv label="Email" value={lead.email} />
            <MobileKv label={es ? "Entró" : "Created"} value={lead.createdAt} />
            <MobileKv
              label={es ? "Último contacto" : "Last touch"}
              value={lead.lastTouchAt || "—"}
            />
          </MobileCard>

          {lead.scoreReasons.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">
                {es ? "Por qué esta puntuación" : "Why this score"}
              </h3>
              <MobileCard className="flex flex-col gap-2.5 p-4">
                {lead.scoreReasons.map((reason) => (
                  <p
                    key={reason}
                    className="flex gap-2.5 text-[13px] leading-snug text-[var(--ink)]"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                    {reason}
                  </p>
                ))}
              </MobileCard>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">
              {es ? "Estado del lead" : "Lead status"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={lead.status === s}
                  onClick={() => void changeStatus(lead, s)}
                  className={cn(
                    "min-h-10 rounded-full border px-3.5 text-[12.5px] font-semibold transition",
                    lead.status === s
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[color-mix(in_oklab,var(--ink)_10%,transparent)] bg-[var(--glass-strong)] text-[var(--ink)]",
                  )}
                >
                  {es ? STATUS_LABEL[s].es : STATUS_LABEL[s].en}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </MobileSheet>
  );
}
