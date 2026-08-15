import { useMemo } from "react";

import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { formatDate, formatEur } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { Invoice, Reservation } from "@/lib/ops-data";
import { buildUpcomingMovements, type UpcomingMovement } from "@/lib/upcoming-cash";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<UpcomingMovement["status"], StatusTone> = {
  programado: "info",
  vencimiento: "warning",
  vencido: "negative",
};

const STATUS_LABEL: Record<UpcomingMovement["status"], string> = {
  programado: "Programado",
  vencimiento: "Vencimiento",
  vencido: "Vencido",
};

interface UpcomingCashPanelProps {
  invoices?: Invoice[];
  reservations?: Reservation[];
  lang?: Lang;
  now?: Date;
  className?: string;
  onOpen?: (row: UpcomingMovement) => void;
}

export function UpcomingCashPanel({
  invoices,
  reservations,
  lang = "es",
  now,
  className,
  onOpen,
}: UpcomingCashPanelProps) {
  const rows = useMemo(
    () => buildUpcomingMovements({ invoices, reservations, now }),
    [invoices, reservations, now],
  );

  return (
    <section className={cn("glass-panel rounded-2xl p-5", className)}>
      <header className="mb-3">
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          {lang === "es" ? "Próximos movimientos" : "Upcoming movements"}
        </h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {lang === "es"
            ? "Cobros, saldos de reserva y dietas de equipo — derivados del Hub."
            : "Collections, booking balances and team day-rates — derived from the Hub."}
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="mps-table">
          <thead>
            <tr>
              <th scope="col">{lang === "es" ? "Fecha" : "Date"}</th>
              <th scope="col">{lang === "es" ? "Concepto" : "Concept"}</th>
              <th scope="col">{lang === "es" ? "Estado" : "Status"}</th>
              <th scope="col" className="mps-num">
                {lang === "es" ? "Importe" : "Amount"}
              </th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                  {formatDate(r.date, lang)}
                </td>
                <td>
                  <span className="block" style={{ color: "var(--text-primary)" }}>
                    {r.label}
                  </span>
                  <span className="block text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {r.counterparty}
                  </span>
                </td>
                <td>
                  <StatusBadge tone={STATUS_TONE[r.status]}>
                    {lang === "es"
                      ? STATUS_LABEL[r.status]
                      : r.status === "vencido"
                        ? "Overdue"
                        : r.status === "vencimiento"
                          ? "Due soon"
                          : "Scheduled"}
                  </StatusBadge>
                </td>
                <td
                  className="mps-num font-semibold"
                  style={{ color: r.amount < 0 ? "var(--negative)" : "var(--positive)" }}
                >
                  {formatEur(r.amount, lang)}
                </td>
                <td className="mps-num">
                  {onOpen ? (
                    <button
                      type="button"
                      className="mps-choice rounded-lg px-2 py-1 text-xs font-semibold"
                      onClick={() => onOpen(r)}
                    >
                      {lang === "es" ? "Abrir" : "Open"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center" style={{ color: "var(--text-tertiary)" }}>
                  {lang === "es" ? "Sin movimientos próximos." : "No upcoming movements."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
