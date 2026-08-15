import type { WmsSnapshot } from "./types";

export type AssignCarrierError = "order_missing" | "carrier_missing" | "inactive" | "wrong_org";

const DOCK_WINDOW_MS = 90 * 60 * 1000;

/** Ventana de muelle derivada del cut-off del pedido (no se inventa otra hora). */
export function dockWindowFor(cutOffIso: string): { start: string; end: string } {
  const end = new Date(cutOffIso);
  if (Number.isNaN(end.getTime())) return { start: cutOffIso, end: cutOffIso };
  const start = new Date(end.getTime() - DOCK_WINDOW_MS);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function assignOutboundCarrier(
  snap: WmsSnapshot,
  orderId: string,
  carrierId: string,
): { ok: true; snap: WmsSnapshot } | { ok: false; error: AssignCarrierError } {
  const order = snap.outbound.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "order_missing" };
  const carrier = snap.carriers.find((c) => c.id === carrierId);
  if (!carrier) return { ok: false, error: "carrier_missing" };
  if (!carrier.active) return { ok: false, error: "inactive" };
  if (carrier.orgId !== snap.org.id) return { ok: false, error: "wrong_org" };

  const window = dockWindowFor(order.cutOff);
  return {
    ok: true,
    snap: {
      ...snap,
      outbound: snap.outbound.map((o) =>
        o.id === orderId
          ? {
              ...o,
              carrierId: carrier.id,
              dockWindowStart: o.dockWindowStart ?? window.start,
              dockWindowEnd: o.dockWindowEnd ?? window.end,
            }
          : o,
      ),
    },
  };
}

/** El tracking lo escribe el usuario / el carrier; aquí no se fabrica. */
export function setOutboundTracking(
  snap: WmsSnapshot,
  orderId: string,
  tracking: string,
): { ok: true; snap: WmsSnapshot } | { ok: false; error: "order_missing" } {
  const order = snap.outbound.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "order_missing" };
  const value = tracking.trim();
  return {
    ok: true,
    snap: {
      ...snap,
      outbound: snap.outbound.map((o) =>
        o.id === orderId ? { ...o, tracking: value.length ? value : null } : o,
      ),
    },
  };
}
