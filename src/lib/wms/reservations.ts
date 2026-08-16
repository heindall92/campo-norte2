import { applyTxToSnapshot, ledgerAvailableAt, locationOfPallet } from "./inventory-core";
import type { InventoryReservation, StockReservation, WmsSnapshot } from "./types";
import { classifyLotAlert, lotFromPallet } from "./lots";

export type ReserveError =
  | "pallet_missing"
  | "invalid_qty"
  | "stock_shortage"
  | "already_reserved"
  | "warehouse_mismatch"
  | "expired_lot"
  | "revision_conflict"
  | "hold_missing";

export type ReserveResult =
  | { ok: true; snap: WmsSnapshot; reservation: StockReservation }
  | { ok: false; error: ReserveError };

export function heldQty(snap: WmsSnapshot, palletId: string): number {
  return (snap.reservations ?? [])
    .filter((r) => r.palletId === palletId && r.status === "hold")
    .reduce((s, r) => s + r.qty, 0);
}

export function availableQty(snap: WmsSnapshot, palletId: string): number {
  const pallet = snap.pallets.find((p) => p.id === palletId);
  if (!pallet) return 0;
  const physical = Math.max(0, pallet.qty - heldQty(snap, palletId));
  const ledger = ledgerAvailableAt(snap, pallet);
  if (ledger == null) return physical;
  return Math.max(0, Math.min(physical, ledger));
}

export function reserveStock(
  snap: WmsSnapshot,
  input: {
    palletId: string;
    qty: number;
    orderCode: string;
    warehouseId: string;
    waveId?: string | null;
    lineId?: string | null;
    expectedRevision?: number;
    nowMs?: number;
    at?: string;
  },
): ReserveResult {
  const pallet = snap.pallets.find((p) => p.id === input.palletId);
  if (!pallet) return { ok: false, error: "pallet_missing" };
  if (pallet.siteId !== input.warehouseId) return { ok: false, error: "warehouse_mismatch" };
  if (pallet.status === "expedido" || pallet.status === "cuarentena") {
    return { ok: false, error: "stock_shortage" };
  }
  if (!Number.isFinite(input.qty) || input.qty < 1) return { ok: false, error: "invalid_qty" };

  const existing = (snap.reservations ?? []).find(
    (r) =>
      r.status === "hold" &&
      r.palletId === input.palletId &&
      r.orderCode === input.orderCode &&
      (input.lineId ? r.lineId === input.lineId : true),
  );
  if (existing) return { ok: false, error: "already_reserved" };

  if (input.expectedRevision != null) {
    const latest = (snap.reservations ?? [])
      .filter((r) => r.palletId === input.palletId)
      .reduce((m, r) => Math.max(m, r.revision), 0);
    if (latest !== input.expectedRevision) return { ok: false, error: "revision_conflict" };
  }

  const nowMs = input.nowMs ?? Date.parse(input.at ?? "2026-08-15T11:00:00.000Z");
  const lot = lotFromPallet(pallet);
  if (classifyLotAlert(lot, nowMs) === "EXPIRED") return { ok: false, error: "expired_lot" };

  const free = availableQty(snap, pallet.id);
  if (input.qty > free) return { ok: false, error: "stock_shortage" };

  const at = input.at ?? "2026-08-15T11:00:00.000Z";
  const reservation: StockReservation = {
    id: `rsv-${pallet.id}-${input.orderCode}-${at}`,
    organizationId: snap.org.id,
    warehouseId: input.warehouseId,
    palletId: pallet.id,
    skuId: pallet.skuId,
    qty: input.qty,
    status: "hold",
    orderCode: input.orderCode,
    waveId: input.waveId ?? null,
    lineId: input.lineId ?? null,
    at,
    revision: ((snap.reservations ?? []).find((r) => r.palletId === pallet.id)?.revision ?? 0) + 1,
  };
  const loc = locationOfPallet(pallet);
  const invRow: InventoryReservation = {
    id: `irsv-${reservation.id}`,
    orgId: snap.org.id,
    skuId: pallet.skuId,
    lot: pallet.lot || null,
    locationId: loc,
    qty: input.qty,
    status: "open",
    orderCode: input.orderCode,
    waveId: input.waveId ?? null,
    lineId: input.lineId ?? null,
    palletId: pallet.id,
    createdAt: at,
    revision: 1,
  };
  const held: WmsSnapshot = {
    ...snap,
    reservations: [reservation, ...(snap.reservations ?? [])],
    inventoryReservations: [invRow, ...(snap.inventoryReservations ?? [])],
  };
  const led = applyTxToSnapshot(held, {
    type: "ALLOCATE",
    skuId: pallet.skuId,
    lot: pallet.lot || null,
    fromLocationId: loc,
    qty: input.qty,
    reason: `allocate ${input.orderCode}`,
    refType: "reservation",
    refId: reservation.id,
    palletId: pallet.id,
    at,
    id: `itx-ALLOC-${reservation.id}`,
  });
  if (!led.ok) return { ok: false, error: "stock_shortage" };

  return {
    ok: true,
    reservation,
    snap: led.snap,
  };
}

export function holdForLine(snap: WmsSnapshot, lineId: string): StockReservation | undefined {
  return (snap.reservations ?? []).find((r) => r.status === "hold" && r.lineId === lineId);
}

function patchReservationStatus(
  snap: WmsSnapshot,
  reservationId: string,
  status: StockReservation["status"],
  qty?: number,
): WmsSnapshot {
  return {
    ...snap,
    reservations: (snap.reservations ?? []).map((r) =>
      r.id === reservationId
        ? { ...r, status, qty: qty ?? r.qty, revision: r.revision + 1 }
        : r,
    ),
    inventoryReservations: (snap.inventoryReservations ?? []).map((r) =>
      r.id === `irsv-${reservationId}` && r.status === "open"
        ? {
            ...r,
            status: status === "hold" ? "open" : status,
            qty: qty ?? r.qty,
            revision: r.revision + 1,
          }
        : r,
    ),
  };
}

/** Marca el hold como consumido. El PICK del ledger baja `allocated`. */
export function consumeReservation(snap: WmsSnapshot, reservationId: string): ReserveResult {
  const row = (snap.reservations ?? []).find((r) => r.id === reservationId);
  if (!row || row.status !== "hold") return { ok: false, error: "hold_missing" };
  const reservation = { ...row, status: "consumed" as const, revision: row.revision + 1 };
  return { ok: true, reservation, snap: patchReservationStatus(snap, reservationId, "consumed") };
}

export function shrinkReservation(snap: WmsSnapshot, reservationId: string, nextQty: number): ReserveResult {
  const row = (snap.reservations ?? []).find((r) => r.id === reservationId);
  if (!row || row.status !== "hold") return { ok: false, error: "hold_missing" };
  if (nextQty >= row.qty) return { ok: true, reservation: row, snap };
  if (nextQty < 1) return releaseReservation(snap, reservationId);
  const delta = row.qty - nextQty;
  const reservation = { ...row, qty: nextQty, revision: row.revision + 1 };
  const pallet = snap.pallets.find((p) => p.id === row.palletId);
  const patched = patchReservationStatus(snap, reservationId, "hold", nextQty);
  if (!pallet) return { ok: true, reservation, snap: patched };
  const led = applyTxToSnapshot(patched, {
    type: "DEALLOCATE",
    skuId: row.skuId,
    lot: pallet.lot || null,
    fromLocationId: locationOfPallet(pallet),
    qty: delta,
    reason: `shrink ${row.orderCode}`,
    refType: "reservation",
    refId: reservationId,
    palletId: pallet.id,
    at: row.at,
    id: `itx-DEALLOC-SHRINK-${reservationId}-${delta}`,
  });
  if (!led.ok) return { ok: false, error: "stock_shortage" };
  return { ok: true, reservation, snap: led.snap };
}

/** Recorta holds si el físico bajó (merma). Hay que llamarlo *antes* del ADJUSTMENT. */
export function trimHoldsToQty(snap: WmsSnapshot, palletId: string, maxQty: number): WmsSnapshot {
  const cap = Math.max(0, maxQty);
  let current = snap;
  const holds = (current.reservations ?? []).filter((r) => r.palletId === palletId && r.status === "hold");
  let held = holds.reduce((s, r) => s + r.qty, 0);
  for (const h of holds) {
    if (held <= cap) break;
    const excess = held - cap;
    if (excess >= h.qty) {
      const rel = releaseReservation(current, h.id);
      if (!rel.ok) break;
      current = rel.snap;
      held -= h.qty;
    } else {
      const shrunk = shrinkReservation(current, h.id, h.qty - excess);
      if (!shrunk.ok) break;
      current = shrunk.snap;
      held -= excess;
    }
  }
  return current;
}

export function trimHoldsToPhysical(snap: WmsSnapshot, palletId: string): WmsSnapshot {
  const pallet = snap.pallets.find((p) => p.id === palletId);
  return trimHoldsToQty(snap, palletId, pallet?.qty ?? 0);
}

export function releaseHoldsForLine(snap: WmsSnapshot, lineId: string, palletId?: string | null): WmsSnapshot {
  const holds = (snap.reservations ?? []).filter(
    (r) => r.status === "hold" && (r.lineId === lineId || (!r.lineId && palletId && r.palletId === palletId)),
  );
  let current = snap;
  for (const h of holds) {
    const rel = releaseReservation(current, h.id);
    if (rel.ok) current = rel.snap;
  }
  return current;
}

export function releaseReservation(snap: WmsSnapshot, reservationId: string): ReserveResult {
  const row = (snap.reservations ?? []).find((r) => r.id === reservationId);
  if (!row || row.status !== "hold") return { ok: false, error: "hold_missing" };
  const reservation = { ...row, status: "released" as const, revision: row.revision + 1 };
  const pallet = snap.pallets.find((p) => p.id === row.palletId);
  const released: WmsSnapshot = {
    ...snap,
    reservations: (snap.reservations ?? []).map((r) => (r.id === reservationId ? reservation : r)),
    inventoryReservations: (snap.inventoryReservations ?? []).map((r) =>
      r.id === `irsv-${reservationId}` && r.status === "open"
        ? { ...r, status: "released" as const, revision: r.revision + 1 }
        : r,
    ),
  };
  if (!pallet) return { ok: true, reservation, snap: released };
  const led = applyTxToSnapshot(released, {
    type: "DEALLOCATE",
    skuId: row.skuId,
    lot: pallet.lot || null,
    fromLocationId: locationOfPallet(pallet),
    qty: row.qty,
    reason: `deallocate ${row.orderCode}`,
    refType: "reservation",
    refId: reservationId,
    palletId: pallet.id,
    at: row.at,
    id: `itx-DEALLOC-${reservationId}`,
  });
  if (!led.ok) return { ok: false, error: "stock_shortage" };
  return { ok: true, reservation, snap: led.snap };
}
