import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

interface SparklineProps {
  data: number[];
  /** Color explícito; por defecto el slot de KPI. */
  stroke?: string;
  height?: number;
  /** Colorea según la tendencia (último vs primero) en vez de usar `stroke`. */
  trendColored?: boolean;
}

/**
 * Línea de tendencia sin ejes ni tooltip: acompaña a una cifra, no la sustituye.
 * Deliberadamente muda — si el usuario necesita leer valores concretos, el
 * sitio correcto es una tabla, no un sparkline.
 */
export function Sparkline({ data, stroke, height = 40, trendColored = false }: SparklineProps) {
  if (data.length < 2) return <div style={{ height }} aria-hidden />;

  const points = data.map((value, i) => ({ i, value }));
  const rising = (data.at(-1) ?? 0) >= (data[0] ?? 0);
  const color = trendColored
    ? `var(${rising ? "--positive" : "--negative"})`
    : (stroke ?? "var(--kpi-spark-stroke)");

  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
