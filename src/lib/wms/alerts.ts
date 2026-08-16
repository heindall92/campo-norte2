import type { WmsSnapshot } from "./types";
import { proposeReplenishments } from "./movements";

export const WMS_DEMO_NOW = "2026-08-15T11:00:00.000Z";

export type WmsAlertKind = "bateria" | "caducidad" | "cut_off" | "pick_face" | "bloqueo" | "merma" | "faltante";
export type WmsAlertSeverity = "info" | "warn" | "critical";

export interface WmsAlert {
  id: string;
  kind: WmsAlertKind;
  severity: WmsAlertSeverity;
  titleEs: string;
  titleEn: string;
  detailEs: string;
  detailEn: string;
  siteId: string;
  entityId?: string;
}

const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const CUTOFF_WARN_MS = 2 * 60 * 60 * 1000;
const BATTERY_MIN = 25;

export function computeWmsAlerts(
  snap: WmsSnapshot,
  now = new Date(WMS_DEMO_NOW),
  siteId?: string,
): WmsAlert[] {
  const nowMs = now.getTime();
  const alerts: WmsAlert[] = [];
  const inSite = (id: string) => !siteId || id === siteId;

  for (const unit of snap.fleet) {
    if (!inSite(unit.siteId)) continue;
    if (unit.batteryPct == null || unit.batterySource === "unknown") continue;
    if (unit.batteryPct >= BATTERY_MIN) continue;
    const sourceEs =
      unit.batterySource === "manual" ? "reporte manual" : "último reporte de semilla (no es el cargador)";
    const sourceEn =
      unit.batterySource === "manual" ? "manual report" : "seed last report (not the wall charger)";
    alerts.push({
      id: `bat-${unit.id}`,
      kind: "bateria",
      severity: unit.batteryPct < 15 ? "critical" : "warn",
      titleEs: `Batería ${unit.code} al ${unit.batteryPct}%`,
      titleEn: `Battery ${unit.code} at ${unit.batteryPct}%`,
      detailEs: `${unit.brand} ${unit.model} · ${sourceEs}`,
      detailEn: `${unit.brand} ${unit.model} · ${sourceEn}`,
      siteId: unit.siteId,
      entityId: unit.id,
    });
  }

  let expiryShown = 0;
  for (const pallet of snap.pallets) {
    if (!inSite(pallet.siteId) || pallet.status === "expedido" || !pallet.expiry) continue;
    const left = new Date(pallet.expiry).getTime() - nowMs;
    if (left > EXPIRY_MS) continue;
    if (expiryShown >= 8) continue;
    expiryShown += 1;
    const slot = pallet.slotId ? snap.slots.find((s) => s.id === pallet.slotId) : null;
    const expired = left <= 0;
    alerts.push({
      id: `exp-${pallet.id}`,
      kind: "caducidad",
      severity: expired ? "critical" : "warn",
      titleEs: expired ? `Caducado ${pallet.sscc}` : `Caduca ${pallet.expiry.slice(0, 10)} · ${pallet.sscc}`,
      titleEn: expired ? `Expired ${pallet.sscc}` : `Expires ${pallet.expiry.slice(0, 10)} · ${pallet.sscc}`,
      detailEs: slot ? `Hueco ${slot.code}` : "Sin hueco",
      detailEn: slot ? `Slot ${slot.code}` : "No slot",
      siteId: pallet.siteId,
      entityId: pallet.id,
    });
  }

  for (const order of snap.outbound) {
    if (!inSite(order.siteId) || order.status === "expedido") continue;
    const cut = new Date(order.cutOff).getTime();
    const delta = cut - nowMs;
    if (delta > CUTOFF_WARN_MS) continue;
    const overdue = delta < 0;
    alerts.push({
      id: `cut-${order.id}`,
      kind: "cut_off",
      severity: overdue ? "critical" : "warn",
      titleEs: overdue ? `Cut-off vencido · ${order.code}` : `Cut-off en ${Math.round(delta / 60000)} min · ${order.code}`,
      titleEn: overdue ? `Cut-off missed · ${order.code}` : `Cut-off in ${Math.round(delta / 60000)} min · ${order.code}`,
      detailEs: `${order.customer} · muelle ${order.dock}`,
      detailEn: `${order.customer} · dock ${order.dock}`,
      siteId: order.siteId,
      entityId: order.id,
    });
  }

  for (const slot of snap.slots) {
    if (!inSite(slot.siteId) || slot.status !== "bloqueado") continue;
    alerts.push({
      id: `blk-${slot.id}`,
      kind: "bloqueo",
      severity: "info",
      titleEs: `Hueco bloqueado ${slot.code}`,
      titleEn: `Blocked slot ${slot.code}`,
      detailEs: "No asignar putaway ni picking hasta liberar",
      detailEn: "Do not assign putaway or picking until released",
      siteId: slot.siteId,
      entityId: slot.id,
    });
  }

  for (const fix of snap.slotFixes) {
    if (fix.status !== "pendiente" || !inSite(fix.siteId)) continue;
    const slot = snap.slots.find((s) => s.id === fix.slotId);
    const sku = snap.skus.find((s) => s.id === fix.skuId);
    alerts.push({
      id: `falt-${fix.id}`,
      kind: "faltante",
      severity: "warn",
      titleEs: `Faltante en hueco ${slot?.code ?? fix.slotId}`,
      titleEn: `Slot shortage ${slot?.code ?? fix.slotId}`,
      detailEs: `Sistema ${fix.systemQty} · ticket ${fix.takeQty} · ${sku?.name ?? "artículo"}. El jefe tiene que cuadrar el hueco; el operario no va a la oficina.`,
      detailEn: `System ${fix.systemQty} · ticket ${fix.takeQty} · ${sku?.name ?? "item"}. The lead must fix the slot; the picker does not walk to the office.`,
      siteId: fix.siteId,
      entityId: fix.id,
    });
  }

  for (const event of snap.mermaEvents) {
    if (!inSite(event.siteId)) continue;
    if (event.at.slice(0, 10) !== now.toISOString().slice(0, 10)) continue;
    const sku = snap.skus.find((s) => s.id === event.skuId);
    const from = event.fromSlotId ? snap.slots.find((s) => s.id === event.fromSlotId) : null;
    const reason =
      event.reason === "caida" ? { es: "caída", en: "dropped" } : event.reason === "rota" ? { es: "rota", en: "broken" } : { es: event.note || "otra", en: event.note || "other" };
    alerts.push({
      id: `merma-${event.id}`,
      kind: "merma",
      severity: "warn",
      titleEs: `Merma declarada · ${event.qty} ${sku?.name ?? event.skuId}`,
      titleEn: `Declared shrink · ${event.qty} ${sku?.name ?? event.skuId}`,
      detailEs: `${from?.code ?? "hueco"} · ${reason.es}. Si no se declara, coger otra caja deja un faltante invisible.`,
      detailEn: `${from?.code ?? "slot"} · ${reason.en}. If undeclared, taking another case leaves a hidden shortage.`,
      siteId: event.siteId,
      entityId: event.id,
    });
  }

  for (const proposal of proposeReplenishments(snap)) {
    if (!inSite(proposal.siteId)) continue;
    const sku = snap.skus.find((s) => s.id === proposal.skuId);
    const from = snap.slots.find((s) => s.id === proposal.fromSlotId);
    const to = snap.slots.find((s) => s.id === proposal.toSlotId);
    alerts.push({
      id: `pf-${proposal.id}`,
      kind: "pick_face",
      severity: "warn",
      titleEs: `Pick face vacío · ${sku?.name ?? proposal.skuId}`,
      titleEn: `Empty pick face · ${sku?.name ?? proposal.skuId}`,
      detailEs: `Bajar de reserva ${from?.code ?? "?"} → ${to?.code ?? "?"} con retráctil doble`,
      detailEn: `Replenish ${from?.code ?? "?"} → ${to?.code ?? "?"} with double reach`,
      siteId: proposal.siteId,
      entityId: proposal.id,
    });
  }

  const order: Record<WmsAlertSeverity, number> = { critical: 0, warn: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function alertCounts(alerts: WmsAlert[]) {
  return {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    warn: alerts.filter((a) => a.severity === "warn").length,
  };
}
