import { HierarchyTable } from "@/components/ui/HierarchyTable";
import { formatEur } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import type { Invoice, Reservation } from "@/lib/ops-data";
import { buildPnL } from "@/lib/pnl";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface PnLPanelProps {
  invoices?: Invoice[];
  reservations?: Reservation[];
  lang?: Lang;
  className?: string;
}

/**
 * Análisis financiero operativo (P&G adaptado).
 * Misma anatomía que la demo de referencia (toggle de detalle + jerarquía),
 * con datos del Hub y huecos honestos donde no hay nómina.
 */
export function PnLPanel({ invoices, reservations, lang = "es", className }: PnLPanelProps) {
  const snap = useMemo(() => buildPnL({ invoices, reservations }), [invoices, reservations]);

  return (
    <section className={cn("glass-panel rounded-2xl p-5", className)}>
      <header className="mb-4">
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          {lang === "es" ? "Pérdidas y ganancias (operativo)" : "Profit & loss (ops)"}
        </h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {lang === "es"
            ? "Ingresos cobrados − coste de expediciones − coste de equipo. Sin inventar nómina."
            : "Collected revenue − expedition cost − team cost. No invented payroll."}
        </p>
      </header>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>
            {lang === "es" ? "Ingresos cobrados" : "Collected revenue"}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: "var(--positive)" }}>
            {formatEur(snap.revenue, lang)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>
            {lang === "es" ? "Margen bruto" : "Gross margin"}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatEur(snap.grossMargin, lang)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>
            {lang === "es" ? "Resultado operativo" : "Operating result"}
          </p>
          <p
            className="mt-1 text-xl font-semibold tabular-nums"
            style={{ color: snap.operatingResult < 0 ? "var(--negative)" : "var(--text-primary)" }}
          >
            {formatEur(snap.operatingResult, lang)}
          </p>
        </div>
      </div>

      <HierarchyTable
        rows={snap.rows}
        lang={lang}
        detailToggleLabel={lang === "es" ? "Ver detalle por cuenta" : "Show account detail"}
        caption={lang === "es" ? "Formato de cuentas anuales · datos del Hub" : "Annual-accounts layout · Hub data"}
      />
    </section>
  );
}
