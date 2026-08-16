import { WMS_DEMO_NOW } from "./alerts";
import { classifyLotAlert, lotFromPallet } from "./lots";
import { proposeReplenishments } from "./movements";
import type { AppSection } from "@/lib/notifications";
import type { WmsSnapshot } from "./types";

export type OpsAlertType =
  | "LOW_STOCK"
  | "STOCKOUT"
  | "EXPIRING"
  | "EXPIRED"
  | "PICKING_DELAY"
  | "SHIPMENT_DELAY"
  | "DOCK_DELAY"
  | "WAVE_AT_RISK"
  | "REPLENISHMENT_REQUIRED"
  | "QUALITY_INCIDENT"
  | "CARRIER_DELAY";

export type OpsAlertSeverity = "info" | "warn" | "critical";
export type OpsAlertStatus = "open" | "resolved";

export interface OpsAlert {
  id: string;
  type: OpsAlertType;
  severity: OpsAlertSeverity;
  status: OpsAlertStatus;
  createdAt: string;
  resolvedAt: string | null;
  entity: string;
  entityId: string;
  siteId: string;
  titleEs: string;
  titleEn: string;
  recommendedAction: string;
  section: AppSection;
}

const CUTOFF_MS = 2 * 60 * 60 * 1000;
const PICK_DELAY_MS = 2 * 60 * 60 * 1000;

function unitsBySku(snap: WmsSnapshot, siteId?: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of snap.pallets) {
    if (siteId && p.siteId !== siteId) continue;
    if (p.status === "expedido") continue;
    map.set(p.skuId, (map.get(p.skuId) ?? 0) + p.qty);
  }
  return map;
}

export function buildOpsAlerts(
  snap: WmsSnapshot,
  now = new Date(WMS_DEMO_NOW),
  siteId?: string,
): OpsAlert[] {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const inSite = (id: string) => !siteId || id === siteId;
  const alerts: OpsAlert[] = [];
  const units = unitsBySku(snap, siteId);

  const presentSkus = new Set(
    snap.pallets.filter((p) => !siteId || p.siteId === siteId).map((p) => p.skuId),
  );
  for (const sku of snap.skus) {
    if (!presentSkus.has(sku.id)) continue;
    const qty = units.get(sku.id) ?? 0;
    if (qty > 0 && qty >= sku.minStock) continue;
    const stockout = qty <= 0;
    const site = siteId ?? snap.sites[0]?.id ?? "";
    alerts.push({
      id: `${stockout ? "so" : "ls"}-${sku.id}-${site}`,
      type: stockout ? "STOCKOUT" : "LOW_STOCK",
      severity: stockout ? "critical" : "warn",
      status: "open",
      createdAt: nowIso,
      resolvedAt: null,
      entity: "sku",
      entityId: sku.id,
      siteId: site,
      titleEs: `${stockout ? "Sin stock" : "Bajo mínimo"} · ${sku.sku} · ${qty}`,
      titleEn: `${stockout ? "Stockout" : "Low stock"} · ${sku.sku} · ${qty}`,
      recommendedAction: stockout ? "RECEIVE_OR_TRANSFER" : "REPLENISH_OR_RECEIVE",
      section: "recepcion",
    });
  }

  for (const pallet of snap.pallets) {
    if (!inSite(pallet.siteId) || pallet.status === "expedido") continue;
    const kind = classifyLotAlert(lotFromPallet(pallet), nowMs);
    if (kind !== "EXPIRED" && kind !== "EXPIRING_SOON") continue;
    alerts.push({
      id: `lot-${pallet.id}`,
      type: kind === "EXPIRED" ? "EXPIRED" : "EXPIRING",
      severity: kind === "EXPIRED" ? "critical" : "warn",
      status: "open",
      createdAt: pallet.expiry ?? nowIso,
      resolvedAt: null,
      entity: "pallet",
      entityId: pallet.id,
      siteId: pallet.siteId,
      titleEs: `${kind === "EXPIRED" ? "Caducado" : "Caduca pronto"} · ${pallet.sscc}`,
      titleEn: `${kind === "EXPIRED" ? "Expired" : "Expiring"} · ${pallet.sscc}`,
      recommendedAction: kind === "EXPIRED" ? "QUARANTINE" : "PICK_FEFO",
      section: "inventario",
    });
  }

  for (const wave of snap.pickWaves) {
    if (!inSite(wave.siteId) || wave.status === "cerrada") continue;
    const pending = wave.lines.filter((l) => l.status === "pendiente" || l.status === "en_curso").length;
    if (!pending) continue;
    const order = snap.outbound.find((o) => wave.lines.some((l) => l.orderCode === o.code));
    const cut = order ? new Date(order.cutOff).getTime() : Number.POSITIVE_INFINITY;
    const printed = wave.printedAt ? new Date(wave.printedAt).getTime() : nowMs;
    if (cut - nowMs <= CUTOFF_MS) {
      alerts.push({
        id: `wave-risk-${wave.id}`,
        type: "WAVE_AT_RISK",
        severity: cut < nowMs ? "critical" : "warn",
        status: "open",
        createdAt: wave.printedAt,
        resolvedAt: null,
        entity: "pick_wave",
        entityId: wave.id,
        siteId: wave.siteId,
        titleEs: `Ola ${wave.code} · ${pending} líneas · cut-off ${order?.cutOff.slice(11, 16) ?? "—"}`,
        titleEn: `Wave ${wave.code} · ${pending} lines · cut-off ${order?.cutOff.slice(11, 16) ?? "—"}`,
        recommendedAction: wave.operatorId ? "OPEN_PICKING" : "ASSIGN_PICKER",
        section: wave.operatorId ? "picking" : "expedicion",
      });
    }
    if (nowMs - printed >= PICK_DELAY_MS) {
      alerts.push({
        id: `pick-delay-${wave.id}`,
        type: "PICKING_DELAY",
        severity: "warn",
        status: "open",
        createdAt: wave.printedAt,
        resolvedAt: null,
        entity: "pick_wave",
        entityId: wave.id,
        siteId: wave.siteId,
        titleEs: `Picking lento · ${wave.code} abierta desde ${wave.printedAt.slice(11, 16)}`,
        titleEn: `Slow picking · ${wave.code} open since ${wave.printedAt.slice(11, 16)}`,
        recommendedAction: "OPEN_PICKING",
        section: "picking",
      });
    }
  }

  for (const order of snap.outbound) {
    if (!inSite(order.siteId) || order.status === "expedido" || order.status === "pendiente") continue;
    if (new Date(order.cutOff).getTime() >= nowMs) continue;
    alerts.push({
      id: `ship-${order.id}`,
      type: "SHIPMENT_DELAY",
      severity: "critical",
      status: "open",
      createdAt: order.cutOff,
      resolvedAt: null,
      entity: "outbound",
      entityId: order.id,
      siteId: order.siteId,
      titleEs: `${order.code} · cut-off vencido · ${order.status}`,
      titleEn: `${order.code} · cut-off missed · ${order.status}`,
      recommendedAction: "REVIEW_SHIPPING",
      section: "expedicion",
    });
    if (order.carrierId) {
      alerts.push({
        id: `car-${order.id}`,
        type: "CARRIER_DELAY",
        severity: "warn",
        status: "open",
        createdAt: order.cutOff,
        resolvedAt: null,
        entity: "outbound",
        entityId: order.id,
        siteId: order.siteId,
        titleEs: `${order.code} · transportista asignado y cut-off vencido`,
        titleEn: `${order.code} · carrier assigned and cut-off missed`,
        recommendedAction: "CALL_CARRIER_WINDOW",
        section: "expedicion",
      });
    }
  }

  for (const asn of snap.inbound) {
    if (!inSite(asn.siteId) || asn.status === "cerrado") continue;
    if (new Date(asn.eta).getTime() >= nowMs) continue;
    if (asn.palletsDone >= asn.palletsExpected) continue;
    alerts.push({
      id: `dock-${asn.id}`,
      type: "DOCK_DELAY",
      severity: asn.status === "en_muelle" || asn.status === "descargando" ? "critical" : "warn",
      status: "open",
      createdAt: asn.eta,
      resolvedAt: null,
      entity: "asn",
      entityId: asn.id,
      siteId: asn.siteId,
      titleEs: `${asn.code} · ETA pasada · ${asn.palletsDone}/${asn.palletsExpected} · ${asn.dock}`,
      titleEn: `${asn.code} · ETA missed · ${asn.palletsDone}/${asn.palletsExpected} · ${asn.dock}`,
      recommendedAction: "RECEIVE_ASN",
      section: "recepcion",
    });
  }

  for (const proposal of proposeReplenishments(snap)) {
    if (!inSite(proposal.siteId)) continue;
    const sku = snap.skus.find((s) => s.id === proposal.skuId);
    alerts.push({
      id: `rep-${proposal.id}`,
      type: "REPLENISHMENT_REQUIRED",
      severity: "warn",
      status: "open",
      createdAt: nowIso,
      resolvedAt: null,
      entity: "replenishment",
      entityId: proposal.id,
      siteId: proposal.siteId,
      titleEs: `Reponer cara · ${sku?.sku ?? proposal.skuId}`,
      titleEn: `Replenish face · ${sku?.sku ?? proposal.skuId}`,
      recommendedAction: "REPLENISH_DOUBLE_REACH",
      section: "movimientos",
    });
  }

  for (const fix of snap.slotFixes) {
    if (!inSite(fix.siteId)) continue;
    const slot = snap.slots.find((s) => s.id === fix.slotId);
    alerts.push({
      id: `qi-fix-${fix.id}`,
      type: "QUALITY_INCIDENT",
      severity: fix.status === "pendiente" ? "warn" : "info",
      status: fix.status === "pendiente" ? "open" : "resolved",
      createdAt: fix.at,
      resolvedAt: fix.fixedAt,
      entity: "slot_fix",
      entityId: fix.id,
      siteId: fix.siteId,
      titleEs: `Faltante ${slot?.code ?? fix.slotId}`,
      titleEn: `Shortage ${slot?.code ?? fix.slotId}`,
      recommendedAction: "FIX_SLOT",
      section: "inventario",
    });
  }

  for (const event of snap.mermaEvents) {
    if (!inSite(event.siteId)) continue;
    alerts.push({
      id: `qi-merma-${event.id}`,
      type: "QUALITY_INCIDENT",
      severity: "warn",
      status: "open",
      createdAt: event.at,
      resolvedAt: null,
      entity: "merma",
      entityId: event.id,
      siteId: event.siteId,
      titleEs: `Merma ${event.qty} · ${event.reason}`,
      titleEn: `Shrink ${event.qty} · ${event.reason}`,
      recommendedAction: "DECLARED_ALREADY",
      section: "inventario",
    });
  }

  const rank: Record<OpsAlertSeverity, number> = { critical: 0, warn: 1, info: 2 };
  return alerts.sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return rank[a.severity] - rank[b.severity];
  });
}

export function opsAlertCounts(alerts: OpsAlert[]) {
  const open = alerts.filter((a) => a.status === "open");
  return {
    total: open.length,
    critical: open.filter((a) => a.severity === "critical").length,
    warn: open.filter((a) => a.severity === "warn").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
  };
}
