import { useMemo, useState } from "react";

import { CashFlowChart } from "@/components/ui/CashFlowChart";
import { ClosingProjection } from "@/components/ui/ClosingProjection";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { ViewTotals } from "@/components/ui/ViewTotals";
import { ROUTE_LABEL } from "@/lib/demo-data";
import { formatEur, formatDate } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { Invoice, Reservation } from "@/lib/ops-data";
import { buildTeamOps } from "@/lib/team-ops";
import {
  buildTreasury,
  deltaVsPrevious,
  totalsForView,
  type Movement,
  type MovementStatus,
} from "@/lib/treasury";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<MovementStatus, StatusTone> = {
  cobrado: "positive",
  pendiente: "warning",
  vencido: "negative",
};

const STATUS_LABEL: Record<MovementStatus, string> = {
  cobrado: "Cobrado",
  pendiente: "Pendiente",
  vencido: "Vencido",
};

type Filter = "todos" | MovementStatus;

interface TreasuryPanelProps {
  invoices?: Invoice[];
  reservations?: Reservation[];
  lang?: Lang;
  now?: Date;
  onAsk?: (topic: string) => void;
  onOpen?: (movement: Movement) => void;
  className?: string;
}

export function TreasuryPanel({
  invoices,
  reservations,
  lang = "es",
  now,
  onAsk,
  onOpen,
  className,
}: TreasuryPanelProps) {
  const [filter, setFilter] = useState<Filter>("todos");

  const team = useMemo(() => buildTeamOps(reservations), [reservations]);

  const snapshot = useMemo(
    () =>
      buildTreasury({
        invoices,
        reservations,
        now,
        teamCostByMonth: team.costByDepartureMonth,
        teamPayable: team.pendingCost,
      }),
    [invoices, reservations, now, team],
  );

  const visible = useMemo(
    () =>
      filter === "todos"
        ? snapshot.movements
        : snapshot.movements.filter((m) => m.status === filter),
    [snapshot.movements, filter],
  );

  const view = useMemo(() => totalsForView(visible), [visible]);

  const flow = snapshot.cashFlow;
  const lastClosed = flow.at(-2);
  const prevClosed = flow.at(-3);
  const collectedDelta =
    lastClosed && prevClosed ? deltaVsPrevious(lastClosed.cobrado, prevClosed.cobrado) : null;

  const sparkCollected = flow.map((p) => p.cobrado);
  const sparkPending = flow.map((p) => p.pendiente);

  const chartData = flow.map((p) => ({
    label: p.label,
    entradas: p.cobrado,
    salidas: p.salidas,
    prevision: p.pendiente,
  }));

  const counts: Record<Filter, number> = {
    todos: snapshot.movements.length,
    cobrado: snapshot.movements.filter((m) => m.status === "cobrado").length,
    pendiente: snapshot.movements.filter((m) => m.status === "pendiente").length,
    vencido: snapshot.movements.filter((m) => m.status === "vencido").length,
  };

  return (
    <div className={cn("space-y-5", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Caja"
          lang={lang}
          onAsk={onAsk ? () => onAsk("tesorería y caja") : undefined}
          metrics={[
            {
              label: "Cobrado",
              value: formatEur(snapshot.collected, lang),
              deltaPct: collectedDelta,
              spark: sparkCollected,
            },
            {
              label: "Pendiente de cobro",
              value: formatEur(snapshot.receivable, lang),
              helper:
                snapshot.overdue > 0 ? `${formatEur(snapshot.overdue, lang)} vencido` : "Al día",
              lowerIsBetter: true,
              spark: sparkPending,
            },
          ]}
          footnote="Variación del último mes cerrado frente al mismo punto del anterior."
        />

        <StatCard
          title="Cartera"
          lang={lang}
          onAsk={onAsk ? () => onAsk("cartera y coste de equipo") : undefined}
          metrics={[
            {
              label: "Comprometido",
              value: formatEur(snapshot.committed, lang),
              helper: "Saldos de reservas futuras",
            },
            {
              label: "Coste equipo",
              value: formatEur(snapshot.teamPayable, lang),
              helper: "Por pagar operativo · expediciones abiertas",
              lowerIsBetter: true,
            },
          ]}
          footnote="El coste de equipo se deriva de tour leaders × días · no es nómina."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ClosingProjection
          actual={snapshot.collected}
          receivable={snapshot.receivable}
          payable={snapshot.teamPayable}
          lang={lang}
          footnote={
            lang === "es"
              ? `Comprometido en reservas (aún no en cierre neto): ${formatEur(snapshot.committed, lang)}.`
              : `Committed bookings (not in net close): ${formatEur(snapshot.committed, lang)}.`
          }
        />
        <CashFlowChart
          data={chartData}
          lang={lang}
          title={lang === "es" ? "Flujo de caja" : "Cash flow"}
          subtitle={
            lang === "es"
              ? "Entradas, salidas de equipo y previsión · últimos meses."
              : "Inflows, team outflows and forecast · recent months."
          }
        />
      </div>

      {snapshot.byRoute.length > 0 ? (
        <section className="glass-panel rounded-2xl p-5">
          <header className="mb-3">
            <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              ¿De dónde viene el dinero?
            </h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Reparto por ruta. Misma dimensión que alimenta la tabla de abajo.
            </p>
          </header>
          <ul className="space-y-2.5">
            {snapshot.byRoute.map((r, i) => (
              <li key={r.route}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span style={{ color: "var(--text-primary)" }}>
                    {ROUTE_LABEL[r.route] ?? r.route}
                  </span>
                  <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {r.pct.toFixed(1)} % · {formatEur(r.amount, lang)}
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full"
                  style={{ background: "var(--neutral-soft)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${r.pct}%`,
                      background: i === 0 ? "var(--chart-area)" : "var(--chart-area-2)",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="glass-panel rounded-2xl p-5">
        <header className="mb-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Movimientos
          </h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Derivados de facturas y reservas. No hay banco conectado todavía.
          </p>
        </header>

        <ViewTotals
          className="mb-4"
          headline={{ label: "Total cobrado", value: formatEur(snapshot.collected, lang) }}
          totals={[
            { label: "Cobrado", value: formatEur(view.cobrado, lang), tone: "positive" },
            { label: "Pendiente", value: formatEur(view.pendiente, lang), tone: "negative" },
            { label: "Neto", value: formatEur(view.neto, lang) },
            { label: "Movimientos", value: String(view.count) },
          ]}
        />

        <div className="mb-3 flex flex-wrap gap-2">
          {(["todos", "cobrado", "pendiente", "vencido"] as Filter[]).map((tab) => {
            if (counts[tab] === 0 && tab !== "todos") return null;
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
                {tab === "todos" ? "Todos" : STATUS_LABEL[tab]}
                <span className="ml-1.5 tabular-nums opacity-70">{counts[tab]}</span>
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="mps-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Concepto</th>
                <th scope="col">Categoría</th>
                <th scope="col">Estado</th>
                <th scope="col" className="mps-num">
                  Importe
                </th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    {formatDate(m.date, lang)}
                  </td>
                  <td>
                    <span className="block" style={{ color: "var(--text-primary)" }}>
                      {m.concept}
                    </span>
                    <span className="block text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {m.counterparty}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{m.category}</td>
                  <td>
                    <StatusBadge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</StatusBadge>
                  </td>
                  <td
                    className="mps-num font-semibold"
                    style={{
                      color: m.status === "cobrado" ? "var(--positive)" : "var(--text-primary)",
                    }}
                  >
                    {formatEur(m.amount, lang)}
                  </td>
                  <td className="mps-num">
                    {onOpen && m.status !== "cobrado" ? (
                      <button
                        type="button"
                        onClick={() => onOpen(m)}
                        className="mps-choice rounded-lg px-2.5 py-1 text-xs font-semibold"
                      >
                        Revisar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center" style={{ color: "var(--text-tertiary)" }}>
                    Sin movimientos en esta vista.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
