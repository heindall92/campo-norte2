import { cn } from "@/lib/utils";

export interface ViewTotal {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}

interface ViewTotalsProps {
  /** Cifra que NO depende del filtro (saldo real, total de la cartera). */
  headline?: { label: string; value: string };
  /** Cifras recalculadas sobre las filas visibles. */
  totals: ViewTotal[];
  /** Rótulo del bloque filtrado. Cambiarlo es casi siempre un error. */
  scopeLabel?: string;
  className?: string;
}

const TONE_COLOR = {
  positive: "var(--positive)",
  negative: "var(--negative)",
  neutral: "var(--text-primary)",
} as const;

/**
 * Agregados de una tabla filtrada.
 *
 * El patrón clave (docs/GAP-DEMO-ANATOMIA.md §3): los totales se recalculan
 * con el filtro aplicado Y se dice explícitamente con el rótulo "EN ESTA
 * VISTA". Sin ese rótulo el usuario nunca sabe si el total corresponde a lo
 * que está mirando o a todo el conjunto, y deja de fiarse de ambos.
 */
export function ViewTotals({
  headline,
  totals,
  scopeLabel = "EN ESTA VISTA",
  className,
}: ViewTotalsProps) {
  return (
    <div className={cn("flex flex-wrap items-end gap-x-8 gap-y-3", className)}>
      {headline ? (
        <div>
          <p
            className="text-[0.68rem] font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            {headline.label}
          </p>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {headline.value}
          </p>
        </div>
      ) : null}

      <div>
        <p
          className="text-[0.68rem] font-semibold tracking-[0.08em] uppercase"
          style={{ color: "var(--text-tertiary)" }}
        >
          {scopeLabel}
        </p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          {totals.map((t) => (
            <span key={t.label} className="text-sm">
              <span style={{ color: "var(--text-secondary)" }}>{t.label} </span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: TONE_COLOR[t.tone ?? "neutral"] }}
              >
                {t.value}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
