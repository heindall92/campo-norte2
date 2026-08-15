"use client";

import { useDataHub } from "@/lib/data";
import { avgMarginPct, avgOccupancyPct } from "@/lib/business-kpis";
import {
  leadPriorityModeLabel,
  rankLeads,
  type LeadPriorityMode,
} from "@/lib/ai/lead-priority";
import { MPS_ANNEX } from "@/lib/assumptions";
import {
  EXPEDITIONS,
  ROUTE_LABEL,
  type Client,
  type Expedition,
  type Lead,
} from "@/lib/demo-data";
import type { Reservation } from "@/lib/ops-data";
import type { Lang } from "@/lib/i18n";
import type { AppSection } from "@/lib/notifications";
import { useLeadPriorityMode } from "@/lib/use-lead-priority-mode";
import { cn } from "@/lib/utils";
import { MobileBookingSheet } from "@/components/MobileBookingsScreen";
import { MobileClientSheet } from "@/components/MobileClientsScreen";
import { MobileLeadSheet } from "@/components/MobileLeadsScreen";
import {
  ArrowRight,
  Bike,
  Check,
  ChevronRight,
  Clock,
  FileWarning,
  Flame,
  PhoneCall,
  TrendingUp,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

const DAY_MS = 86_400_000;

function startOfDay(value: string | Date): number {
  const d = typeof value === "string" ? new Date(`${value}T00:00:00`) : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysUntil(iso: string, today: number): number {
  return Math.round((startOfDay(iso) - today) / DAY_MS);
}

/**
 * Expedición de una reserva. El `expeditionId` de la semilla no siempre casa con
 * la ruta, así que solo lo damos por bueno si coincide; si no, buscamos por ruta
 * y fecha más cercana. Sin coincidencia no inventamos plazas.
 */
function matchExpedition(reservation: Reservation): Expedition | null {
  const byId = EXPEDITIONS.find((e) => e.id === reservation.expeditionId);
  if (byId && byId.route === reservation.route) return byId;
  const target = startOfDay(reservation.departureAt);
  const byRoute = EXPEDITIONS.filter((e) => e.route === reservation.route).sort(
    (a, b) =>
      Math.abs(startOfDay(a.departureAt) - target) -
      Math.abs(startOfDay(b.departureAt) - target),
  );
  return byRoute[0] ?? null;
}

/** Salida más próxima con reserva viva, con su expedición para plazas. */
function nextDeparture(reservations: Reservation[], today: number) {
  const upcoming = reservations
    .filter((r) => r.status !== "cerrado" && startOfDay(r.departureAt) >= today)
    .sort((a, b) => startOfDay(a.departureAt) - startOfDay(b.departureAt));
  const reservation = upcoming[0];
  if (!reservation) return null;
  const expedition = matchExpedition(reservation);
  return {
    reservation,
    expedition,
    days: daysUntil(reservation.departureAt, today),
    seatsPct:
      expedition && expedition.seats
        ? Math.round((expedition.booked / expedition.seats) * 100)
        : null,
  };
}

function futureExpeditions(today: number): Expedition[] {
  const future = EXPEDITIONS.filter((e) => startOfDay(e.departureAt) >= today);
  return future.length ? future : EXPEDITIONS;
}

/** Lo que falta por cobrar en reservas que siguen abiertas. */
function pendingBalance(reservations: Reservation[]) {
  const open = reservations.filter((r) => r.status !== "cerrado");
  const total = open.reduce((sum, r) => sum + Math.max(0, r.totalAmount - r.depositPaid), 0);
  const count = open.filter((r) => r.totalAmount - r.depositPaid > 0).length;
  return { total, count };
}

type PriorityKind = "client" | "lead" | "reservation";

type Priority = {
  id: string;
  kind: PriorityKind;
  entityId: string;
  icon: LucideIcon;
  tone: "danger" | "accent" | "warn";
  title: string;
  detail: string;
};

function buildPriorities(
  es: boolean,
  today: number,
  leads: Lead[],
  clients: Client[],
  reservations: Reservation[],
  mode: LeadPriorityMode,
): Priority[] {
  const list: Priority[] = [];
  const lang = es ? "es" : "en";

  const call = clients
    .filter((c) => c.contactThisMonth || c.reactivationPriority >= 80)
    .sort((a, b) => b.reactivationPriority - a.reactivationPriority)[0];
  if (call) {
    list.push({
      id: `client-${call.id}`,
      kind: "client",
      entityId: call.id,
      icon: PhoneCall,
      tone: "danger",
      title: es ? `Llamar a ${call.name}` : `Call ${call.name}`,
      detail: call.reactivationWhy,
    });
  }

  // Respeta el modo de priorización del usuario; el score guardado no se toca.
  const now = new Date(today);
  const hot = rankLeads({
    leads: leads.filter((l) => l.status !== "descartado" && l.status !== "reservado"),
    clients,
    mode,
    now,
    lang,
  })[0];
  if (hot) {
    const { lead, why, effective } = hot;
    list.push({
      id: `lead-${lead.id}`,
      kind: "lead",
      entityId: lead.id,
      icon: Flame,
      tone: "accent",
      title: es
        ? `${lead.name} · ${leadPriorityModeLabel(mode, "es")}`
        : `${lead.name} · ${leadPriorityModeLabel(mode, "en")}`,
      detail: [why, lead.owner, es ? `score ${lead.score} · efectivo ${effective}` : `score ${lead.score} · effective ${effective}`]
        .filter(Boolean)
        .join(" · "),
    });
  }

  const docs = reservations
    .filter((r) => r.status === "docs_pendientes")
    .sort((a, b) => startOfDay(a.departureAt) - startOfDay(b.departureAt))[0];
  if (docs) {
    const left = daysUntil(docs.departureAt, today);
    list.push({
      id: `res-${docs.id}`,
      kind: "reservation",
      entityId: docs.id,
      icon: FileWarning,
      tone: "warn",
      title: es
        ? `Faltan documentos · ${docs.clientName}`
        : `Documents pending · ${docs.clientName}`,
      detail: es
        ? `${ROUTE_LABEL[docs.route]} · sale en ${left} días`
        : `${ROUTE_LABEL[docs.route]} · departs in ${left} days`,
    });
  }

  return list;
}

const TONE_CLASS: Record<Priority["tone"], string> = {
  danger:
    "bg-[color-mix(in_oklab,var(--danger)_14%,transparent)] text-[var(--danger)]",
  accent:
    "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)]",
  warn: "bg-[color-mix(in_oklab,var(--warn-ink)_14%,transparent)] text-[var(--warn-ink)]",
};

function KpiCard({
  label,
  value,
  unit,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[6.25rem] flex-col gap-1 rounded-[1.25rem] border border-[color-mix(in_oklab,var(--ink)_8%,transparent)] bg-[var(--glass-strong)] p-3 shadow-sm">
      <p className="text-[10.5px] font-semibold leading-snug text-[var(--ink-muted)] text-pretty">
        {label}
      </p>
      <p className="flex items-baseline gap-0.5 text-[1.55rem] font-bold leading-none tracking-tight text-[var(--ink)] tabular-nums">
        {value}
        {unit && (
          <span className="text-sm font-semibold text-[var(--ink-muted)]">{unit}</span>
        )}
      </p>
      <div className="mt-auto flex w-full min-w-0 flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Meter({ pct }: { pct: number }) {
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--field-bg)]">
      <span
        className="block h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </span>
  );
}

function KpiFoot({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon;
  tone: "ok" | "warn" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex w-full min-w-0 items-start gap-1 text-[10.5px] font-semibold leading-snug",
        tone === "ok" && "text-[var(--ok)]",
        tone === "warn" && "text-[var(--warn-ink)]",
        tone === "muted" && "text-[var(--ink-muted)]",
      )}
    >
      <Icon className="mt-0.5 h-3 w-3 shrink-0" />
      <span className="min-w-0 flex-1 text-pretty [overflow-wrap:anywhere]">{children}</span>
    </span>
  );
}

export function MobileHomeSummary({
  lang,
  onNavigate,
}: {
  lang: Lang;
  onNavigate: (section: AppSection) => void;
}) {
  const hub = useDataHub();
  const es = lang === "es";
  const { mode } = useLeadPriorityMode();
  const [sheet, setSheet] = useState<{ kind: PriorityKind; id: string } | null>(null);

  const openClient = hub.clients.find((c) => sheet?.kind === "client" && c.id === sheet.id) ?? null;
  const openLead = hub.leads.find((l) => sheet?.kind === "lead" && l.id === sheet.id) ?? null;
  const openReservation =
    hub.reservations.find((r) => sheet?.kind === "reservation" && r.id === sheet.id) ?? null;

  const summary = useMemo(() => {
    const today = startOfDay(new Date());
    const future = futureExpeditions(today);
    const weekAgo = today - 7 * DAY_MS;

    const leadsThisWeek = hub.leads.filter((l) => startOfDay(l.createdAt) >= weekAgo).length;
    const knownOrigin = hub.leads.filter((l) => l.origin !== "unknown").length;

    return {
      next: nextDeparture(hub.reservations, today),
      leadsThisWeek,
      leadsTotal: hub.leads.length,
      originPct: hub.leads.length
        ? Math.round((knownOrigin / hub.leads.length) * 100)
        : 0,
      occupancy: avgOccupancyPct(future),
      seats: future.reduce(
        (acc, e) => ({ booked: acc.booked + e.booked, total: acc.total + e.seats }),
        { booked: 0, total: 0 },
      ),
      pending: pendingBalance(hub.reservations),
      margin: avgMarginPct(future),
      priorities: buildPriorities(es, today, hub.leads, hub.clients, hub.reservations, mode),
    };
  }, [es, mode, hub.leads, hub.clients, hub.reservations]);

  const money = (value: number) =>
    new Intl.NumberFormat(es ? "es-ES" : "en-GB", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);

  const next = summary.next;
  const VehicleIcon = next?.reservation.vehicle === "moto" ? Bike : Truck;
  const marginTarget = MPS_ANNEX.marginTargetPct;

  return (
    <div className="flex flex-col gap-4">
      {/* Próxima salida — usa el acento del tema del usuario */}
      <article className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] p-5 text-white shadow-[0_18px_44px_color-mix(in_oklab,var(--accent)_34%,transparent)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-32 h-[21rem] w-[21rem] opacity-50"
          style={{
            backgroundImage:
              "repeating-radial-gradient(circle at 70% 30%, rgba(255,255,255,.34) 0 1px, transparent 1px 17px)",
          }}
        />
        {next ? (
          <>
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-white/85">
                  {es ? "Próxima salida" : "Next departure"}
                </p>
                <p className="mt-1.5 text-xl font-bold leading-tight text-pretty">
                  {ROUTE_LABEL[next.reservation.route]}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-white/90">
                  {new Date(`${next.reservation.departureAt}T00:00:00`).toLocaleDateString(
                    es ? "es-ES" : "en-GB",
                    { day: "numeric", month: "short", year: "numeric" },
                  )}
                  <span aria-hidden>·</span>
                  <VehicleIcon className="h-3.5 w-3.5" />
                  {next.reservation.tourLeader}
                </p>
              </div>
              <div className="relative grid h-[4.1rem] w-[4.1rem] shrink-0 place-items-center">
                <svg
                  aria-hidden
                  viewBox="0 0 66 66"
                  className="absolute inset-0 -rotate-90"
                >
                  <circle
                    cx="33"
                    cy="33"
                    r="29"
                    fill="none"
                    stroke="rgba(255,255,255,.28)"
                    strokeWidth="5"
                  />
                  {next.seatsPct !== null && (
                    <circle
                      cx="33"
                      cy="33"
                      r="29"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray="182"
                      strokeDashoffset={182 * (1 - next.seatsPct / 100)}
                    />
                  )}
                </svg>
                <span className="text-center leading-none">
                  <span className="block text-[17px] font-bold tabular-nums">
                    {next.days}
                  </span>
                  <span className="mt-0.5 block text-[9px] font-semibold tracking-wide text-white/85">
                    {es ? "días" : "days"}
                  </span>
                </span>
              </div>
            </div>
            <div className="relative mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setSheet({ kind: "reservation", id: next.reservation.id })
                }
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[var(--accent)]"
              >
                {es ? "Ver reserva" : "Open booking"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              {next.expedition && (
                <span className="text-xs font-semibold text-white/90 tabular-nums">
                  {next.expedition.booked}/{next.expedition.seats}{" "}
                  {es ? "plazas" : "seats"}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="relative">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-white/85">
              {es ? "Próxima salida" : "Next departure"}
            </p>
            <p className="mt-1.5 text-lg font-bold leading-tight">
              {es ? "Sin salidas programadas" : "No departures scheduled"}
            </p>
            <p className="mt-1 text-sm text-white/90 text-pretty">
              {es
                ? "Cuando haya una reserva con fecha, aparecerá aquí."
                : "Once a booking has a date, it shows up here."}
            </p>
            <button
              type="button"
              onClick={() => onNavigate("reservas")}
              className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[var(--accent)]"
            >
              {es ? "Ir a reservas" : "Go to bookings"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </article>

      {/* Cuatro números del negocio */}
      <div className="grid grid-cols-2 gap-2.5">
        <KpiCard
          label={es ? "Leads esta semana" : "Leads this week"}
          value={String(summary.leadsThisWeek)}
        >
          <KpiFoot icon={TrendingUp} tone={summary.leadsThisWeek > 0 ? "ok" : "muted"}>
            {es ? (
              <>
                <span className="whitespace-nowrap">{summary.leadsTotal} en cola</span>
                <span aria-hidden> · </span>
                <span className="whitespace-nowrap">origen {summary.originPct}%</span>
              </>
            ) : (
              <>
                <span className="whitespace-nowrap">{summary.leadsTotal} in queue</span>
                <span aria-hidden> · </span>
                <span className="whitespace-nowrap">source {summary.originPct}%</span>
              </>
            )}
          </KpiFoot>
        </KpiCard>

        <KpiCard
          label={es ? "Ocupación salidas" : "Departure occupancy"}
          value={String(summary.occupancy)}
          unit="%"
        >
          <Meter pct={summary.occupancy} />
          <KpiFoot icon={Check} tone="muted">
            {es
              ? `${summary.seats.booked} de ${summary.seats.total} plazas`
              : `${summary.seats.booked} of ${summary.seats.total} seats`}
          </KpiFoot>
        </KpiCard>

        <KpiCard
          label={es ? "Saldo pendiente" : "Outstanding balance"}
          value={money(summary.pending.total)}
        >
          <KpiFoot icon={Clock} tone={summary.pending.total > 0 ? "warn" : "muted"}>
            {es
              ? `${summary.pending.count} reservas por cobrar`
              : `${summary.pending.count} bookings to collect`}
          </KpiFoot>
        </KpiCard>

        <KpiCard
          label={es ? "Margen medio" : "Average margin"}
          value={String(summary.margin)}
          unit="%"
        >
          <Meter pct={(summary.margin / marginTarget) * 100} />
          <KpiFoot
            icon={summary.margin >= marginTarget ? Check : Clock}
            tone={summary.margin >= marginTarget ? "ok" : "warn"}
          >
            {es ? `objetivo ${marginTarget} %` : `target ${marginTarget}%`}
          </KpiFoot>
        </KpiCard>
      </div>

      {/* Prioridad de hoy */}
      {summary.priorities.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-bold text-[var(--ink)]">
              {es ? "Prioridad de hoy" : "Today's priority"}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("leads")}
              className="text-[13px] font-semibold text-[var(--accent)]"
            >
              {es ? "Ver leads" : "View leads"}
            </button>
          </div>
          <div className="divide-y divide-[color-mix(in_oklab,var(--ink)_8%,transparent)] overflow-hidden rounded-[1.25rem] border border-[color-mix(in_oklab,var(--ink)_8%,transparent)] bg-[var(--glass-strong)] shadow-sm">
            {summary.priorities.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSheet({ kind: p.kind, id: p.entityId })}
                  className="flex w-full min-h-14 items-center gap-3 px-3.5 py-3 text-left"
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.85rem]",
                      TONE_CLASS[p.tone],
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-[var(--ink)]">
                      {p.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--ink-muted)]">
                      {p.detail}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <MobileClientSheet
        client={openClient}
        lang={lang}
        onClose={() => setSheet(null)}
      />
      <MobileLeadSheet lead={openLead} lang={lang} onClose={() => setSheet(null)} />
      <MobileBookingSheet
        reservation={openReservation}
        lang={lang}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
