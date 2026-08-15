import { formatEur } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface ClosingProjectionProps {
  /** Caja ya en mano. */
  actual: number;
  /** Por cobrar (facturas / saldos). */
  receivable: number;
  /** Por pagar operativo (p. ej. coste de equipo en expediciones abiertas). */
  payable: number;
  lang?: Lang;
  className?: string;
  footnote?: string;
}

/**
 * Proyección de cierre — barra tricolor al estilo de la demo de referencia,
 * con tokens propios (--projection-*).
 *
 *   estimado = actual + por cobrar − por pagar
 */
export function ClosingProjection({
  actual,
  receivable,
  payable,
  lang = "es",
  className,
  footnote,
}: ClosingProjectionProps) {
  const estimated = actual + receivable - payable;
  const total = Math.max(actual + receivable + payable, 1);
  const pct = {
    actual: (actual / total) * 100,
    receivable: (receivable / total) * 100,
    payable: (payable / total) * 100,
  };

  return (
    <section className={cn("glass-panel rounded-2xl p-5", className)}>
      <header className="mb-3">
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          {lang === "es" ? "Proyección de cierre" : "Closing projection"}
        </h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {lang === "es"
            ? "Actual + por cobrar − coste de equipo pendiente."
            : "Actual + receivable − pending team cost."}
        </p>
      </header>

      <p
        className="font-[family-name:var(--mps-display)] text-3xl tabular-nums"
        style={{ color: "var(--text-primary)" }}
      >
        {formatEur(estimated, lang)}
      </p>
      <p className="mt-1 text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
        {formatEur(actual, lang)}{" "}
        {lang === "es" ? "actual" : "actual"} + {formatEur(receivable, lang)}{" "}
        {lang === "es" ? "por cobrar" : "receivable"} − {formatEur(payable, lang)}{" "}
        {lang === "es" ? "por pagar" : "payable"}
      </p>

      <div
        className="mt-4 flex h-3 overflow-hidden rounded-full"
        style={{ background: "var(--neutral-soft)" }}
        role="img"
        aria-label={lang === "es" ? "Composición de la proyección" : "Projection breakdown"}
      >
        <span style={{ width: `${pct.actual}%`, background: "var(--projection-actual)" }} />
        <span style={{ width: `${pct.receivable}%`, background: "var(--projection-in)" }} />
        <span style={{ width: `${pct.payable}%`, background: "var(--projection-out)" }} />
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--projection-actual)" }} />
          {lang === "es" ? "Actual" : "Actual"}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--projection-in)" }} />
          {lang === "es" ? "Por cobrar" : "Receivable"}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--projection-out)" }} />
          {lang === "es" ? "Coste equipo" : "Team cost"}
        </li>
      </ul>

      {footnote ? (
        <p className="mt-3 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {footnote}
        </p>
      ) : null}
    </section>
  );
}
