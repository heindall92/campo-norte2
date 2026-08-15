import { useMemo } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatEur } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { Reservation } from "@/lib/ops-data";
import { buildTeamOps } from "@/lib/team-ops";
import { cn } from "@/lib/utils";

interface TeamOpsPanelProps {
  reservations?: Reservation[];
  lang?: Lang;
  className?: string;
  onOpenReservation?: (id: string) => void;
}

/**
 * Equipo operativo — conexiones persona ↔ expedición ↔ coste estimado.
 * Traducción a Campo Norte del patrón "Laboral" de la demo de referencia,
 * sin nóminas ni equity inventados.
 */
export function TeamOpsPanel({
  reservations,
  lang = "es",
  className,
  onOpenReservation,
}: TeamOpsPanelProps) {
  const snap = useMemo(() => buildTeamOps(reservations), [reservations]);

  return (
    <div className={cn("space-y-5", className)}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-tertiary)" }}>
            {lang === "es" ? "Coste pendiente" : "Pending cost"}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: "var(--negative)" }}>
            {formatEur(snap.pendingCost, lang)}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            {lang === "es" ? "Expediciones abiertas" : "Open trips"}
          </p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-tertiary)" }}>
            {lang === "es" ? "Personas conectadas" : "People linked"}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {snap.byMember.length}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            {lang === "es" ? "Guías / ops en reservas" : "Guides / ops on bookings"}
          </p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-tertiary)" }}>
            {lang === "es" ? "Asignaciones" : "Assignments"}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {snap.assignments.length}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            {lang === "es" ? "Enlaces persona ↔ viaje" : "Person ↔ trip links"}
          </p>
        </div>
      </div>

      <section className="glass-panel rounded-2xl p-5">
        <header className="mb-3">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {lang === "es" ? "Coste por persona" : "Cost by person"}
          </h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {lang === "es"
              ? "Dieta × días de itinerario. Estimación operativa, no nómina."
              : "Day rate × itinerary days. Ops estimate, not payroll."}
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="mps-table">
            <thead>
              <tr>
                <th scope="col">{lang === "es" ? "Persona" : "Person"}</th>
                <th scope="col">Rol</th>
                <th scope="col" className="mps-num">
                  {lang === "es" ? "Viajes" : "Trips"}
                </th>
                <th scope="col" className="mps-num">
                  {lang === "es" ? "Días" : "Days"}
                </th>
                <th scope="col" className="mps-num">
                  {lang === "es" ? "Coste" : "Cost"}
                </th>
              </tr>
            </thead>
            <tbody>
              {snap.byMember.map((m) => (
                <tr key={m.name}>
                  <td style={{ color: "var(--text-primary)" }}>{m.name}</td>
                  <td>
                    <StatusBadge tone="info">{m.role}</StatusBadge>
                  </td>
                  <td className="mps-num">{m.trips}</td>
                  <td className="mps-num">{m.days}</td>
                  <td className="mps-num font-semibold" style={{ color: "var(--text-primary)" }}>
                    {formatEur(m.cost, lang)}
                  </td>
                </tr>
              ))}
              {snap.byMember.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center" style={{ color: "var(--text-tertiary)" }}>
                    {lang === "es" ? "Sin asignaciones de equipo." : "No team assignments."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-5">
        <header className="mb-3">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {lang === "es" ? "Conexiones en expediciones" : "Trip connections"}
          </h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {lang === "es"
              ? "Cada fila enlaza a la reserva donde se resuelve la logística."
              : "Each row links to the booking where logistics are resolved."}
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="mps-table">
            <thead>
              <tr>
                <th scope="col">{lang === "es" ? "Salida" : "Departure"}</th>
                <th scope="col">{lang === "es" ? "Expedición" : "Trip"}</th>
                <th scope="col">{lang === "es" ? "Persona" : "Person"}</th>
                <th scope="col" className="mps-num">
                  {lang === "es" ? "Coste" : "Cost"}
                </th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {snap.assignments.map((a) => (
                <tr key={`${a.reservationId}:${a.personName}`}>
                  <td className="whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    {formatDate(a.departureAt, lang)}
                  </td>
                  <td>
                    <span className="block" style={{ color: "var(--text-primary)" }}>
                      {a.tripName}
                    </span>
                    <span className="block text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {a.status} · {a.days}d · {formatEur(a.dayRate, lang)}/d
                    </span>
                  </td>
                  <td style={{ color: "var(--text-primary)" }}>{a.personName}</td>
                  <td className="mps-num font-semibold">{formatEur(a.cost, lang)}</td>
                  <td className="mps-num">
                    {onOpenReservation ? (
                      <button
                        type="button"
                        onClick={() => onOpenReservation(a.reservationId)}
                        className="mps-choice rounded-lg px-2.5 py-1 text-xs font-semibold"
                      >
                        {lang === "es" ? "Abrir" : "Open"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
