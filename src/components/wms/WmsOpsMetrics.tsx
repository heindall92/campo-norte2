import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  computeCostStructure,
  computeProductivity,
  computeUnitOpCosts,
  ROLE_FLOOR_LABEL,
  SHIFT_LABEL,
  ZONE_LABEL,
  type ProductivityRates,
} from "@/lib/wms";
import { useWmsLive } from "./useWmsLive";

function rate(n: number | null): string {
  return n == null ? "—" : String(n);
}

function subjectLabel(row: ProductivityRates, lang: Lang): string {
  if (row.subject === "shift") return SHIFT_LABEL[row.subjectId as keyof typeof SHIFT_LABEL]?.[lang] ?? row.subjectId;
  if (row.subject === "zone") return ZONE_LABEL[row.subjectId as keyof typeof ZONE_LABEL]?.[lang] ?? row.subjectId;
  if (row.subject === "picker") return `${ROLE_FLOOR_LABEL.picker[lang]} ${row.subjectId}`;
  if (row.subject === "packer") return `${ROLE_FLOOR_LABEL.expedicion[lang]} ${row.subjectId}`;
  if (row.subject === "forklift") return `${ROLE_FLOOR_LABEL.carretillero[lang]} ${row.subjectId}`;
  return row.subjectId;
}

export function WmsOpsMetrics({ lang, siteId }: { lang: Lang; siteId: string }) {
  const { snap } = useWmsLive();
  const prod = computeProductivity(snap, siteId).filter(
    (r) => r.subject === "warehouse" || r.subject === "shift" || (r.sampleLines > 0 && r.hours > 0),
  );
  const costs = computeUnitOpCosts(snap, "2026-08", siteId);
  const structure = computeCostStructure(snap, "2026-08", siteId);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card
        title={lang === "es" ? "Productividad" : "Productivity"}
        subtitle={
          lang === "es"
            ? "Códigos y turnos · no es vigilancia · sin nombre/PIN/huella"
            : "Codes and shifts · not surveillance · no name/PIN/fingerprint"
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-xs text-[var(--ink)]">
            <thead>
              <tr className="text-[var(--ink-muted)]">
                <th className="py-1 font-medium">{lang === "es" ? "Sujeto" : "Subject"}</th>
                <th>l/h</th>
                <th>u/h</th>
                <th>ped/h</th>
                <th>%</th>
                <th>m</th>
                <th>min</th>
              </tr>
            </thead>
            <tbody>
              {prod.slice(0, 12).map((row) => (
                <tr key={`${row.subject}-${row.subjectId}`}>
                  <td className="py-1 font-mono">{subjectLabel(row, lang)}</td>
                  <td>{rate(row.linesPerHour)}</td>
                  <td>{rate(row.unitsPerHour)}</td>
                  <td>{rate(row.ordersPerHour)}</td>
                  <td>{rate(row.pickAccuracyPct)}</td>
                  <td>{rate(row.travelDistanceM)}</td>
                  <td>{rate(row.avgTaskMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[var(--ink-muted)]">
          {lang === "es"
            ? "Distancia estimada por pasillo/bahía/nivel. Horas = hoursToday del snapshot."
            : "Distance estimated from aisle/bay/level. Hours = snapshot hoursToday."}
        </p>
      </Card>

      <Card
        title={lang === "es" ? "Costes unitarios" : "Unit costs"}
        subtitle={lang === "es" ? "Tarifa 3PL + nómina de hoy + terceros del mes" : "3PL tariff + today's labor + month carriers"}
      >
        <ul className="grid grid-cols-2 gap-2 text-sm text-[var(--ink)]">
          <li>
            cost/order · <strong>{costs.costPerOrderEur.toFixed(2)} €</strong>
          </li>
          <li>
            cost/line · <strong>{costs.costPerLineEur.toFixed(2)} €</strong>
          </li>
          <li>
            cost/pallet · <strong>{costs.costPerPalletEur.toFixed(2)} €</strong>
          </li>
          <li>
            cost/pick · <strong>{costs.costPerPickEur.toFixed(2)} €</strong>
          </li>
          <li>
            cost/ship · <strong>{costs.costPerShipEur.toFixed(2)} €</strong>
          </li>
        </ul>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          {lang === "es" ? "Estructura" : "Structure"}
        </p>
        <ul className="mt-1 space-y-1 text-xs text-[var(--ink)]">
          <li>
            <Badge tone="neutral">labor</Badge> {structure.laborEur.toFixed(0)} € · {structure.laborSource}
          </li>
          <li>
            <Badge tone="neutral">carrier</Badge> {structure.carrierEur.toFixed(0)} € · {structure.carrierSource}
          </li>
          <li>
            <Badge tone="neutral">handling</Badge> {structure.handlingEur.toFixed(0)} € · {structure.handlingSource}
          </li>
          <li>
            <Badge tone="neutral">storage</Badge> {structure.storageEur.toFixed(0)} € · {structure.storageSource}
          </li>
        </ul>
      </Card>
    </div>
  );
}
