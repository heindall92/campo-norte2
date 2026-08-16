import { WMS_DEMO_NOW } from "./alerts";
import type { ShipmentStatus, TrackingEvent, WmsShipment, WmsSnapshot } from "./types";

export type ShippingError =
  | "order_missing"
  | "order_done"
  | "shipment_missing"
  | "shipment_cancelled"
  | "already_shipped";

export type ShippingResult =
  | { ok: true; snap: WmsSnapshot; shipmentId: string }
  | { ok: false; error: ShippingError };

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function shipmentForOrder(snap: WmsSnapshot, orderId: string): WmsShipment | null {
  return (snap.shipments ?? []).find((s) => s.orderId === orderId && s.status !== "CANCELLED") ?? null;
}

function packageIdsForOrder(snap: WmsSnapshot, orderId: string): string[] {
  return (snap.packPackages ?? []).filter((p) => p.orderId === orderId).map((p) => p.id);
}

function patchShipment(snap: WmsSnapshot, shipmentId: string, patch: Partial<WmsShipment>): WmsSnapshot {
  return {
    ...snap,
    shipments: (snap.shipments ?? []).map((s) => (s.id === shipmentId ? { ...s, ...patch } : s)),
  };
}

function appendEvent(
  snap: WmsSnapshot,
  event: Omit<TrackingEvent, "id"> & { id?: string },
): WmsSnapshot {
  const row: TrackingEvent = {
    id: event.id ?? uid("tev"),
    shipmentId: event.shipmentId,
    at: event.at,
    code: event.code,
    note: event.note,
    source: event.source,
  };
  return { ...snap, trackingEvents: [row, ...(snap.trackingEvents ?? [])] };
}

/** Abre un shipment del pedido si no hay uno vivo. No inventa tracking. */
export function ensureShipment(snap: WmsSnapshot, orderId: string, at = WMS_DEMO_NOW): ShippingResult {
  const order = snap.outbound.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "order_missing" };
  const existing = shipmentForOrder(snap, orderId);
  if (existing) {
    return {
      ok: true,
      shipmentId: existing.id,
      snap: patchShipment(snap, existing.id, { packageIds: packageIdsForOrder(snap, orderId) }),
    };
  }
  const shipment: WmsShipment = {
    id: uid("shp"),
    orderId,
    status: "PACKED",
    packedAt: null,
    stagedAt: null,
    loadedAt: null,
    shippedAt: null,
    cancelledAt: null,
    carrierId: order.carrierId,
    tracking: order.tracking,
    mock: false,
    packageIds: packageIdsForOrder(snap, orderId),
    createdAt: at,
  };
  return { ok: true, snap: { ...snap, shipments: [shipment, ...(snap.shipments ?? [])] }, shipmentId: shipment.id };
}

function advance(
  snap: WmsSnapshot,
  orderId: string,
  status: Exclude<ShipmentStatus, "CANCELLED">,
  stamp: keyof Pick<WmsShipment, "packedAt" | "stagedAt" | "loadedAt" | "shippedAt">,
  at: string,
): ShippingResult {
  const order = snap.outbound.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "order_missing" };
  const opened = ensureShipment(snap, orderId, at);
  if (!opened.ok) return opened;
  const current = opened.snap.shipments.find((s) => s.id === opened.shipmentId)!;
  if (current.status === "CANCELLED") return { ok: false, error: "shipment_cancelled" };
  if (current.status === "SHIPPED" && status !== "SHIPPED") return { ok: false, error: "already_shipped" };
  const next = patchShipment(opened.snap, current.id, {
    status: current.status === "SHIPPED" ? "SHIPPED" : status,
    [stamp]: current[stamp] ?? at,
    carrierId: current.carrierId ?? order.carrierId,
    tracking: current.tracking ?? order.tracking,
    packageIds: packageIdsForOrder(opened.snap, orderId),
  });
  return { ok: true, snap: next, shipmentId: current.id };
}

export function markShipmentPacked(snap: WmsSnapshot, orderId: string, at = WMS_DEMO_NOW): ShippingResult {
  return advance(snap, orderId, "PACKED", "packedAt", at);
}

export function markShipmentStaged(snap: WmsSnapshot, orderId: string, at = WMS_DEMO_NOW): ShippingResult {
  return advance(snap, orderId, "STAGED", "stagedAt", at);
}

export function markShipmentLoaded(snap: WmsSnapshot, orderId: string, at = WMS_DEMO_NOW): ShippingResult {
  return advance(snap, orderId, "LOADED", "loadedAt", at);
}

export function markShipmentShipped(snap: WmsSnapshot, orderId: string, at = WMS_DEMO_NOW): ShippingResult {
  return advance(snap, orderId, "SHIPPED", "shippedAt", at);
}

export function cancelWmsShipment(snap: WmsSnapshot, shipmentId: string, at = WMS_DEMO_NOW): ShippingResult {
  const shipment = (snap.shipments ?? []).find((s) => s.id === shipmentId);
  if (!shipment) return { ok: false, error: "shipment_missing" };
  if (shipment.status === "SHIPPED") return { ok: false, error: "already_shipped" };
  if (shipment.status === "CANCELLED") return { ok: false, error: "shipment_cancelled" };
  let next = patchShipment(snap, shipmentId, { status: "CANCELLED", cancelledAt: at });
  next = appendEvent(next, {
    shipmentId,
    at,
    code: "CANCELLED",
    note: "MockCarrierAdapter · cancelado. No es un evento de transportista real.",
    source: "mock",
  });
  return { ok: true, snap: next, shipmentId };
}

export interface CarrierAdapter {
  readonly kind: "mock";
  readonly displayName: string;
  createShipment(
    snap: WmsSnapshot,
    orderId: string,
    writtenTracking?: string | null,
    at?: string,
  ): ShippingResult;
  getLabel(snap: WmsSnapshot, shipmentId: string, lang?: "es" | "en"): string | null;
  trackShipment(snap: WmsSnapshot, shipmentId: string): TrackingEvent[];
  cancelShipment(snap: WmsSnapshot, shipmentId: string, at?: string): ShippingResult;
}

function escHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Adapter etiquetado mock. No importa SEUR/DHL.
 * createShipment no fabrica tracking: solo lo guarda si se escribe.
 */
export class MockCarrierAdapter implements CarrierAdapter {
  readonly kind = "mock" as const;
  readonly displayName = "MockCarrierAdapter";

  createShipment(
    snap: WmsSnapshot,
    orderId: string,
    writtenTracking: string | null = null,
    at = WMS_DEMO_NOW,
  ): ShippingResult {
    const order = snap.outbound.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: "order_missing" };
    if (order.status === "expedido") return { ok: false, error: "order_done" };
    const opened = ensureShipment(snap, orderId, at);
    if (!opened.ok) return opened;
    const tracking = writtenTracking?.trim() || opened.snap.shipments.find((s) => s.id === opened.shipmentId)?.tracking || null;
    let next = patchShipment(opened.snap, opened.shipmentId, {
      tracking,
      mock: Boolean(tracking),
      carrierId: order.carrierId,
    });
    next = {
      ...next,
      outbound: next.outbound.map((o) => (o.id === orderId ? { ...o, tracking } : o)),
    };
    next = appendEvent(next, {
      shipmentId: opened.shipmentId,
      at,
      code: "CREATED",
      note: tracking
        ? "MockCarrierAdapter · tracking escrito (no es un envío SEUR/DHL)."
        : "MockCarrierAdapter · creado sin tracking. No se fabrica número de transportista.",
      source: "mock",
    });
    return { ok: true, snap: next, shipmentId: opened.shipmentId };
  }

  getLabel(snap: WmsSnapshot, shipmentId: string, lang: "es" | "en" = "es"): string | null {
    const shipment = (snap.shipments ?? []).find((s) => s.id === shipmentId);
    if (!shipment) return null;
    const order = snap.outbound.find((o) => o.id === shipment.orderId);
    if (!order) return null;
    const title = lang === "es" ? "Etiqueta MOCK" : "MOCK label";
    const tracking = shipment.tracking ?? (lang === "es" ? "sin tracking" : "no tracking");
    const hint =
      lang === "es"
        ? "MockCarrierAdapter. No es una etiqueta SEUR ni DHL."
        : "MockCarrierAdapter. Not a SEUR or DHL label.";
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/><title>${escHtml(title)} ${escHtml(order.code)}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;margin:12px;background:#e2e8f0}
  .label{background:#fff;border:2px dashed #b45309;border-radius:8px;padding:16px 18px;max-width:420px}
  .mock{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#b45309;font-weight:800;margin:0}
  h1{font-size:20px;margin:8px 0 4px}
  .meta{color:#475569;font-size:12px}
  .track{font-family:ui-monospace,monospace;font-size:16px;font-weight:700;margin:12px 0}
</style></head><body>
  <article class="label">
    <p class="mock">MOCK</p>
    <h1>${escHtml(order.customer)}</h1>
    <p class="meta">${escHtml(order.code)} · ${escHtml(this.displayName)}</p>
    <p class="track">${escHtml(tracking)}</p>
    <p class="meta">${escHtml(hint)}</p>
  </article>
</body></html>`;
  }

  trackShipment(snap: WmsSnapshot, shipmentId: string): TrackingEvent[] {
    return (snap.trackingEvents ?? []).filter((e) => e.shipmentId === shipmentId);
  }

  cancelShipment(snap: WmsSnapshot, shipmentId: string, at = WMS_DEMO_NOW): ShippingResult {
    return cancelWmsShipment(snap, shipmentId, at);
  }
}

export const mockCarrierAdapter = new MockCarrierAdapter();

export function openMockLabelPrint(snap: WmsSnapshot, shipmentId: string, lang: "es" | "en" = "es"): boolean {
  if (typeof window === "undefined") return false;
  const html = mockCarrierAdapter.getLabel(snap, shipmentId, lang);
  if (!html) return false;
  const popup = window.open("", "_blank", "noopener,noreferrer,width=520,height=640");
  if (!popup) return false;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}
