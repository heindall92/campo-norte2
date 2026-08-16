/**
 * Carrier adapter. DEMO y PRODUCTION escriben tracking a mano.
 * No se fabrican números de seguimiento ni se llama a APIs de transportista.
 */

export type CarrierShipmentInput = {
  orderId: string;
  tracking?: string | null;
};

export type CarrierShipmentResult =
  | { ok: true; tracking: string }
  | { ok: false; error: "tracking_required" };

export interface CarrierAdapter {
  name: "manual";
  createShipment(input: CarrierShipmentInput): CarrierShipmentResult;
}

export const ManualCarrierAdapter: CarrierAdapter = {
  name: "manual",
  createShipment(input) {
    const tracking = input.tracking?.trim() ?? "";
    if (!tracking) return { ok: false, error: "tracking_required" };
    return { ok: true, tracking };
  },
};

export function applyManualTracking(
  typed: string,
): { ok: true; tracking: string | null } | { ok: false; error: "tracking_required" } {
  const result = ManualCarrierAdapter.createShipment({ orderId: "", tracking: typed });
  if (!result.ok) {
    return typed.trim() === "" ? { ok: true, tracking: null } : result;
  }
  return { ok: true, tracking: result.tracking };
}
