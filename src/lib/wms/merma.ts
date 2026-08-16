import { WMS_DEMO_NOW } from "./alerts";
import { applyTxToSnapshot, locationOfPallet } from "./inventory-core";
import { codesEqual } from "./location";
import type { MermaEvent, MermaReason, WmsSnapshot } from "./types";

export type MermaError =
  | "pallet_missing"
  | "wrong_from"
  | "invalid_qty"
  | "merma_slot"
  | "already_shipped";

export type MermaResult =
  | { ok: true; snap: WmsSnapshot; mermaId: string }
  | { ok: false; error: MermaError };

export const MERMA_REASON_LABEL: Record<MermaReason, { es: string; en: string }> = {
  caida: { es: "Se ha caído", en: "Dropped" },
  rota: { es: "Rota / rota en hueco", en: "Broken" },
  otra: { es: "Otra (escribir)", en: "Other (write it)" },
};

/**
 * Declara merma y baja el stock del palet.
 * Sin esta marca, coger otra caja para el súper deja un faltante que nadie ve.
 * No fabrica SSCC ni un pasillo de merma: el destino solo cuenta si lo escriben.
 */
export function declareMerma(
  snap: WmsSnapshot,
  input: {
    sscc: string;
    fromSlotCode: string;
    qty: number;
    reason: MermaReason;
    note?: string;
    operatorId?: string | null;
    mermaSlotCode?: string | null;
  },
  at = new Date().toISOString(),
): MermaResult {
  const pallet = snap.pallets.find((p) => p.sscc === input.sscc.trim());
  if (!pallet) return { ok: false, error: "pallet_missing" };
  if (pallet.status === "expedido") return { ok: false, error: "already_shipped" };
  if (!Number.isFinite(input.qty) || input.qty < 1 || input.qty > pallet.qty) {
    return { ok: false, error: "invalid_qty" };
  }

  const from = pallet.slotId ? snap.slots.find((s) => s.id === pallet.slotId) : undefined;
  if (!from || !codesEqual(from.code, input.fromSlotCode)) {
    return { ok: false, error: "wrong_from" };
  }

  let mermaSlotId: string | null = null;
  const destCode = input.mermaSlotCode?.trim() ?? "";
  if (destCode) {
    const dest = snap.slots.find((s) => s.siteId === pallet.siteId && codesEqual(s.code, destCode));
    if (!dest) return { ok: false, error: "merma_slot" };
    mermaSlotId = dest.id;
  }

  const remaining = pallet.qty - input.qty;
  const emptied = remaining <= 0;
  const pallets = snap.pallets.map((p) =>
    p.id === pallet.id
      ? {
          ...p,
          qty: Math.max(0, remaining),
          slotId: emptied ? null : p.slotId,
        }
      : p,
  );
  const slots = emptied
    ? snap.slots.map((s) =>
        s.id === from.id ? { ...s, palletId: null, status: "libre" as const } : s,
      )
    : snap.slots;

  const event: MermaEvent = {
    id: `merma-${pallet.id}-${at}`,
    at,
    siteId: pallet.siteId,
    skuId: pallet.skuId,
    palletId: pallet.id,
    fromSlotId: from.id,
    qty: input.qty,
    reason: input.reason,
    note: input.note?.trim() ?? "",
    operatorId: input.operatorId ?? null,
    mermaSlotId,
  };

  const reasonLabel = MERMA_REASON_LABEL[input.reason].es;
  const physical: WmsSnapshot = {
    ...snap,
    pallets,
    slots,
    mermaEvents: [event, ...snap.mermaEvents],
    movements: [
      {
        id: `mv-merma-${pallet.id}-${at}`,
        at,
        type: "ajuste",
        skuId: pallet.skuId,
        palletId: pallet.id,
        fromSlotId: from.id,
        toSlotId: mermaSlotId,
        qty: input.qty,
        operatorId: input.operatorId ?? null,
        fleetId: null,
        note: `Merma declarada · ${reasonLabel} · ${input.qty} ud.${destCode ? ` → ${destCode}` : ""}`,
      },
      ...snap.movements,
    ],
  };
  const led = applyTxToSnapshot(physical, {
    type: "ADJUSTMENT",
    skuId: pallet.skuId,
    lot: pallet.lot || null,
    fromLocationId: locationOfPallet(pallet),
    qty: -input.qty,
    reason: `merma:${input.reason}`,
    refType: "merma",
    refId: event.id,
    palletId: pallet.id,
    actorId: input.operatorId ?? null,
    at,
    id: `itx-ADJ-${event.id}`,
  });
  if (!led.ok) return { ok: false, error: "invalid_qty" };
  return { ok: true, mermaId: event.id, snap: led.snap };
}

export function mermaToday(snap: WmsSnapshot, siteId?: string, dayIso = WMS_DEMO_NOW): MermaEvent[] {
  const day = dayIso.slice(0, 10);
  return snap.mermaEvents.filter((e) => {
    if (siteId && e.siteId !== siteId) return false;
    if (day && e.at.slice(0, 10) !== day) return false;
    return true;
  });
}

export function mermaQtyForPallet(snap: WmsSnapshot, palletId: string): number {
  return snap.mermaEvents.filter((e) => e.palletId === palletId).reduce((s, e) => s + e.qty, 0);
}
