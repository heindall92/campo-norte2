/**
 * Cuenta de resultados operativa — solo datos del Hub.
 *
 * No inventa nóminas ni extractos bancarios. Traduce el patrón P&G de la
 * demo de referencia a lo que Campo Norte sí tiene: facturas cobradas, coste de
 * expediciones (demo) y coste de equipo estimado (team-ops).
 */

import { routeMargins } from "@/lib/demo-data";
import type { HierarchyRow } from "@/components/ui/HierarchyTable";
import type { Invoice } from "@/lib/ops-data";
import { buildTeamOps } from "@/lib/team-ops";
import type { Reservation } from "@/lib/ops-data";

export interface PnLSnapshot {
  revenue: number;
  expeditionCost: number;
  teamCost: number;
  grossMargin: number;
  operatingResult: number;
  rows: HierarchyRow[];
}

export function buildPnL(input: {
  invoices?: Invoice[];
  reservations?: Reservation[];
}): PnLSnapshot {
  const invoices = input.invoices ?? [];
  const reservations = input.reservations ?? [];

  let revenue = 0;
  const byExpedition = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status === "anulada" || inv.status === "borrador") continue;
    const collected = inv.amountCollected > 0 ? inv.amountCollected : 0;
    // Ingreso reconocido = cobrado real (honesto). Pendiente no es ingreso.
    revenue += collected;
    if (collected > 0) {
      byExpedition.set(inv.expedition, (byExpedition.get(inv.expedition) ?? 0) + collected);
    }
  }

  const margins = routeMargins();
  const expeditionCost = margins.reduce((s, m) => s + m.cost, 0);
  const team = buildTeamOps(reservations);
  const teamCost = team.pendingCost + team.closedCost;

  const grossMargin = revenue - expeditionCost;
  const operatingResult = grossMargin - teamCost;

  const rows: HierarchyRow[] = [
    { level: 1, label: "Importe neto de la cifra de negocios", amount: revenue },
    ...[...byExpedition.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, amount]) => ({
        level: 2 as const,
        label: `Cobrado · ${label}`,
        amount,
      })),
    {
      level: 1,
      label: "Coste de expediciones",
      amount: -expeditionCost,
      derived: true,
    },
    ...margins
      .filter((m) => m.cost > 0)
      .slice(0, 8)
      .map((m) => ({
        level: 2 as const,
        label: `${m.id} · ${m.name}`,
        amount: -m.cost,
      })),
    {
      level: 1,
      label: "Margen bruto operativo",
      amount: grossMargin,
      derived: true,
    },
    {
      level: 1,
      label: "Coste de equipo (estimado)",
      amount: -teamCost,
    },
    {
      level: 2,
      label: "Dietas guía/ops × días de itinerario",
      amount: -teamCost,
    },
    {
      level: 1,
      label: "Resultado operativo",
      amount: operatingResult,
      derived: true,
      final: true,
    },
    {
      level: 1,
      label: "Gastos de personal (nómina)",
      amount: null,
    },
    {
      level: 2,
      label: "Sin datos de nómina en el Hub — no se inventa",
      amount: null,
    },
  ];

  return { revenue, expeditionCost, teamCost, grossMargin, operatingResult, rows };
}
