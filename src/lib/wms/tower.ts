import type { AppSection } from "@/lib/notifications";
import { WMS_DEMO_NOW } from "./alerts";
import { computeShiftCoverage, ROLE_FLOOR_LABEL, SHIFT_LABEL } from "./economics";
import type { WmsSnapshot } from "./types";

export type TowerActionKind =
  | "ASSIGN_PICKER"
  | "OPEN_PICKING"
  | "RECEIVE_ASN"
  | "COVER_SHIFT"
  | "FIX_SLOT"
  | "SHIP_RISK";

export interface TowerAction {
  id: string;
  kind: TowerActionKind;
  titleEs: string;
  titleEn: string;
  actionEs: string;
  actionEn: string;
  section: AppSection;
  waveId?: string;
  orderId?: string;
}

export interface TowerPulse {
  livePallets: number;
  stockAvailabilityPct: number;
  ordersOpen: number;
  ordersPending: number;
  wavesOpen: number;
  pickOpen: number;
  pickDone: number;
  pickingProgressPct: number;
  asnDelayed: number;
  dockBusy: number;
  dockTotal: number;
  dockOccupancyPct: number;
  shipmentRisk: number;
  cutOffRisk: number;
  mermaToday: number;
  slotFixes: number;
  incidents: number;
  shiftGaps: number;
  workforceCoveragePct: number;
  fleetDown: number;
  fleetOperative: number;
  fleetTotal: number;
}

export function computeTowerPulse(
  snap: WmsSnapshot,
  siteId?: string,
  now = new Date(WMS_DEMO_NOW),
): TowerPulse {
  const inSite = (id: string) => !siteId || id === siteId;
  const day = now.toISOString().slice(0, 10);
  const waves = snap.pickWaves.filter((w) => inSite(w.siteId) && w.status !== "cerrada");
  const lines = waves.flatMap((w) => w.lines);
  const docks = snap.slots.filter((s) => inSite(s.siteId) && s.zone === "muelle");
  const nowMs = now.getTime();
  const livePallets = snap.pallets.filter((p) => inSite(p.siteId) && p.status !== "expedido");
  const unitsBySku = new Map<string, number>();
  for (const p of livePallets) unitsBySku.set(p.skuId, (unitsBySku.get(p.skuId) ?? 0) + p.qty);
  const skuOk = snap.skus.filter((s) => (unitsBySku.get(s.id) ?? 0) >= s.minStock).length;
  const pickOpen = lines.filter((l) => l.status === "pendiente" || l.status === "en_curso").length;
  const pickDone = lines.filter((l) => l.status === "picada").length;
  const dockBusy = docks.filter((s) => s.status !== "libre" || s.palletId).length;
  const coverage = computeShiftCoverage(snap, siteId);
  const requiredHeads = coverage.gaps.reduce((s, g) => s + g.required, 0);
  const coveredHeads = coverage.gaps.reduce((s, g) => s + Math.min(g.actual, g.required), 0);
  const mermaToday = snap.mermaEvents.filter((e) => inSite(e.siteId) && e.at.slice(0, 10) === day).length;
  const slotFixes = snap.slotFixes.filter((f) => inSite(f.siteId) && f.status === "pendiente").length;
  const fleet = snap.fleet.filter((f) => inSite(f.siteId));
  const nearCutOff = (cutOff: string) => new Date(cutOff).getTime() - nowMs <= 2 * 60 * 60 * 1000;

  return {
    livePallets: livePallets.length,
    stockAvailabilityPct: snap.skus.length ? Math.round((skuOk / snap.skus.length) * 100) : 100,
    ordersOpen: snap.outbound.filter((o) => inSite(o.siteId) && o.status !== "expedido").length,
    ordersPending: snap.outbound.filter((o) => inSite(o.siteId) && o.status === "pendiente").length,
    wavesOpen: waves.length,
    pickOpen,
    pickDone,
    pickingProgressPct: pickDone + pickOpen ? Math.round((pickDone / (pickDone + pickOpen)) * 100) : 0,
    asnDelayed: snap.inbound.filter(
      (a) =>
        inSite(a.siteId) &&
        a.status !== "cerrado" &&
        new Date(a.eta).getTime() < nowMs &&
        a.palletsDone < a.palletsExpected,
    ).length,
    dockBusy,
    dockTotal: docks.length,
    dockOccupancyPct: docks.length ? Math.round((dockBusy / docks.length) * 100) : 0,
    shipmentRisk: snap.outbound.filter((o) => {
      if (!inSite(o.siteId) || o.status === "expedido" || o.status === "pendiente") return false;
      return nearCutOff(o.cutOff);
    }).length,
    cutOffRisk: snap.outbound.filter((o) => {
      if (!inSite(o.siteId) || o.status === "expedido") return false;
      return nearCutOff(o.cutOff);
    }).length,
    mermaToday,
    slotFixes,
    incidents: mermaToday + slotFixes,
    shiftGaps: coverage.gaps.filter((g) => g.gap < 0).length,
    workforceCoveragePct: requiredHeads ? Math.round((coveredHeads / requiredHeads) * 100) : 100,
    fleetDown: fleet.filter((f) => f.status === "fuera_servicio" || f.status === "mantenimiento").length,
    fleetOperative: fleet.filter((f) => f.status === "operativa").length,
    fleetTotal: fleet.length,
  };
}

/**
 * Acciones a partir del snapshot. Las cantidades son las de las olas reales,
 * no un «38 líneas» inventado.
 */
export function recommendTowerActions(
  snap: WmsSnapshot,
  siteId?: string,
  now = new Date(WMS_DEMO_NOW),
): TowerAction[] {
  const actions: TowerAction[] = [];
  const nowMs = now.getTime();

  for (const wave of snap.pickWaves) {
    if (siteId && wave.siteId !== siteId) continue;
    if (wave.status === "cerrada") continue;
    const pending = wave.lines.filter((l) => l.status === "pendiente" || l.status === "en_curso").length;
    if (!pending) continue;
    const order = snap.outbound.find((o) => wave.lines.some((l) => l.orderCode === o.code));
    const cut = order ? new Date(order.cutOff) : null;
    const hh = cut
      ? `${String(cut.getUTCHours()).padStart(2, "0")}:${String(cut.getUTCMinutes()).padStart(2, "0")}`
      : null;
    if (!wave.operatorId) {
      actions.push({
        id: `act-assign-${wave.id}`,
        kind: "ASSIGN_PICKER",
        titleEs: `Ola ${wave.code} tiene ${pending} líneas pendientes${hh ? ` y cut-off a las ${hh}` : ""}.`,
        titleEn: `Wave ${wave.code} has ${pending} open lines${hh ? ` and cut-off at ${hh}` : ""}.`,
        actionEs: "ASIGNAR PICKER",
        actionEn: "ASSIGN PICKER",
        section: "expedicion",
        waveId: wave.id,
        orderId: order?.id,
      });
    } else {
      actions.push({
        id: `act-pick-${wave.id}`,
        kind: "OPEN_PICKING",
        titleEs: `Ola ${wave.code} tiene ${pending} líneas pendientes${hh ? ` y cut-off a las ${hh}` : ""}.`,
        titleEn: `Wave ${wave.code} has ${pending} open lines${hh ? ` and cut-off at ${hh}` : ""}.`,
        actionEs: "ABRIR PICAR",
        actionEn: "OPEN PICKING",
        section: "picking",
        waveId: wave.id,
        orderId: order?.id,
      });
    }
  }

  for (const asn of snap.inbound) {
    if (siteId && asn.siteId !== siteId) continue;
    if (asn.status === "cerrado") continue;
    if (new Date(asn.eta).getTime() >= nowMs) continue;
    if (asn.palletsDone >= asn.palletsExpected) continue;
    actions.push({
      id: `act-asn-${asn.id}`,
      kind: "RECEIVE_ASN",
      titleEs: `${asn.code} · ${asn.supplier} · ${asn.palletsDone}/${asn.palletsExpected} palets · ETA pasada.`,
      titleEn: `${asn.code} · ${asn.supplier} · ${asn.palletsDone}/${asn.palletsExpected} pallets · ETA missed.`,
      actionEs: "IR A RECEPCIÓN",
      actionEn: "GO TO RECEIVING",
      section: "recepcion",
    });
  }

  for (const order of snap.outbound) {
    if (siteId && order.siteId !== siteId) continue;
    if (order.status === "expedido" || order.status === "pendiente") continue;
    if (new Date(order.cutOff).getTime() >= nowMs) continue;
    actions.push({
      id: `act-ship-${order.id}`,
      kind: "SHIP_RISK",
      titleEs: `${order.code} · cut-off vencido · muelle ${order.dock} · ${order.status}.`,
      titleEn: `${order.code} · cut-off missed · dock ${order.dock} · ${order.status}.`,
      actionEs: "REVISAR EXPEDICIÓN",
      actionEn: "REVIEW SHIPPING",
      section: "expedicion",
      orderId: order.id,
    });
  }

  for (const fix of snap.slotFixes) {
    if (siteId && fix.siteId !== siteId) continue;
    if (fix.status !== "pendiente") continue;
    const slot = snap.slots.find((s) => s.id === fix.slotId);
    actions.push({
      id: `act-fix-${fix.id}`,
      kind: "FIX_SLOT",
      titleEs: `Faltante en hueco ${slot?.code ?? fix.slotId}. El jefe tiene que cuadrar.`,
      titleEn: `Shortage at ${slot?.code ?? fix.slotId}. The lead must fix the count.`,
      actionEs: "CUADRAR HUECO",
      actionEn: "FIX SLOT",
      section: "expedicion",
    });
  }

  let coverLeft = 2;
  for (const gap of computeShiftCoverage(snap, siteId).gaps) {
    if (gap.gap >= 0 || coverLeft <= 0) continue;
    const shift = SHIFT_LABEL[gap.shift];
    const role = ROLE_FLOOR_LABEL[gap.role];
    actions.push({
      id: `act-cover-${gap.siteId}-${gap.shift}-${gap.role}`,
      kind: "COVER_SHIFT",
      titleEs: `Turno ${shift.es} · ${role.es} · faltan ${-gap.gap}.`,
      titleEn: `${shift.en} shift · ${role.en} · short ${-gap.gap}.`,
      actionEs: "CUBRIR TURNO",
      actionEn: "COVER SHIFT",
      section: "operarios",
    });
    coverLeft -= 1;
  }

  return actions.slice(0, 8);
}
