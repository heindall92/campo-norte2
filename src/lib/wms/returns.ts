import type { WmsSnapshot } from "./types";

export type ReturnError =
  | "pallet_missing"
  | "not_shipped"
  | "order_missing"
  | "order_not_shipped"
  | "warehouse_mismatch"
  | "slot_missing"
  | "slot_occupied"
  | "slot_blocked";

export type ReturnResult = { ok: true; snap: WmsSnapshot } | { ok: false; error: ReturnError };

/**
 * Devuelve un palet ya expedido a un hueco real.
 * No fabrica SSCC ni cantidad: el palet sigue siendo el mismo.
 */
export function returnShippedPallet(
  snap: WmsSnapshot,
  input: {
    palletId: string;
    orderCode: string;
    toSlotCode: string;
    operatorId?: string | null;
    at?: string;
  },
): ReturnResult {
  const pallet = snap.pallets.find((p) => p.id === input.palletId);
  if (!pallet) return { ok: false, error: "pallet_missing" };
  if (pallet.status !== "expedido") return { ok: false, error: "not_shipped" };

  const order = snap.outbound.find((o) => o.code === input.orderCode);
  if (!order) return { ok: false, error: "order_missing" };
  if (order.status !== "expedido") return { ok: false, error: "order_not_shipped" };
  if (order.siteId !== pallet.siteId) return { ok: false, error: "warehouse_mismatch" };

  const slot = snap.slots.find(
    (s) => s.siteId === pallet.siteId && s.code.toUpperCase() === input.toSlotCode.trim().toUpperCase(),
  );
  if (!slot) return { ok: false, error: "slot_missing" };
  if (slot.status === "bloqueado") return { ok: false, error: "slot_blocked" };
  if (slot.palletId) return { ok: false, error: "slot_occupied" };

  const at = input.at ?? "2026-08-15T12:00:00.000Z";
  return {
    ok: true,
    snap: {
      ...snap,
      slots: snap.slots.map((s) =>
        s.id === slot.id ? { ...s, palletId: pallet.id, status: "ocupado" as const } : s,
      ),
      pallets: snap.pallets.map((p) =>
        p.id === pallet.id ? { ...p, status: "en_ubicacion" as const, slotId: slot.id } : p,
      ),
      movements: [
        {
          id: `mv-ret-${pallet.id}-${at}`,
          at,
          type: "entrada",
          skuId: pallet.skuId,
          palletId: pallet.id,
          fromSlotId: null,
          toSlotId: slot.id,
          qty: pallet.qty,
          operatorId: input.operatorId ?? null,
          fleetId: null,
          note: `Devolución ${order.code}`,
        },
        ...snap.movements,
      ],
    },
  };
}
