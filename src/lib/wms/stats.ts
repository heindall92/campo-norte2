import type {
  CategoryCode,
  CostLine,
  FleetUnit,
  Operator,
  Pallet,
  Sku,
  Slot,
  WmsSnapshot,
} from "./types";
import { CATEGORY_LABEL } from "./types";

export interface OccupancyByZone {
  zone: string;
  total: number;
  occupied: number;
  free: number;
  blocked: number;
  pct: number;
}

export interface StockByCategory {
  category: CategoryCode;
  label: string;
  pallets: number;
  units: number;
  skus: number;
  belowMin: number;
}

export interface WmsTowerKpis {
  occupancyPct: number;
  freeSlots: number;
  occupiedSlots: number;
  palletsLive: number;
  fleetOnline: number;
  fleetCharging: number;
  operatorsActive: number;
  inboundOpen: number;
  outboundOpen: number;
  costMonthEur: number;
  costBudgetEur: number;
  laborCostTodayEur: number;
  lowStockSkus: number;
  expiringSoon: number;
  batteryAlerts: number;
}

export function occupancyByZone(slots: Slot[]): OccupancyByZone[] {
  const map = new Map<string, OccupancyByZone>();
  for (const s of slots) {
    const row = map.get(s.zone) ?? {
      zone: s.zone,
      total: 0,
      occupied: 0,
      free: 0,
      blocked: 0,
      pct: 0,
    };
    row.total += 1;
    if (s.status === "bloqueado") row.blocked += 1;
    else if (s.status === "libre") row.free += 1;
    else row.occupied += 1;
    map.set(s.zone, row);
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      pct: r.total ? Math.round(((r.occupied + r.blocked) / r.total) * 100) : 0,
    }))
    .sort((a, b) => a.zone.localeCompare(b.zone));
}

export function stockByCategory(
  pallets: Pallet[],
  skus: Sku[],
  lang: "es" | "en" = "es",
): StockByCategory[] {
  const skuMap = new Map(skus.map((s) => [s.id, s]));
  const byCat = new Map<CategoryCode, StockByCategory>();
  const unitsBySku = new Map<string, number>();

  for (const p of pallets) {
    if (p.status === "expedido") continue;
    const sku = skuMap.get(p.skuId);
    if (!sku) continue;
    unitsBySku.set(p.skuId, (unitsBySku.get(p.skuId) ?? 0) + p.qty);
    const row = byCat.get(sku.category) ?? {
      category: sku.category,
      label: CATEGORY_LABEL[sku.category][lang],
      pallets: 0,
      units: 0,
      skus: 0,
      belowMin: 0,
    };
    row.pallets += 1;
    row.units += p.qty;
    byCat.set(sku.category, row);
  }

  for (const sku of skus) {
    const row = byCat.get(sku.category);
    if (!row) continue;
    row.skus += 1;
    const units = unitsBySku.get(sku.id) ?? 0;
    if (units < sku.minStock) row.belowMin += 1;
  }

  return [...byCat.values()].sort((a, b) => b.pallets - a.pallets);
}

export function monthCosts(costs: CostLine[], month: string, siteId?: string) {
  return costs.filter((c) => c.month === month && (!siteId || c.siteId === siteId));
}

export function laborCostToday(operators: Operator[]): number {
  return operators
    .filter((o) => o.active)
    .reduce((sum, o) => sum + o.hoursToday * o.costPerHour, 0);
}

export function fleetUtilization(fleet: FleetUnit[]): number {
  const usable = fleet.filter((f) => f.status !== "fuera_servicio");
  if (!usable.length) return 0;
  const online = usable.filter((f) => f.status === "operativa").length;
  return Math.round((online / usable.length) * 100);
}

export function computeTowerKpis(
  snap: WmsSnapshot,
  month = "2026-08",
  siteId?: string,
): WmsTowerKpis {
  const sid = siteId ?? snap.sites[0]?.id;
  const slots = snap.slots.filter((s) => s.siteId === sid);
  const occupied = slots.filter((s) => s.status === "ocupado" || s.status === "reservado" || s.status === "inventario");
  const free = slots.filter((s) => s.status === "libre");
  const livePallets = snap.pallets.filter((p) => p.status !== "expedido" && p.siteId === sid);
  const fleet = snap.fleet.filter((f) => f.siteId === sid);
  const operators = snap.operators.filter((o) => o.siteId === sid);
  const costs = monthCosts(snap.costs, month, sid);
  const skuUnits = new Map<string, number>();
  for (const p of livePallets) {
    skuUnits.set(p.skuId, (skuUnits.get(p.skuId) ?? 0) + p.qty);
  }
  const lowStockSkus = snap.skus.filter((s) => (skuUnits.get(s.id) ?? 0) < s.minStock).length;
  const soon = new Date("2026-08-22").getTime();
  const expiringSoon = livePallets.filter((p) => p.expiry && new Date(p.expiry).getTime() <= soon).length;

  return {
    occupancyPct: slots.length ? Math.round((occupied.length / slots.length) * 100) : 0,
    freeSlots: free.length,
    occupiedSlots: occupied.length,
    palletsLive: livePallets.length,
    fleetOnline: fleet.filter((f) => f.status === "operativa").length,
    fleetCharging: fleet.filter((f) => f.status === "cargando").length,
    operatorsActive: operators.filter((o) => o.active).length,
    inboundOpen: snap.inbound.filter((i) => i.status !== "cerrado" && i.siteId === sid).length,
    outboundOpen: snap.outbound.filter((o) => o.status !== "expedido" && o.siteId === sid).length,
    costMonthEur: costs.reduce((s, c) => s + c.amountEur, 0),
    costBudgetEur: costs.reduce((s, c) => s + c.budgetEur, 0),
    laborCostTodayEur: laborCostToday(operators),
    lowStockSkus,
    expiringSoon,
    batteryAlerts: fleet.filter((f) => f.batteryPct < 25).length,
  };
}
