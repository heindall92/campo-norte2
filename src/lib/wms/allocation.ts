import { wmsUid } from "./ids";
import { recordPhysicalTx, rebuildBalancesFromPallets, selectFefo, skuAvailable } from "./inventory";
import type { InventoryReservation, OrderLine, WmsSnapshot } from "./types";
import { appendAudit } from "./audit";

export type AllocateError =
  | "order_missing"
  | "no_lines"
  | "insufficient_stock"
  | "over_allocate"
  | "negative_stock"
  | "pallet_missing"
  | "invalid_qty";

function linesOf(snap: WmsSnapshot, orderId: string): OrderLine[] {
  return (snap.orderLines ?? []).filter((l) => l.orderId === orderId);
}

function openReservations(snap: WmsSnapshot): InventoryReservation[] {
  return (snap.reservations ?? []).filter((r) => r.status === "open");
}

/**
 * Reserva FEFO. No puede superar available ni qtyOrdered − qtyAllocated.
 */
export function allocateOrder(
  snap: WmsSnapshot,
  orderId: string,
  actorId: string | null = null,
  at = "2026-08-15T10:30:00.000Z",
): { ok: true; snap: WmsSnapshot } | { ok: false; error: AllocateError } {
  const order = snap.outbound.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "order_missing" };
  if (order.status === "expedido") return { ok: false, error: "order_missing" };
  const lines = linesOf(snap, orderId);
  if (!lines.length) return { ok: false, error: "no_lines" };

  let next = snap;

  for (const line of lines) {
    const need = line.qtyOrdered - line.qtyAllocated;
    if (need <= 0) continue;
    const avail = skuAvailable(next, line.skuId, order.siteId);
    if (avail < need) return { ok: false, error: "insufficient_stock" };
    const picks = selectFefo(next, line.skuId, order.siteId, need);
    const got = picks.reduce((s, p) => s + p.qty, 0);
    if (got < need) return { ok: false, error: "insufficient_stock" };

    for (const pick of picks) {
      const reservation: InventoryReservation = {
        id: wmsUid("res"),
        orderId,
        orderLineId: line.id,
        palletId: pick.palletId,
        skuId: line.skuId,
        qty: pick.qty,
        status: "open",
      };
      const withRes: WmsSnapshot = {
        ...next,
        reservations: [reservation, ...(next.reservations ?? [])],
      };
      const availNow = skuAvailable(withRes, line.skuId, order.siteId);
      if (availNow < 0) return { ok: false, error: "over_allocate" };
      next = recordPhysicalTx(withRes, {
        at,
        type: "ALLOCATE",
        skuId: line.skuId,
        palletId: pick.palletId,
        lot: pick.lot,
        fromSlotId: withRes.pallets.find((p) => p.id === pick.palletId)?.slotId ?? null,
        toSlotId: null,
        qty: pick.qty,
        operatorId: actorId,
        note: `ALLOCATE ${order.code} · ${line.id}`,
        idempotencyKey: `alloc-${orderId}-${line.id}-${pick.palletId}`,
      });
    }
    next = {
      ...next,
      orderLines: (next.orderLines ?? []).map((l) =>
        l.id === line.id ? { ...l, qtyAllocated: l.qtyOrdered } : l,
      ),
    };
  }

  const snap2: WmsSnapshot = {
    ...next,
    balances: rebuildBalancesFromPallets(next),
  };
  return {
    ok: true,
    snap: appendAudit(snap2, {
      at,
      actorId,
      action: "order.allocate",
      entityType: "order",
      entityId: orderId,
      before: "unallocated",
      after: "allocated",
    }),
  };
}

export function deallocateOrder(
  snap: WmsSnapshot,
  orderId: string,
  at = "2026-08-15T10:31:00.000Z",
): { ok: true; snap: WmsSnapshot } | { ok: false; error: AllocateError } {
  const open = openReservations(snap).filter((r) => r.orderId === orderId);
  let next = snap;
  for (const res of open) {
    next = recordPhysicalTx(
      {
        ...next,
        reservations: (next.reservations ?? []).map((r) =>
          r.id === res.id ? { ...r, status: "cancelled" as const } : r,
        ),
      },
      {
        at,
        type: "DEALLOCATE",
        skuId: res.skuId,
        palletId: res.palletId,
        lot: next.pallets.find((p) => p.id === res.palletId)?.lot ?? null,
        fromSlotId: null,
        toSlotId: null,
        qty: res.qty,
        operatorId: null,
        note: `DEALLOCATE ${res.id}`,
      },
    );
  }
  const cancelled: WmsSnapshot = {
    ...next,
    orderLines: (next.orderLines ?? []).map((l) =>
      l.orderId === orderId ? { ...l, qtyAllocated: 0 } : l,
    ),
  };
  return { ok: true, snap: { ...cancelled, balances: rebuildBalancesFromPallets(cancelled) } };
}

export function consumeReservationOnPick(
  snap: WmsSnapshot,
  palletId: string,
  qty: number,
): WmsSnapshot {
  let remaining = qty;
  const reservations = (snap.reservations ?? []).map((r) => {
    if (r.status !== "open" || r.palletId !== palletId || remaining <= 0) return r;
    const take = Math.min(r.qty, remaining);
    remaining -= take;
    if (take >= r.qty) return { ...r, status: "consumed" as const };
    return { ...r, qty: r.qty - take };
  });
  return { ...snap, reservations, balances: rebuildBalancesFromPallets({ ...snap, reservations }) };
}
