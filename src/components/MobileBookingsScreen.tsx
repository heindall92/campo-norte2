"use client";

import { useDataHub } from "@/lib/data";
import { PAYMENT_METHOD_LABEL, ROUTE_LABEL } from "@/lib/demo-data";
import {
  RESERVATION_STATUS_LABEL,
  type Reservation,
  type ReservationStatus,
} from "@/lib/ops-data";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  MobileCard,
  MobileChip,
  MobileFilterRow,
  MobileKv,
  MobileMeter,
  MobileScreenTitle,
  type MobileTone,
} from "@/components/MobileBits";
import { MobileContactActions, MobileSheet } from "@/components/MobileSheet";
import { Bike, ChevronRight, Phone, Truck } from "lucide-react";
import { useMemo, useState } from "react";

const STATUS_TONE: Record<ReservationStatus, MobileTone> = {
  reservado: "accent",
  docs_pendientes: "warn",
  prep_viaje: "accent",
  en_curso: "ok",
  cerrado: "ok",
};

type BookingFilter = "all" | "activas" | "docs_pendientes" | "cerrado";

const DAY_MS = 86_400_000;

function startOfDay(value: string | Date): number {
  const d = typeof value === "string" ? new Date(`${value}T00:00:00`) : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function MobileBookingsScreen({ lang }: { lang: Lang }) {
  const hub = useDataHub();
  const es = lang === "es";
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const money = (value: number) =>
    new Intl.NumberFormat(es ? "es-ES" : "en-GB", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);

  const today = startOfDay(new Date());

  const list = useMemo(() => {
    return hub.reservations
      .filter((r) => {
        if (filter === "all") return true;
        if (filter === "activas") return r.status !== "cerrado";
        return r.status === filter;
      })
      .sort((a, b) => startOfDay(a.departureAt) - startOfDay(b.departureAt));
  }, [hub.reservations, filter]);

  const filters: { id: BookingFilter; label: string }[] = [
    { id: "all", label: es ? "Todas" : "All" },
    { id: "activas", label: es ? "Activas" : "Active" },
    { id: "docs_pendientes", label: es ? "Docs pendientes" : "Docs pending" },
    { id: "cerrado", label: es ? "Cerradas" : "Closed" },
  ];

  const open = hub.reservations.find((r) => r.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <MobileScreenTitle
        title={es ? "Reservas" : "Bookings"}
        subtitle={
          es
            ? "Logística, cobros y preparación de viaje."
            : "Logistics, payments and trip prep."
        }
      />

      <MobileFilterRow options={filters} value={filter} onChange={setFilter} />

      <div className="flex flex-col gap-2.5">
        {list.length === 0 ? (
          <MobileCard>
            <p className="px-4 py-8 text-center text-[13px] text-[var(--ink-muted)]">
              {es ? "No hay reservas con ese filtro." : "No bookings with that filter."}
            </p>
          </MobileCard>
        ) : (
          list.map((r) => {
            const departure = new Date(`${r.departureAt}T00:00:00`);
            const daysLeft = Math.round((startOfDay(r.departureAt) - today) / DAY_MS);
            const paidPct = r.totalAmount
              ? Math.round((r.depositPaid / r.totalAmount) * 100)
              : 0;
            const VehicleIcon = r.vehicle === "moto" ? Bike : Truck;

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setOpenId(r.id)}
                className="w-full rounded-[1.25rem] border border-[color-mix(in_oklab,var(--ink)_8%,transparent)] bg-[var(--glass-strong)] p-3.5 text-left shadow-sm"
              >
                <span className="flex items-start gap-3">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-[0.9rem] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] py-2 text-[var(--accent)]">
                    <b className="text-lg font-bold leading-none tabular-nums">
                      {String(departure.getDate()).padStart(2, "0")}
                    </b>
                    <small className="mt-1 text-[10px] font-bold uppercase tracking-wider">
                      {departure
                        .toLocaleDateString(es ? "es-ES" : "en-GB", { month: "short" })
                        .replace(".", "")}
                    </small>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-[var(--ink)]">
                      {ROUTE_LABEL[r.route]}
                    </span>
                    <span className="block truncate text-xs text-[var(--ink-muted)]">
                      {r.clientName} · {r.pax}{" "}
                      {es
                        ? r.pax === 1
                          ? "viajero"
                          : "viajeros"
                        : r.pax === 1
                          ? "traveller"
                          : "travellers"}{" "}
                      · {r.tourLeader}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <MobileChip tone={STATUS_TONE[r.status]}>
                        {RESERVATION_STATUS_LABEL[r.status]}
                      </MobileChip>
                      <MobileChip>
                        <VehicleIcon className="h-3 w-3" />
                        {r.vehicle === "moto" ? "Moto" : "4x4"}
                      </MobileChip>
                      {r.status !== "cerrado" && daysLeft >= 0 && (
                        <MobileChip tone="accent">D-{daysLeft}</MobileChip>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                </span>

                <span className="mt-3 block">
                  <span className="mb-1.5 flex items-center justify-between text-[11.5px] font-semibold">
                    <span className="text-[var(--ink-muted)]">
                      {es ? "Cobrado" : "Collected"} {paidPct}%
                    </span>
                    <span className="text-[var(--ink)] tabular-nums">
                      {money(r.depositPaid)} / {money(r.totalAmount)}
                    </span>
                  </span>
                  <MobileMeter pct={paidPct} />
                </span>
              </button>
            );
          })
        )}
      </div>

      <MobileBookingSheet
        reservation={open}
        lang={lang}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

export function MobileBookingSheet({
  reservation,
  lang,
  onClose,
}: {
  reservation: Reservation | null;
  lang: Lang;
  onClose: () => void;
}) {
  const hub = useDataHub();
  const es = lang === "es";
  const statuses = Object.keys(RESERVATION_STATUS_LABEL) as ReservationStatus[];
  const money = (value: number) =>
    value.toLocaleString(es ? "es-ES" : "en-GB", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });

  function onChangeStatus(r: Reservation, status: ReservationStatus) {
    if (r.status === status) return;
    void hub.saveReservation({ ...r, status });
  }

  return (
    <MobileSheet
      open={Boolean(reservation)}
      title={es ? "Ficha de reserva" : "Booking details"}
      onClose={onClose}
    >
      {reservation && (
        <>
          <MobileCard className="flex flex-col gap-2 p-4">
            <span className="text-lg font-bold leading-tight tracking-tight text-[var(--ink)] text-pretty">
              {ROUTE_LABEL[reservation.route]}
            </span>
            <span className="text-xs text-[var(--ink-muted)]">
              {reservation.id} · {es ? "salida" : "departs"}{" "}
              {new Date(`${reservation.departureAt}T00:00:00`).toLocaleDateString(
                es ? "es-ES" : "en-GB",
                { day: "numeric", month: "short", year: "numeric" },
              )}
            </span>
            <span className="mt-1 flex flex-wrap gap-1.5">
              <MobileChip tone={STATUS_TONE[reservation.status]}>
                {RESERVATION_STATUS_LABEL[reservation.status]}
              </MobileChip>
              <MobileChip>{reservation.vehicle === "moto" ? "Moto" : "4x4"}</MobileChip>
              <MobileChip>
                {reservation.pax}{" "}
                {es
                  ? reservation.pax === 1
                    ? "viajero"
                    : "viajeros"
                  : reservation.pax === 1
                    ? "traveller"
                    : "travellers"}
              </MobileChip>
            </span>
          </MobileCard>

          <MobileContactActions phone={reservation.clientPhone} lang={lang} />

          <section className="flex flex-col gap-2">
            <h3 className="px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">
              {es ? "Estado de la reserva" : "Booking status"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={reservation.status === s}
                  onClick={() => onChangeStatus(reservation, s)}
                  className={cn(
                    "min-h-10 rounded-full border px-3.5 text-[12.5px] font-semibold transition",
                    reservation.status === s
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[color-mix(in_oklab,var(--ink)_10%,transparent)] bg-[var(--glass-strong)] text-[var(--ink)]",
                  )}
                >
                  {RESERVATION_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </section>

          <MobileCard className="divide-y divide-[color-mix(in_oklab,var(--ink)_8%,transparent)]">
            <MobileKv label={es ? "Cliente" : "Client"} value={reservation.clientName} />
            <MobileKv label="Tour leader" value={reservation.tourLeader} />
            <MobileKv label={es ? "Total" : "Total"} value={money(reservation.totalAmount)} />
            <MobileKv
              label={es ? "Cobrado" : "Collected"}
              value={money(reservation.depositPaid)}
            />
            <MobileKv
              label={es ? "Pendiente" : "Outstanding"}
              value={money(Math.max(0, reservation.totalAmount - reservation.depositPaid))}
            />
            <MobileKv
              label={es ? "Canal de cobro" : "Payment channel"}
              value={PAYMENT_METHOD_LABEL[reservation.paymentChannel]}
            />
          </MobileCard>

          {reservation.itinerary.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">
                {es ? "Itinerario" : "Itinerary"}
              </h3>
              <MobileCard className="p-4">
                {reservation.itinerary.map((stop, i) => (
                  <div key={`${stop.day}-${i}`} className="flex gap-3">
                    <div className="flex w-4 shrink-0 flex-col items-center">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      {i < reservation.itinerary.length - 1 && (
                        <span className="mt-1 w-0.5 flex-1 bg-[var(--field-border)]" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "min-w-0 flex-1",
                        i < reservation.itinerary.length - 1 && "pb-4",
                      )}
                    >
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
                        {stop.day}
                      </p>
                      <p className="text-[13.5px] font-semibold text-[var(--ink)]">
                        {stop.place}
                      </p>
                      <p className="text-xs leading-snug text-[var(--ink-muted)]">
                        {[stop.lodging, stop.meals].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                ))}
              </MobileCard>
            </section>
          )}

          {reservation.logisticsContacts.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">
                {es ? "Contactos de logística" : "Logistics contacts"}
              </h3>
              <MobileCard className="divide-y divide-[color-mix(in_oklab,var(--ink)_8%,transparent)]">
                {reservation.logisticsContacts.map((contact, i) => (
                  <a
                    key={`${contact.name}-${i}`}
                    href={`tel:${contact.phone}`}
                    className="flex items-center gap-3 px-3.5 py-3"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.85rem] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)]">
                      <Phone className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-[var(--ink)]">
                        {contact.name}
                      </span>
                      <span className="block truncate text-xs text-[var(--ink-muted)]">
                        {contact.role} · {contact.phone}
                      </span>
                    </span>
                  </a>
                ))}
              </MobileCard>
            </section>
          )}

          {reservation.internalNotes && (
            <p className="px-1 pb-1 text-[12px] leading-relaxed text-[var(--ink-muted)]">
              {reservation.internalNotes}
            </p>
          )}
        </>
      )}
    </MobileSheet>
  );
}
