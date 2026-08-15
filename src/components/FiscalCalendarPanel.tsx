import { useMemo, useState } from "react";

import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { formatDate, formatEur } from "@/lib/format";
import { buildFiscalCalendar, upcomingDeadlines, type FiscalDeadline } from "@/lib/fiscal-calendar";
import type { Lang } from "@/lib/i18n";
import type { Invoice } from "@/lib/ops-data";
import { cn } from "@/lib/utils";

interface FiscalCalendarPanelProps {
  invoices?: Invoice[];
  lang?: Lang;
  now?: Date;
  className?: string;
}

type QuarterFilter = "all" | "T1" | "T2" | "T3" | "T4" | "Anual";

function toneFor(days: number): { tone: StatusTone; label: string } {
  if (days < 0) return { tone: "negative", label: "Vencido" };
  if (days <= 15) return { tone: "warning", label: "Próximo" };
  return { tone: "info", label: "Programado" };
}

function periodBucket(period: string): QuarterFilter {
  if (period.startsWith("Anual")) return "Anual";
  const m = period.match(/^T([1-4])/);
  if (m) return `T${m[1]}` as QuarterFilter;
  return "all";
}

/**
 * Calendario fiscal con importe estimado + filtro de trimestre / timeline.
 *
 * El importe se calcula desde las facturas del Hub, así que se etiqueta
 * siempre como estimación. Los modelos sin dato (111, 200) se listan sin cifra.
 */
export function FiscalCalendarPanel({
  invoices,
  lang = "es",
  now,
  className,
}: FiscalCalendarPanelProps) {
  const [filter, setFilter] = useState<QuarterFilter>("all");

  const deadlines = useMemo(
    () => upcomingDeadlines(buildFiscalCalendar({ invoices, now })),
    [invoices, now],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return deadlines;
    return deadlines.filter((d) => periodBucket(d.period) === filter);
  }, [deadlines, filter]);

  const overdue = filtered.filter((d) => d.daysToDue < 0).length;

  const filters: { id: QuarterFilter; label: string }[] = [
    { id: "all", label: lang === "es" ? "Todos" : "All" },
    { id: "T1", label: "T1" },
    { id: "T2", label: "T2" },
    { id: "T3", label: "T3" },
    { id: "T4", label: "T4" },
    { id: "Anual", label: lang === "es" ? "Anual" : "Annual" },
  ];

  return (
    <section className={cn("glass-panel rounded-2xl p-5", className)}>
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {lang === "es" ? "Calendario fiscal" : "Tax calendar"}
          </h3>
          {overdue > 0 ? (
            <StatusBadge tone="negative">
              {overdue} {lang === "es" ? "vencidos" : "overdue"}
            </StatusBadge>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          {lang === "es" ? (
            <>
              Vencimientos AEAT por urgencia. Los importes son{" "}
              <strong>estimaciones</strong> a partir de tus facturas, no autoliquidaciones.
            </>
          ) : (
            <>
              AEAT deadlines by urgency. Amounts are <strong>estimates</strong> from invoices, not
              filings.
            </>
          )}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn("mps-choice rounded-full px-3 py-1 text-xs font-semibold", filter === f.id && "is-active")}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ol className="relative mb-5 space-y-3 border-l border-[var(--border-subtle)] pl-4">
        {filtered.slice(0, 6).map((d) => (
          <TimelineChip key={`tl-${d.id}`} deadline={d} lang={lang} />
        ))}
        {filtered.length === 0 ? (
          <li className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            {lang === "es" ? "Sin hitos en este filtro." : "No deadlines in this filter."}
          </li>
        ) : null}
      </ol>

      <div className="overflow-x-auto">
        <table className="mps-table">
          <thead>
            <tr>
              <th scope="col">{lang === "es" ? "Modelo" : "Form"}</th>
              <th scope="col">{lang === "es" ? "Periodo" : "Period"}</th>
              <th scope="col">{lang === "es" ? "Vence" : "Due"}</th>
              <th scope="col">{lang === "es" ? "Estado" : "Status"}</th>
              <th scope="col" className="mps-num">
                {lang === "es" ? "Estimado" : "Estimate"}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const { tone, label } = toneFor(d.daysToDue);
              return (
                <tr key={d.id}>
                  <td>
                    <span className="block font-semibold" style={{ color: "var(--text-primary)" }}>
                      Modelo {d.model}
                    </span>
                    <span className="block text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {d.title}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{d.period}</td>
                  <td className="whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    {formatDate(d.dueAt, lang)}
                  </td>
                  <td>
                    <StatusBadge tone={tone}>
                      {lang === "es"
                        ? label
                        : d.daysToDue < 0
                          ? "Overdue"
                          : d.daysToDue <= 15
                            ? "Soon"
                            : "Scheduled"}
                    </StatusBadge>
                  </td>
                  <td className="mps-num" title={d.basis ?? undefined}>
                    {d.estimated == null ? (
                      <span
                        style={{ color: "var(--text-tertiary)" }}
                        title={
                          lang === "es"
                            ? "Requiere nóminas o contabilidad completa"
                            : "Needs payroll or full accounting"
                        }
                      >
                        —
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-primary)" }}>
                        ≈ {formatEur(d.estimated, lang)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[0.68rem]" style={{ color: "var(--text-tertiary)" }}>
        {lang === "es"
          ? "Fechas ordinarias; no se modelan festivos autonómicos ni prórrogas. Un guion significa que el dato no está en el sistema, no que el importe sea cero. Esto no sustituye a tu gestoría."
          : "Ordinary dates; regional holidays and extensions are not modeled. A dash means the datum is missing, not zero. This does not replace your tax advisor."}
      </p>
    </section>
  );
}

function TimelineChip({ deadline, lang }: { deadline: FiscalDeadline; lang: Lang }) {
  const { tone } = toneFor(deadline.daysToDue);
  return (
    <li className="relative">
      <span
        className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full border-2"
        style={{
          borderColor:
            tone === "negative"
              ? "var(--negative)"
              : tone === "warning"
                ? "var(--warning)"
                : "var(--accent)",
          background: "var(--surface-elevated)",
        }}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {deadline.model} · {deadline.period}
          </p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {deadline.title}
          </p>
        </div>
        <p className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {formatDate(deadline.dueAt, lang)}
          {deadline.estimated != null ? ` · ≈ ${formatEur(deadline.estimated, lang)}` : ""}
        </p>
      </div>
    </li>
  );
}
