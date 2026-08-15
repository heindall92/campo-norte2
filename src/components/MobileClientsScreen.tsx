"use client";

import { useDataHub } from "@/lib/data";
import {
  PAYMENT_STATUS_LABEL,
  ROUTE_LABEL,
  SEGMENT_LABEL,
  STATUS_LABEL,
  type Client,
  type ClientSegment,
} from "@/lib/demo-data";
import type { Lang } from "@/lib/i18n";
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
import { MobileContactActions, MobileSheet } from "@/components/MobileSheet";
import { ChevronRight, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

const SEGMENT_TONE: Record<ClientSegment, MobileTone> = {
  vip: "accent",
  embajador: "ok",
  recurrente: "ok",
  activo: "neutral",
  dormido: "warn",
  en_riesgo: "danger",
  prospecto_newsletter: "neutral",
};

type SegmentFilter = "all" | ClientSegment;

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function priorityTone(value: number): MobileTone {
  if (value >= 85) return "danger";
  if (value >= 70) return "warn";
  return "accent";
}

export function MobileClientsScreen({ lang }: { lang: Lang }) {
  const hub = useDataHub();
  const es = lang === "es";
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const money = (value: number) =>
    new Intl.NumberFormat(es ? "es-ES" : "en-GB", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);

  const queue = useMemo(
    () =>
      hub.clients
        .filter((c) => c.contactThisMonth || c.reactivationPriority >= 80)
        .sort((a, b) => b.reactivationPriority - a.reactivationPriority)
        .slice(0, 4),
    [hub.clients],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return hub.clients
      .filter((c) => segment === "all" || c.segment === segment)
      .filter((c) => {
        if (!q) return true;
        const route = c.nextInterest ? ROUTE_LABEL[c.nextInterest] : "";
        return (
          c.name.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          route.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.ltv - a.ltv);
  }, [hub.clients, query, segment]);

  const filters: { id: SegmentFilter; label: string }[] = [
    { id: "all", label: es ? "Todos" : "All" },
    { id: "vip", label: "VIP" },
    { id: "dormido", label: es ? "Dormidos" : "Dormant" },
    { id: "en_riesgo", label: es ? "En riesgo" : "At risk" },
    { id: "embajador", label: es ? "Embajadores" : "Ambassadors" },
    { id: "recurrente", label: es ? "Recurrentes" : "Returning" },
  ];

  const open = hub.clients.find((c) => c.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <MobileScreenTitle
        title={es ? "Clientes" : "Clients"}
        subtitle={
          es
            ? "Ficha 360º, segmentos y cola de reactivación."
            : "360º profile, segments and reactivation queue."
        }
      />

      <label className="flex min-h-12 items-center gap-2.5 rounded-full border border-[color-mix(in_oklab,var(--ink)_10%,transparent)] bg-[var(--glass-strong)] px-4 shadow-sm">
        <Search className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            es ? "Buscar cliente, ciudad o ruta" : "Search client, city or route"
          }
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
        />
      </label>

      {queue.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-bold text-[var(--ink)]">
              {es ? "Contactar este mes" : "Contact this month"}
            </h2>
            <MobileChip tone="warn">{queue.length}</MobileChip>
          </div>
          <MobileCard className="divide-y divide-[color-mix(in_oklab,var(--ink)_8%,transparent)]">
            {queue.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenId(c.id)}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
              >
                <MobileRing
                  value={c.reactivationPriority}
                  tone={priorityTone(c.reactivationPriority)}
                  label={`${es ? "Prioridad" : "Priority"} ${c.reactivationPriority}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-[var(--ink)]">
                    {c.name}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-[var(--ink-muted)]">
                    {c.reactivationWhy}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
              </button>
            ))}
          </MobileCard>
        </section>
      )}

      <MobileFilterRow options={filters} value={segment} onChange={setSegment} />

      <MobileCard className="divide-y divide-[color-mix(in_oklab,var(--ink)_8%,transparent)]">
        {list.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-[var(--ink-muted)]">
            {es
              ? "Ningún cliente coincide con esa búsqueda."
              : "No client matches that search."}
          </p>
        ) : (
          list.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(c.id)}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-xs font-bold text-white">
                {initials(c.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-[var(--ink)]">
                  {c.name}
                </span>
                <span className="block truncate text-xs text-[var(--ink-muted)]">
                  {c.city} · {c.trips} {es ? (c.trips === 1 ? "viaje" : "viajes") : c.trips === 1 ? "trip" : "trips"}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  <MobileChip tone={SEGMENT_TONE[c.segment]}>
                    {SEGMENT_LABEL[c.segment]}
                  </MobileChip>
                  {c.pendingBalance > 0 && (
                    <MobileChip tone="warn">{money(c.pendingBalance)}</MobileChip>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-bold text-[var(--ink)] tabular-nums">
                  {money(c.ltv)}
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" />
              </span>
            </button>
          ))
        )}
      </MobileCard>

      <MobileClientSheet
        client={open}
        lang={lang}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

export function MobileClientSheet({
  client,
  lang,
  onClose,
}: {
  client: Client | null;
  lang: Lang;
  onClose: () => void;
}) {
  const money = (value: number) =>
    value.toLocaleString(lang === "es" ? "es-ES" : "en-GB", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  const es = lang === "es";

  return (
    <MobileSheet
      open={Boolean(client)}
      title={es ? "Ficha de cliente" : "Client profile"}
      onClose={onClose}
    >
      {client && (
        <>
          <MobileCard className="flex items-center gap-3.5 p-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-lg font-bold text-white">
              {initials(client.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-bold tracking-tight text-[var(--ink)]">
                {client.name}
              </span>
              <span className="block truncate text-xs text-[var(--ink-muted)]">
                {client.id} · {client.city} · {es ? "Resp." : "Owner"} {client.owner}
              </span>
              <span className="mt-2 flex flex-wrap gap-1.5">
                <MobileChip tone={SEGMENT_TONE[client.segment]}>
                  {SEGMENT_LABEL[client.segment]}
                </MobileChip>
                <MobileChip>{STATUS_LABEL[client.status]}</MobileChip>
              </span>
            </span>
          </MobileCard>

          <MobileContactActions phone={client.phone} lang={lang} />
          <p className="-mt-1 px-1 text-[11.5px] leading-snug text-[var(--ink-muted)]">
            {es
              ? "WhatsApp abre el chat con el mensaje que escribas tú. La IA nunca escribe al viajero."
              : "WhatsApp opens the chat with a message you write. AI never writes to the traveller."}
          </p>

          <MobileCard className="divide-y divide-[color-mix(in_oklab,var(--ink)_8%,transparent)]">
            <MobileKv label={es ? "Valor de cliente" : "Lifetime value"} value={money(client.ltv)} />
            <MobileKv label={es ? "Ticket medio" : "Average ticket"} value={money(client.avgTicket)} />
            <MobileKv
              label={es ? "Expediciones" : "Expeditions"}
              value={`${client.trips}${client.lastTripAt ? ` · ${es ? "última" : "last"} ${client.lastTripAt}` : ""}`}
            />
            <MobileKv label="NPS" value={`${client.nps}/10`} />
            <MobileKv
              label={es ? "Cobros" : "Payments"}
              value={
                client.pendingBalance > 0
                  ? `${PAYMENT_STATUS_LABEL[client.paymentStatus]} · ${money(client.pendingBalance)}`
                  : PAYMENT_STATUS_LABEL[client.paymentStatus]
              }
            />
            <MobileKv
              label={es ? "Próximo interés" : "Next interest"}
              value={client.nextInterest ? ROUTE_LABEL[client.nextInterest] : "—"}
            />
            <MobileKv label={es ? "Teléfono" : "Phone"} value={client.phone} />
            <MobileKv label="Email" value={client.email} />
          </MobileCard>

          {(client.reactivationWhy || client.notes) && (
            <div
              className={cn(
                "flex gap-2.5 rounded-[1.15rem] border p-3.5",
                "border-[color-mix(in_oklab,var(--accent)_24%,transparent)] bg-[color-mix(in_oklab,var(--accent)_8%,var(--glass-strong))]",
              )}
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
              <span className="min-w-0 text-[12.5px] leading-relaxed text-[var(--ink)]">
                <b className="font-semibold">
                  {es ? "Aviso interno" : "Internal note"}:
                </b>{" "}
                {client.reactivationWhy || client.notes}
              </span>
            </div>
          )}

          {client.history.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">
                {es ? "Historial" : "History"}
              </h3>
              <MobileCard className="divide-y divide-[color-mix(in_oklab,var(--ink)_8%,transparent)]">
                {client.history.map((trip, i) => (
                  <MobileKv
                    key={`${trip.route}-${trip.date}-${i}`}
                    label={ROUTE_LABEL[trip.route]}
                    value={`${trip.date} · ${money(trip.amount)}`}
                  />
                ))}
              </MobileCard>
            </section>
          )}
        </>
      )}
    </MobileSheet>
  );
}
