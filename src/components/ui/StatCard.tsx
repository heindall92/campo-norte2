import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { Sparkline } from "@/components/ui/Sparkline";
import { formatDelta } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface StatMetric {
  label: string;
  value: string;
  /** Variación en % frente al mismo punto del periodo anterior. */
  deltaPct?: number | null;
  /** Cuando bajar es bueno (gastos, tiempo de respuesta, leads fríos). */
  lowerIsBetter?: boolean;
  helper?: string;
  spark?: number[];
}

interface StatCardProps {
  /** Título de grupo en versalitas: TESORERÍA, INGRESOS… */
  title: string;
  /** Una o dos métricas relacionadas. Dos es el punto dulce. */
  metrics: StatMetric[];
  /** Abre el asistente con el contexto de esta tarjeta ya cargado. */
  onAsk?: () => void;
  askLabel?: string;
  footnote?: ReactNode;
  lang?: Lang;
  className?: string;
}

function DeltaBadge({
  pct,
  lowerIsBetter,
  lang,
}: {
  pct: number;
  lowerIsBetter: boolean;
  lang: Lang;
}) {
  const good = lowerIsBetter ? pct <= 0 : pct >= 0;
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold"
      style={{ color: good ? "var(--kpi-delta-up-fg)" : "var(--kpi-delta-down-fg)" }}
    >
      <Icon size={13} aria-hidden />
      {formatDelta(pct, lang)}
    </span>
  );
}

/**
 * Tarjeta KPI.
 *
 * Anatomía tomada del análisis en docs/GAP-DEMO-ANATOMIA.md:
 * etiqueta en versalitas · valor grande · delta con flecha y color semántico ·
 * sparkline · acción de IA arriba a la derecha · dos métricas relacionadas.
 *
 * El `footnote` existe para declarar la metodología de comparación. Un
 * dashboard que no dice contra qué compara no se cree.
 */
export function StatCard({
  title,
  metrics,
  onAsk,
  askLabel,
  footnote,
  lang = "es",
  className,
}: StatCardProps) {
  return (
    <section
      className={cn("glass-panel rounded-2xl p-4", className)}
      style={{ background: "var(--kpi-bg)", borderColor: "var(--kpi-border)" }}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <h3
          className="text-[0.68rem] font-semibold tracking-[0.08em] uppercase"
          style={{ color: "var(--kpi-label-fg)" }}
        >
          {title}
        </h3>
        {onAsk ? (
          <button
            type="button"
            onClick={onAsk}
            className="mps-ai-inline"
            aria-label={askLabel ?? `Preguntar al asistente sobre ${title}`}
            title={askLabel ?? `Preguntar al asistente sobre ${title}`}
          >
            <Sparkles size={15} aria-hidden />
          </button>
        ) : null}
      </header>

      <div className={cn("grid gap-4", metrics.length > 1 && "grid-cols-2")}>
        {metrics.map((m) => (
          <div key={m.label} className="min-w-0">
            <p className="text-xs" style={{ color: "var(--kpi-helper-fg)" }}>
              {m.label}
            </p>
            <p
              className="mt-0.5 truncate text-2xl leading-tight font-bold tabular-nums"
              style={{ color: "var(--kpi-value-fg)" }}
            >
              {m.value}
            </p>
            <div className="mt-1 flex min-h-[1.1rem] items-center gap-2">
              {typeof m.deltaPct === "number" ? (
                <DeltaBadge pct={m.deltaPct} lowerIsBetter={m.lowerIsBetter ?? false} lang={lang} />
              ) : null}
              {m.helper ? (
                <span className="truncate text-xs" style={{ color: "var(--kpi-helper-fg)" }}>
                  {m.helper}
                </span>
              ) : null}
            </div>
            {m.spark?.length ? <Sparkline data={m.spark} /> : null}
          </div>
        ))}
      </div>

      {footnote ? (
        <p className="mt-3 text-[0.68rem]" style={{ color: "var(--kpi-label-fg)" }}>
          {footnote}
        </p>
      ) : null}
    </section>
  );
}
