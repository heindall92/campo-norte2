import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  appendAuditLog,
  assignWaveOperator,
  computeTowerPulse,
  listAuditLogs,
  localDeviceId,
  navigateWmsSection,
  recommendTowerActions,
  WMS_DEMO_NOW,
} from "@/lib/wms";
import { ClipboardList, Radio, Shield } from "lucide-react";
import { useState } from "react";
import { useWmsLive } from "./useWmsLive";

export function WmsTowerOps({ lang, siteId }: { lang: Lang; siteId: string }) {
  const { snap, commit } = useWmsLive();
  const now = new Date(WMS_DEMO_NOW);
  const pulse = computeTowerPulse(snap, siteId, now);
  const actions = recommendTowerActions(snap, siteId, now);
  const logs = listAuditLogs(snap, siteId, 8);
  const pickers = snap.operators.filter((o) => o.siteId === siteId && o.active && !o.vacant);
  const [pickerId, setPickerId] = useState(pickers.find((o) => o.role === "picker")?.id ?? pickers[0]?.id ?? "");

  function assignPicker(waveId: string) {
    if (!pickerId) return;
    const before = snap.pickWaves.find((w) => w.id === waveId)?.operatorId ?? null;
    const result = assignWaveOperator(snap, waveId, pickerId);
    if (!result.ok) return;
    commit(
      appendAuditLog(result.snap, {
        actorId: pickerId,
        warehouseId: siteId,
        action: "wave.assign_picker",
        entity: "pick_wave",
        entityId: waveId,
        beforeData: { operatorId: before },
        afterData: { operatorId: pickerId },
        reason: "tower_assign_picker",
        deviceId: localDeviceId(),
        correlationId: `tower-assign-${waveId}`,
      }),
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card
        title={lang === "es" ? "¿Qué está pasando?" : "What's happening?"}
        subtitle={lang === "es" ? "Solo cifras del snapshot" : "Snapshot figures only"}
      >
        <ul className="grid grid-cols-2 gap-2 text-sm text-[var(--ink)]">
          <li>
            {lang === "es" ? "Stock disponible" : "Stock availability"} ·{" "}
            <strong>{pulse.stockAvailabilityPct}%</strong>
          </li>
          <li>
            {lang === "es" ? "Pedidos pendientes" : "Orders pending"} · <strong>{pulse.ordersPending}</strong>
          </li>
          <li>
            {lang === "es" ? "Olas" : "Waves"} · <strong>{pulse.wavesOpen}</strong>
          </li>
          <li>
            {lang === "es" ? "Picking" : "Picking"} ·{" "}
            <strong>
              {pulse.pickingProgressPct}% · {pulse.pickDone}/{pulse.pickDone + pulse.pickOpen}
            </strong>
          </li>
          <li>
            {lang === "es" ? "Retraso recepción" : "Receiving delays"} · <strong>{pulse.asnDelayed}</strong>
          </li>
          <li>
            {lang === "es" ? "Ocupación muelle" : "Dock occupancy"} ·{" "}
            <strong>
              {pulse.dockOccupancyPct}% · {pulse.dockBusy}/{pulse.dockTotal}
            </strong>
          </li>
          <li>
            {lang === "es" ? "Riesgo expedición" : "Shipment risk"} · <strong>{pulse.shipmentRisk}</strong>
          </li>
          <li>
            {lang === "es" ? "Cobertura turno" : "Workforce coverage"} ·{" "}
            <strong>{pulse.workforceCoveragePct}%</strong>
          </li>
          <li>
            {lang === "es" ? "Flota" : "Fleet"} ·{" "}
            <strong>
              {pulse.fleetOperative}/{pulse.fleetTotal}
              {pulse.fleetDown ? ` · ${pulse.fleetDown} down` : ""}
            </strong>
          </li>
          <li>
            {lang === "es" ? "Incidencias" : "Incidents"} · <strong>{pulse.incidents}</strong>
          </li>
          <li>
            {lang === "es" ? "Cut-off riesgo" : "Cut-off risk"} · <strong>{pulse.cutOffRisk}</strong>
          </li>
          <li>
            {lang === "es" ? "Palets vivos" : "Live pallets"} · <strong>{pulse.livePallets}</strong>
          </li>
        </ul>
      </Card>

      <Card
        title={lang === "es" ? "¿Qué debo hacer?" : "What should I do?"}
        subtitle={lang === "es" ? "Acciones de olas y ASN reales" : "Actions from real waves and ASN"}
      >
        {actions.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            {lang === "es" ? "Nada urgente en este centro." : "Nothing urgent at this site."}
          </p>
        ) : (
          <ul className="space-y-2">
            {actions.map((a) => (
              <li key={a.id} className="rounded-xl bg-[var(--field-bg)] px-3 py-2">
                <p className="text-sm text-[var(--ink)]">{lang === "es" ? a.titleEs : a.titleEn}</p>
                {a.kind === "ASSIGN_PICKER" && a.waveId ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
                      value={pickerId}
                      onChange={(e) => setPickerId(e.target.value)}
                    >
                      {pickers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code} · {o.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]"
                      onClick={() => assignPicker(a.waveId!)}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      {lang === "es" ? a.actionEs : a.actionEn}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]"
                    onClick={() => navigateWmsSection(a.section, { waveId: a.waveId, orderId: a.orderId })}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    {lang === "es" ? a.actionEs : a.actionEn}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={lang === "es" ? "Auditoría" : "Audit"}
        subtitle={lang === "es" ? "Solo lectura · no se puede borrar" : "Read-only · cannot delete"}
      >
        <p className="mb-2 inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
          <Shield className="h-3.5 w-3.5" />
          {logs.length
            ? lang === "es"
              ? `${logs.length} últimos · append-only`
              : `${logs.length} latest · append-only`
            : lang === "es"
              ? "Aún no hay mutaciones auditadas en este dispositivo"
              : "No audited mutations on this device yet"}
        </p>
        <ul className="space-y-1 text-xs text-[var(--ink)]">
          {logs.map((row) => (
            <li key={row.id}>
              <Badge tone="neutral">{row.action}</Badge> {row.entity} {row.entityId}
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title={lang === "es" ? "RF / PDA" : "RF / PDA"}
        subtitle="SCAN LOCATION → SCAN SKU → CONFIRM QTY → COMPLETE"
      >
        <p className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-muted)]">
          <Radio className="h-4 w-4" />
          {lang === "es"
            ? "La pistola ya sigue ese flujo. Sin red, la cola offline guarda el evento; al volver se aplica o queda en conflicto. No se inventa stock."
            : "The RF gun already follows that flow. Offline, the queue stores the event; on reconnect it applies or conflicts. Stock is not invented."}
        </p>
      </Card>
    </div>
  );
}
