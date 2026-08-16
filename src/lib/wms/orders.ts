import type { OutboundOrder, WmsSnapshot } from "./types";
import { appendAudit } from "./audit";

export type OrderTransitionError = "order_missing" | "illegal_transition" | "already_terminal";

const ALLOWED: Record<OutboundOrder["status"], OutboundOrder["status"][]> = {
  pendiente: ["picking", "embalaje"],
  picking: ["embalaje", "muelle"],
  embalaje: ["muelle", "expedido"],
  muelle: ["expedido"],
  expedido: [],
};

export function canTransitionOrder(
  from: OutboundOrder["status"],
  to: OutboundOrder["status"],
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function transitionOrder(
  snap: WmsSnapshot,
  orderId: string,
  to: OutboundOrder["status"],
  actorId: string | null = null,
  at = "2026-08-15T12:00:00.000Z",
): { ok: true; snap: WmsSnapshot } | { ok: false; error: OrderTransitionError } {
  const order = snap.outbound.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "order_missing" };
  if (order.status === "expedido" && to !== "expedido") return { ok: false, error: "already_terminal" };
  if (!canTransitionOrder(order.status, to)) return { ok: false, error: "illegal_transition" };
  const next: WmsSnapshot = {
    ...snap,
    outbound: snap.outbound.map((o) => (o.id === orderId ? { ...o, status: to } : o)),
  };
  return {
    ok: true,
    snap: appendAudit(next, {
      at,
      actorId,
      action: `order.${order.status}->${to}`,
      entityType: "order",
      entityId: orderId,
      before: order.status,
      after: to,
    }),
  };
}

export function upsertOrderLine(
  snap: WmsSnapshot,
  line: {
    id?: string;
    orderId: string;
    skuId: string;
    qtyOrdered: number;
  },
): { ok: true; snap: WmsSnapshot; lineId: string } | { ok: false; error: "invalid_qty" | "order_missing" } {
  if (!snap.outbound.some((o) => o.id === line.orderId)) return { ok: false, error: "order_missing" };
  if (!Number.isFinite(line.qtyOrdered) || line.qtyOrdered < 1) return { ok: false, error: "invalid_qty" };
  const id = line.id ?? `ol-${line.orderId}-${line.skuId}`;
  const existing = (snap.orderLines ?? []).filter((l) => l.id !== id);
  return {
    ok: true,
    lineId: id,
    snap: {
      ...snap,
      orderLines: [
        ...existing,
        {
          id,
          orderId: line.orderId,
          skuId: line.skuId,
          qtyOrdered: line.qtyOrdered,
          qtyAllocated: 0,
          qtyPicked: 0,
          qtyShipped: 0,
        },
      ],
    },
  };
}
