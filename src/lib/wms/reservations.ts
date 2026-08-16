import type { StockReservation, WmsSnapshot } from "./types";
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
  return Math.max(0, pallet.qty - heldQty(snap, palletId));
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

  return {
    ok: true,
    reservation,
    snap: { ...snap, reservations: [reservation, ...(snap.reservations ?? [])] },
  };
}

export function releaseReservation(snap: WmsSnapshot, reservationId: string): ReserveResult {
  const row = (snap.reservations ?? []).find((r) => r.id === reservationId);
  if (!row || row.status !== "hold") return { ok: false, error: "hold_missing" };
  const reservation = { ...row, status: "released" as const, revision: row.revision + 1 };
  return {
    ok: true,
    reservation,
    snap: {
      ...snap,
      reservations: (snap.reservations ?? []).map((r) => (r.id === reservationId ? reservation : r)),
    },
  };
}
