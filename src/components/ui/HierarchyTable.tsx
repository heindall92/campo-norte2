import { useId, useState } from "react";

import { formatEur } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface HierarchyRow {
  /** 1 = epígrafe · 2 = detalle (se oculta al apagar el interruptor). */
  level: 1 | 2;
  label: string;
  amount: number | null;
  /** Fila calculada a partir de otras: lleva borde superior y peso. */
  derived?: boolean;
  /** Fila de cierre: fondo destacado (resultado del ejercicio, neto final). */
  final?: boolean;
}

interface HierarchyTableProps {
  rows: HierarchyRow[];
  caption?: string;
  /** Rótulos de las dos columnas. */
  headers?: [string, string];
  /** Texto del interruptor global. Si se omite, no hay interruptor. */
  detailToggleLabel?: string;
  lang?: Lang;
  className?: string;
}

/**
 * Tabla de estado financiero / desglose jerárquico.
 *
 * Dos decisiones deliberadas (docs/GAP-DEMO-ANATOMIA.md §1 y §2):
 *
 *  · Todas las filas son hermanas en el mismo <tbody>. La jerarquía se
 *    codifica en 4 ejes de estilo (sangría, peso, color, borde), no en
 *    componentes anidados.
 *
 *  · El detalle se controla con UN interruptor global, no con un acordeón
 *    por fila. En un estado financiero quieres comparar totales entre sí;
 *    un acordeón deja la tabla en estados mixtos donde eso es imposible.
 */
export function HierarchyTable({
  rows,
  caption,
  headers = ["Concepto", "Importe"],
  detailToggleLabel,
  lang = "es",
  className,
}: HierarchyTableProps) {
  const [showDetail, setShowDetail] = useState(true);
  const toggleId = useId();

  const visible = showDetail ? rows : rows.filter((r) => r.level === 1);

  return (
    <div className={className}>
      {(caption || detailToggleLabel) && (
        <div className="mb-2 flex items-center justify-between gap-3">
          {caption ? (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {caption}
            </p>
          ) : (
            <span />
          )}
          {detailToggleLabel ? (
            <label
              htmlFor={toggleId}
              className="flex cursor-pointer items-center gap-2 text-sm select-none"
              style={{ color: "var(--text-secondary)" }}
            >
              <input
                id={toggleId}
                type="checkbox"
                checked={showDetail}
                onChange={(e) => setShowDetail(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {detailToggleLabel}
            </label>
          ) : null}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="mps-table">
          <thead>
            <tr>
              <th scope="col">{headers[0]}</th>
              <th scope="col" className="mps-num">
                {headers[1]}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={`${row.label}-${i}`}
                className={cn(row.derived && "mps-row-derived", row.final && "mps-row-final")}
              >
                <td className={row.level === 1 ? "mps-row-l1" : "mps-row-l2"}>{row.label}</td>
                <td
                  className="mps-num"
                  style={
                    row.amount != null && row.amount < 0 && row.final
                      ? { color: "var(--negative)" }
                      : undefined
                  }
                >
                  {row.amount == null ? "—" : formatEur(row.amount, lang)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
