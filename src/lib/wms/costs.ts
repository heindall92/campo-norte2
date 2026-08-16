import { WMS_TARIFF, countPalletMoves } from "./economics";
import { laborCostToday, monthCosts } from "./stats";
import type { WmsSnapshot } from "./types";

export interface UnitOpCosts {
  costPerOrderEur: number;
  costPerLineEur: number;
  costPerPalletEur: number;
  costPerPickEur: number;
  costPerShipEur: number;
  orders: number;
  lines: number;
  palletsLive: number;
  picksDone: number;
  shipped: number;
}

/** Estructura lista para labor / carrier / handling / storage. */
export interface CostStructure {
  laborEur: number;
  carrierEur: number;
  handlingEur: number;
  storageEur: number;
  laborSource: "hours_today";
  carrierSource: "cost_line_terceros";
  handlingSource: "tariff";
  storageSource: "tariff";
  month: string;
}

function safeDiv(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 100) / 100;
}

export function computeCostStructure(
  snap: WmsSnapshot,
  month = "2026-08",
  siteId?: string,
): CostStructure {
  const ops = snap.operators.filter((o) => o.active && (!siteId || o.siteId === siteId));
  const monthRows = monthCosts(snap.costs, month, siteId);
  const occupied = snap.slots.filter(
    (s) => (!siteId || s.siteId === siteId) && (s.status === "ocupado" || s.status === "reservado"),
  ).length;
  const inboundDone = snap.inbound
    .filter((i) => !siteId || i.siteId === siteId)
    .reduce((s, i) => s + i.palletsDone, 0);
  const outboundPallets = snap.outbound
    .filter((o) => (!siteId || o.siteId === siteId) && o.status !== "pendiente")
    .reduce((s, o) => s + o.pallets, 0);

  return {
    laborEur: laborCostToday(ops),
    carrierEur: monthRows.filter((c) => c.center === "terceros").reduce((s, c) => s + c.amountEur, 0),
    handlingEur: inboundDone * WMS_TARIFF.handlingInEur + outboundPallets * WMS_TARIFF.handlingOutEur,
    storageEur: occupied * WMS_TARIFF.storageSlotDayEur * WMS_TARIFF.daysInMonth,
    laborSource: "hours_today",
    carrierSource: "cost_line_terceros",
    handlingSource: "tariff",
    storageSource: "tariff",
    month,
  };
}

export function computeUnitOpCosts(
  snap: WmsSnapshot,
  month = "2026-08",
  siteId?: string,
): UnitOpCosts {
  const structure = computeCostStructure(snap, month, siteId);
  const orders = snap.outbound.filter((o) => !siteId || o.siteId === siteId);
  const shipped = orders.filter((o) => o.status === "expedido");
  const waves = snap.pickWaves.filter((w) => !siteId || w.siteId === siteId);
  const lines = waves.reduce((s, w) => s + w.lines.length, 0);
  const picksDone = waves.reduce((s, w) => s + w.lines.filter((l) => l.status === "picada").length, 0);
  const palletsLive = snap.pallets.filter((p) => p.status !== "expedido" && (!siteId || p.siteId === siteId)).length;
  const moves = Math.max(1, countPalletMoves(snap, siteId));
  const todayAndHandling = structure.laborEur + structure.handlingEur;
  const withCarrier = todayAndHandling + structure.carrierEur / 30;

  return {
    costPerOrderEur: safeDiv(withCarrier, orders.length),
    costPerLineEur: safeDiv(structure.laborEur, lines),
    costPerPalletEur: safeDiv(structure.laborEur + structure.storageEur / 30, Math.max(1, palletsLive || moves)),
    costPerPickEur: safeDiv(structure.laborEur, Math.max(1, picksDone)),
    costPerShipEur: safeDiv(structure.carrierEur / 30 + structure.handlingEur, Math.max(1, shipped.length || orders.filter((o) => o.status === "muelle").length)),
    orders: orders.length,
    lines,
    palletsLive,
    picksDone,
    shipped: shipped.length,
  };
}
