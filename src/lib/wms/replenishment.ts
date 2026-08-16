import { WMS_DEMO_NOW } from "./alerts";
import { applyReplenishment, proposeReplenishments } from "./movements";
import type { LiveMoveResult } from "./movements";
import type { ReplenishKind, ReplenishTask, ReplenishTaskSource, WmsSnapshot } from "./types";

export type ReplenishError =
  | "task_missing"
  | "task_done"
  | "operator_required"
  | "no_source"
  | "sku_missing";

export type ReplenishApplyResult = LiveMoveResult | { ok: false; error: ReplenishError };

export type MinMaxProposal = {
  skuId: string;
  warehouseId: string;
  currentQty: number;
  minStock: number;
  maxStock: number;
  qty: number;
  kind: ReplenishKind;
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Qty viva: palets no expedidos del SKU en el centro. */
export function currentSkuQty(snap: WmsSnapshot, skuId: string, warehouseId?: string): number {
  let qty = 0;
  for (const p of snap.pallets) {
    if (p.skuId !== skuId || p.status === "expedido") continue;
    if (warehouseId && p.siteId !== warehouseId) continue;
    qty += Math.max(0, p.qty);
  }
  return qty;
}

/**
 * `replenish = max(0, maxStock − current)` solo si `current < minStock`.
 * Si current ya cubre el mínimo, 0.
 */
export function minMaxReplenishQty(minStock: number, maxStock: number, current: number): number {
  if (!Number.isFinite(minStock) || !Number.isFinite(maxStock) || !Number.isFinite(current)) return 0;
  if (current >= minStock) return 0;
  return Math.max(0, maxStock - current);
}

export function classifyReplenishKind(
  current: number,
  minStock: number,
  source: ReplenishTaskSource,
): ReplenishKind {
  if (source === "wave") return "AUTO";
  if (current <= 0 || (minStock > 0 && current < minStock * 0.25)) return "URGENT";
  return "PLANNED";
}

function attachPickFace(snap: WmsSnapshot, skuId: string, warehouseId: string) {
  const hit = proposeReplenishments(snap).find((p) => p.skuId === skuId && p.siteId === warehouseId);
  return hit
    ? { fromSlotId: hit.fromSlotId, toSlotId: hit.toSlotId, palletId: hit.palletId }
    : { fromSlotId: null, toSlotId: null, palletId: null };
}

/** Plan MIN/MAX sobre palets reales. No persiste. No inventa SKU. */
export function planMinMaxReplenishments(
  snap: WmsSnapshot,
  opts: { warehouseId?: string } = {},
): MinMaxProposal[] {
  const sites = opts.warehouseId ? [opts.warehouseId] : [...new Set(snap.sites.map((s) => s.id))];
  const rows: MinMaxProposal[] = [];
  for (const warehouseId of sites) {
    for (const sku of snap.skus) {
      const currentQty = currentSkuQty(snap, sku.id, warehouseId);
      const qty = minMaxReplenishQty(sku.minStock, sku.maxStock, currentQty);
      if (qty <= 0) continue;
      rows.push({
        skuId: sku.id,
        warehouseId,
        currentQty,
        minStock: sku.minStock,
        maxStock: sku.maxStock,
        qty,
        kind: classifyReplenishKind(currentQty, sku.minStock, "min_max"),
      });
    }
  }
  return rows.sort((a, b) => a.currentQty / Math.max(1, a.minStock) - b.currentQty / Math.max(1, b.minStock));
}

function upsertTask(snap: WmsSnapshot, draft: Omit<ReplenishTask, "id"> & { id?: string }): WmsSnapshot {
  const open = (snap.replenishTasks ?? []).find(
    (t) => t.status === "open" && t.skuId === draft.skuId && t.warehouseId === draft.warehouseId,
  );
  if (open) {
    return {
      ...snap,
      replenishTasks: (snap.replenishTasks ?? []).map((t) =>
        t.id === open.id
          ? {
              ...t,
              currentQty: draft.currentQty,
              qty: draft.qty,
              kind: draft.kind,
              source: draft.source,
              waveId: draft.waveId ?? t.waveId,
              fromSlotId: draft.fromSlotId ?? t.fromSlotId,
              toSlotId: draft.toSlotId ?? t.toSlotId,
              palletId: draft.palletId ?? t.palletId,
            }
          : t,
      ),
    };
  }
  const task: ReplenishTask = {
    id: draft.id ?? uid("rpl"),
    warehouseId: draft.warehouseId,
    skuId: draft.skuId,
    kind: draft.kind,
    source: draft.source,
    currentQty: draft.currentQty,
    minStock: draft.minStock,
    maxStock: draft.maxStock,
    qty: draft.qty,
    fromSlotId: draft.fromSlotId,
    toSlotId: draft.toSlotId,
    palletId: draft.palletId,
    waveId: draft.waveId,
    status: "open",
    createdAt: draft.createdAt,
    executedAt: null,
    operatorId: null,
  };
  return { ...snap, replenishTasks: [task, ...(snap.replenishTasks ?? [])] };
}

/** Persiste propuestas MIN/MAX. No mueve palets. */
export function openMinMaxTasks(
  snap: WmsSnapshot,
  warehouseId: string,
  at = WMS_DEMO_NOW,
): { ok: true; snap: WmsSnapshot; opened: number } {
  let next = snap;
  let opened = 0;
  for (const row of planMinMaxReplenishments(snap, { warehouseId })) {
    const before = (next.replenishTasks ?? []).length;
    const link = attachPickFace(next, row.skuId, warehouseId);
    next = upsertTask(next, {
      warehouseId: row.warehouseId,
      skuId: row.skuId,
      kind: row.kind,
      source: "min_max",
      currentQty: row.currentQty,
      minStock: row.minStock,
      maxStock: row.maxStock,
      qty: row.qty,
      ...link,
      waveId: null,
      status: "open",
      createdAt: at,
      executedAt: null,
      operatorId: null,
    });
    if ((next.replenishTasks ?? []).length > before) opened += 1;
  }
  return { ok: true, snap: next, opened };
}

/** Tras abrir una ola: si el proyectado baja del mínimo, tarea AUTO. No mueve. */
export function enqueueWaveReplenishments(snap: WmsSnapshot, waveId: string, at = WMS_DEMO_NOW): WmsSnapshot {
  const wave = snap.pickWaves.find((w) => w.id === waveId);
  if (!wave) return snap;
  const taken = new Map<string, number>();
  for (const line of wave.lines) {
    taken.set(line.skuId, (taken.get(line.skuId) ?? 0) + line.qty);
  }
  let next = snap;
  for (const [skuId, waveQty] of taken) {
    const sku = snap.skus.find((s) => s.id === skuId);
    if (!sku) continue;
    const current = currentSkuQty(snap, skuId, wave.siteId);
    const projected = Math.max(0, current - waveQty);
    const qty = minMaxReplenishQty(sku.minStock, sku.maxStock, projected);
    if (qty <= 0) continue;
    const link = attachPickFace(next, skuId, wave.siteId);
    next = upsertTask(next, {
      warehouseId: wave.siteId,
      skuId,
      kind: "AUTO",
      source: "wave",
      currentQty: projected,
      minStock: sku.minStock,
      maxStock: sku.maxStock,
      qty,
      ...link,
      waveId,
      status: "open",
      createdAt: at,
      executedAt: null,
      operatorId: null,
    });
  }
  return next;
}

/**
 * Ejecuta una tarea. Exige operario (AUTO no mueve sola).
 * Si hay hueco de pick face + reserva, baja el palet; si no, no inventa movimiento.
 */
export function applyReplenishTask(
  snap: WmsSnapshot,
  taskId: string,
  operatorId: string | null,
  fleetId: string | null = null,
  at = WMS_DEMO_NOW,
): ReplenishApplyResult {
  const task = (snap.replenishTasks ?? []).find((t) => t.id === taskId);
  if (!task) return { ok: false, error: "task_missing" };
  if (task.status !== "open") return { ok: false, error: "task_done" };
  if (!operatorId) return { ok: false, error: "operator_required" };

  let fromSlotId = task.fromSlotId;
  let toSlotId = task.toSlotId;
  let palletId = task.palletId;
  if (!fromSlotId || !toSlotId || !palletId) {
    const link = attachPickFace(snap, task.skuId, task.warehouseId);
    fromSlotId = link.fromSlotId;
    toSlotId = link.toSlotId;
    palletId = link.palletId;
  }
  if (!fromSlotId || !toSlotId || !palletId) return { ok: false, error: "no_source" };

  const moved = applyReplenishment(
    snap,
    {
      id: task.id,
      siteId: task.warehouseId,
      skuId: task.skuId,
      fromSlotId,
      toSlotId,
      palletId,
      aisle: snap.slots.find((s) => s.id === toSlotId)?.aisle ?? "",
      recommendedFleetKind: "retractil_doble",
    },
    fleetId,
    operatorId,
    at,
  );
  if (!moved.ok) return moved;
  return {
    ok: true,
    snap: {
      ...moved.snap,
      replenishTasks: (moved.snap.replenishTasks ?? []).map((t) =>
        t.id === taskId ? { ...t, status: "done" as const, executedAt: at, operatorId } : t,
      ),
    },
  };
}

export function openReplenishTasksForSite(snap: WmsSnapshot, warehouseId: string): ReplenishTask[] {
  return (snap.replenishTasks ?? []).filter((t) => t.warehouseId === warehouseId && t.status === "open");
}
