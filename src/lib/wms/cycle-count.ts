import { applyTxToSnapshot, locationOfPallet } from "./inventory-core";
import { codesEqual } from "./location";
import type { Slot, WmsSnapshot } from "./types";

export type CycleCountTask = {
  id: string;
  slotId: string;
  palletId: string;
  skuId: string;
  siteId: string;
  reason: "caducidad" | "abc_a" | "antiguo" | "frio";
  expectedQty: number;
  lastCountedAt: string | null;
  score: number;
};

export type CycleCountError = "task_missing" | "wrong_slot" | "wrong_sscc" | "invalid_qty";

export type CycleCountResult =
  | { ok: true; snap: WmsSnapshot; variance: number }
  | { ok: false; error: CycleCountError };

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export function planCycleCounts(
  snap: WmsSnapshot,
  opts: { siteId?: string; now?: Date; limit?: number } = {},
): CycleCountTask[] {
  const now = opts.now ?? new Date("2026-08-15T11:00:00.000Z");
  const nowMs = now.getTime();
  const skuMap = new Map(snap.skus.map((s) => [s.id, s]));
  const palletMap = new Map(snap.pallets.map((p) => [p.id, p]));
  const tasks: CycleCountTask[] = [];

  for (const slot of snap.slots) {
    if (opts.siteId && slot.siteId !== opts.siteId) continue;
    if (!slot.palletId || slot.status === "bloqueado") continue;
    const pallet = palletMap.get(slot.palletId);
    if (!pallet || pallet.status === "expedido") continue;
    const sku = skuMap.get(pallet.skuId);
    let score = 0;
    let reason: CycleCountTask["reason"] = "antiguo";
    if (pallet.expiry && new Date(pallet.expiry).getTime() - nowMs <= STALE_MS) {
      score += 100;
      reason = "caducidad";
    }
    if (sku?.abc === "A") {
      score += 50;
      if (reason === "antiguo") reason = "abc_a";
    }
    if (slot.zone === "fresco" || slot.zone === "congelado") {
      score += 20;
      if (reason === "antiguo") reason = "frio";
    }
    const last = slot.lastCountedAt ? new Date(slot.lastCountedAt).getTime() : 0;
    if (!last || nowMs - last >= STALE_MS) {
      score += 30;
    }
    if (score < 30) continue;
    tasks.push({
      id: `cc-${slot.id}`,
      slotId: slot.id,
      palletId: pallet.id,
      skuId: pallet.skuId,
      siteId: slot.siteId,
      reason,
      expectedQty: pallet.qty,
      lastCountedAt: slot.lastCountedAt,
      score,
    });
  }

  return tasks.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 12);
}

export function confirmCycleCount(
  snap: WmsSnapshot,
  task: CycleCountTask,
  input: { slotCode: string; sscc: string; qty: number; operatorId?: string | null },
  at = "2026-08-15T11:20:00.000Z",
): CycleCountResult {
  const slot = snap.slots.find((s) => s.id === task.slotId) as Slot | undefined;
  const pallet = snap.pallets.find((p) => p.id === task.palletId);
  if (!slot || !pallet) return { ok: false, error: "task_missing" };
  if (!codesEqual(slot.code, input.slotCode)) return { ok: false, error: "wrong_slot" };
  if (input.sscc.trim() !== pallet.sscc) return { ok: false, error: "wrong_sscc" };
  if (!Number.isFinite(input.qty) || input.qty < 0) return { ok: false, error: "invalid_qty" };

  const variance = input.qty - pallet.qty;
  const nextSlots = snap.slots.map((s) =>
    s.id === slot.id ? { ...s, lastCountedAt: at, status: s.status === "inventario" ? "ocupado" : s.status } : s,
  );
  const nextPallets = snap.pallets.map((p) => (p.id === pallet.id ? { ...p, qty: input.qty } : p));
  const physical: WmsSnapshot = {
    ...snap,
    slots: nextSlots,
    pallets: nextPallets,
    movements: [
      {
        id: `mv-cc-${slot.id}`,
        at,
        type: variance === 0 ? "inventario" : "ajuste",
        skuId: pallet.skuId,
        palletId: pallet.id,
        fromSlotId: slot.id,
        toSlotId: slot.id,
        qty: variance,
        operatorId: input.operatorId ?? null,
        fleetId: null,
        note: variance === 0 ? `Conteo OK ${slot.code}` : `Merma/ajuste ${variance} · ${slot.code}`,
      },
      ...snap.movements,
    ],
  };
  const led = applyTxToSnapshot(physical, {
    type: "COUNT",
    skuId: pallet.skuId,
    lot: pallet.lot || null,
    fromLocationId: locationOfPallet(pallet),
    qty: 0,
    countedQty: input.qty,
    reason: variance === 0 ? `Conteo OK ${slot.code}` : `Conteo ${variance} · ${slot.code}`,
    refType: "cycle_count",
    refId: task.id,
    palletId: pallet.id,
    actorId: input.operatorId ?? null,
    at,
    id: `itx-COUNT-${slot.id}-${at}`,
  });
  if (!led.ok) return { ok: false, error: "invalid_qty" };
  return { ok: true, variance, snap: led.snap };
}
