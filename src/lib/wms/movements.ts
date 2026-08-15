import { codesEqual } from "./location";
import type { Pallet, Slot, StockMovement, WmsSnapshot } from "./types";

export type LiveMoveError =
  | "pallet_missing"
  | "wrong_sscc"
  | "wrong_from"
  | "to_missing"
  | "slot_occupied"
  | "slot_blocked"
  | "same_slot"
  | "not_on_dock";

export type LiveMoveResult =
  | { ok: true; snap: WmsSnapshot }
  | { ok: false; error: LiveMoveError };

export type TransferInput = {
  sscc: string;
  fromSlotCode: string;
  toSlotCode: string;
  operatorId?: string | null;
  fleetId?: string | null;
  note?: string;
};

function findSlot(snap: WmsSnapshot, code: string, siteId?: string): Slot | undefined {
  const upper = code.trim().toUpperCase();
  return snap.slots.find(
    (s) => codesEqual(s.code, upper) && (!siteId || s.siteId === siteId),
  );
}

function occupy(slot: Slot, pallet: Pallet): Slot {
  return { ...slot, status: slot.zone === "muelle" ? "ocupado" : "ocupado", palletId: pallet.id };
}

function vacate(slot: Slot): Slot {
  return { ...slot, status: "libre", palletId: null };
}

function appendMove(
  snap: WmsSnapshot,
  movement: StockMovement,
  slots: Slot[],
  pallets: Pallet[],
): WmsSnapshot {
  const operators = snap.operators.map((o) =>
    o.id === movement.operatorId ? { ...o, movesToday: o.movesToday + 1 } : o,
  );
  return {
    ...snap,
    slots,
    pallets,
    movements: [movement, ...snap.movements],
    operators,
  };
}

function relocate(
  snap: WmsSnapshot,
  pallet: Pallet,
  from: Slot,
  to: Slot,
  type: StockMovement["type"],
  input: TransferInput,
  at: string,
): LiveMoveResult {
  if (from.id === to.id) return { ok: false, error: "same_slot" };
  if (to.status === "bloqueado") return { ok: false, error: "slot_blocked" };
  if (to.palletId && to.palletId !== pallet.id) return { ok: false, error: "slot_occupied" };

  const nextSlots = snap.slots.map((s) => {
    if (s.id === from.id) return vacate(s);
    if (s.id === to.id) return occupy(s, pallet);
    return s;
  });
  const nextPallets = snap.pallets.map((p) =>
    p.id === pallet.id
      ? {
          ...p,
          slotId: to.id,
          status: to.zone === "muelle" ? ("muelle" as const) : ("en_ubicacion" as const),
        }
      : p,
  );
  const movement: StockMovement = {
    id: `mv-live-${pallet.id}-${at}`,
    at,
    type,
    skuId: pallet.skuId,
    palletId: pallet.id,
    fromSlotId: from.id,
    toSlotId: to.id,
    qty: pallet.qty,
    operatorId: input.operatorId ?? null,
    fleetId: input.fleetId ?? null,
    note: input.note ?? `${from.code} → ${to.code}`,
  };
  return { ok: true, snap: appendMove(snap, movement, nextSlots, nextPallets) };
}

/** Putaway: palet en muelle → hueco de almacén. */
export function confirmPutaway(
  snap: WmsSnapshot,
  input: TransferInput,
  at = "2026-08-15T11:05:00.000Z",
): LiveMoveResult {
  const pallet = snap.pallets.find((p) => p.sscc === input.sscc.trim());
  if (!pallet) return { ok: false, error: "pallet_missing" };
  const from = pallet.slotId ? snap.slots.find((s) => s.id === pallet.slotId) : undefined;
  if (!from || from.zone !== "muelle") return { ok: false, error: "not_on_dock" };
  if (!codesEqual(from.code, input.fromSlotCode)) return { ok: false, error: "wrong_from" };
  const to = findSlot(snap, input.toSlotCode, pallet.siteId);
  if (!to) return { ok: false, error: "to_missing" };
  return relocate(snap, pallet, from, to, "entrada", { ...input, note: input.note ?? `Putaway ${to.code}` }, at);
}

/** Traslado RF entre huecos (reposición reserva → picking o movimiento interno). */
export function confirmTransfer(
  snap: WmsSnapshot,
  input: TransferInput,
  at = "2026-08-15T11:10:00.000Z",
): LiveMoveResult {
  const pallet = snap.pallets.find((p) => p.sscc === input.sscc.trim());
  if (!pallet) return { ok: false, error: "pallet_missing" };
  const from = pallet.slotId ? snap.slots.find((s) => s.id === pallet.slotId) : undefined;
  if (!from || !codesEqual(from.code, input.fromSlotCode)) return { ok: false, error: "wrong_from" };
  const to = findSlot(snap, input.toSlotCode, pallet.siteId);
  if (!to) return { ok: false, error: "to_missing" };
  return relocate(snap, pallet, from, to, "traslado", input, at);
}

export type ReplenishmentProposal = {
  id: string;
  siteId: string;
  skuId: string;
  fromSlotId: string;
  toSlotId: string;
  palletId: string;
  aisle: string;
  recommendedFleetKind: "retractil_doble";
};

/** Cara de picking vacía + reserva encima (misma bahía/posición) → bajar con retráctil doble. */
export function proposeReplenishments(snap: WmsSnapshot): ReplenishmentProposal[] {
  const proposals: ReplenishmentProposal[] = [];
  const palletMap = new Map(snap.pallets.map((p) => [p.id, p]));

  for (const face of snap.slots) {
    if (!face.pickFace || face.status !== "libre") continue;
    const above = snap.slots
      .filter(
        (s) =>
          s.siteId === face.siteId &&
          s.aisle === face.aisle &&
          s.rack === face.rack &&
          s.position === face.position &&
          s.level > 1 &&
          Boolean(s.palletId),
      )
      .sort((a, b) => a.level - b.level)[0];
    if (!above?.palletId) continue;
    const pallet = palletMap.get(above.palletId);
    if (!pallet || pallet.status === "expedido") continue;
    proposals.push({
      id: `rep-${above.id}-${face.id}`,
      siteId: face.siteId,
      skuId: pallet.skuId,
      fromSlotId: above.id,
      toSlotId: face.id,
      palletId: pallet.id,
      aisle: face.aisle,
      recommendedFleetKind: "retractil_doble",
    });
  }
  return proposals;
}

export function applyReplenishment(
  snap: WmsSnapshot,
  proposal: ReplenishmentProposal,
  fleetId: string | null,
  operatorId: string | null,
  at = "2026-08-15T11:12:00.000Z",
): LiveMoveResult {
  const pallet = snap.pallets.find((p) => p.id === proposal.palletId);
  const from = snap.slots.find((s) => s.id === proposal.fromSlotId);
  const to = snap.slots.find((s) => s.id === proposal.toSlotId);
  if (!pallet || !from || !to) return { ok: false, error: "pallet_missing" };
  return confirmTransfer(
    snap,
    {
      sscc: pallet.sscc,
      fromSlotCode: from.code,
      toSlotCode: to.code,
      fleetId,
      operatorId,
      note: `Reposición pick face ${to.code}`,
    },
    at,
  );
}
