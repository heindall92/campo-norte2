import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatEur } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface CashFlowChartPoint {
  label: string;
  entradas: number;
  salidas: number;
  prevision: number;
}

interface CashFlowChartProps {
  data: CashFlowChartPoint[];
  lang?: Lang;
  height?: number;
  className?: string;
  title?: string;
  subtitle?: string;
}

function axisTick() {
  return { fill: "var(--chart-tick)", fontSize: 11 };
}

/**
 * Flujo de caja con la estructura de la demo de referencia:
 * entradas (verde) · salidas (rojo) · previsión (ámbar).
 * Colores vía tokens --chart-bar-*; estética glass camponorte.
 */
export function CashFlowChart({
  data,
  lang = "es",
  height = 240,
  className,
  title,
  subtitle,
}: CashFlowChartProps) {
  return (
    <section className={cn("glass-panel rounded-2xl p-5", className)}>
      {(title || subtitle) && (
        <header className="mb-3">
          {title ? (
            <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {title}
            </h3>
          ) : null}
          {subtitle ? (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </p>
          ) : null}
        </header>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={axisTick()} axisLine={false} tickLine={false} />
            <YAxis
              tick={axisTick()}
              axisLine={false}
              tickLine={false}
              width={62}
              tickFormatter={(v: number) => formatEur(v, lang)}
            />
            <Tooltip
              cursor={{ fill: "var(--chart-cursor)" }}
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                border: "1px solid var(--chart-tooltip-border)",
                borderRadius: 12,
                color: "var(--text-primary)",
              }}
              formatter={(v) => formatEur(Number(v ?? 0), lang)}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
            <Bar
              dataKey="entradas"
              name={lang === "es" ? "Entradas" : "Inflows"}
              fill="var(--chart-bar-in)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="salidas"
              name={lang === "es" ? "Salidas equipo" : "Team outflows"}
              fill="var(--chart-bar-out)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="prevision"
              name={lang === "es" ? "Previsión cobro" : "Receivable forecast"}
              fill="var(--chart-bar-forecast)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
