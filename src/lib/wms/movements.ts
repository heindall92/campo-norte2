import { closeAsnIfLocated } from "./catalog";
import { applyTxToSnapshot, locationOfPallet } from "./inventory-core";
import { codesEqual } from "./location";
import { palletCanPutaway } from "./receiving";
import { WMS_DEMO_NOW } from "./alerts";
import type { InventoryTxType, Pallet, Slot, StockMovement, WmsSnapshot } from "./types";

export {
  addSlottingRule,
  openSlottingRecommendation,
  PUTAWAY_REASON_LABEL,
  rankPutawayCandidates,
  suggestPutawaySlot,
  travelPctBetween,
  zoneForCategory,
} from "./slotting";

export type LiveMoveError =
  | "pallet_missing"
  | "wrong_sscc"
  | "wrong_from"
  | "to_missing"
  | "slot_occupied"
  | "slot_blocked"
  | "same_slot"
  | "not_on_dock"
  | "same_site"
  | "pallet_shipped"
  | "pallet_in_wave"
  | "stock_negative"
  | "qc_pending"
  | "pallet_quarantined"
  | "rec_missing"
  | "rec_accepted";

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
  ledgerType?: Extract<InventoryTxType, "PUTAWAY" | "MOVE" | "REPLENISH">;
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
  const physical = appendMove(snap, movement, nextSlots, nextPallets);
  if (pallet.qty < 1) return { ok: true, snap: physical };
  const led = applyTxToSnapshot(physical, {
    type: input.ledgerType ?? (type === "entrada" ? "PUTAWAY" : "MOVE"),
    skuId: pallet.skuId,
    lot: pallet.lot || null,
    fromLocationId: from.id,
    toLocationId: to.id,
    qty: pallet.qty,
    reason: movement.note,
    refType: "pallet",
    refId: pallet.id,
    palletId: pallet.id,
    actorId: input.operatorId ?? null,
    at,
    id: `itx-MOVE-${pallet.id}-${at}`,
  });
  if (!led.ok) return { ok: false, error: "stock_negative" };
  return { ok: true, snap: led.snap };
}

/** Ubica un palet de muelle y cierra el ASN si ya no queda ninguno suyo en muelle. */
export function putawayReceivedPallet(
  snap: WmsSnapshot,
  palletId: string,
  toSlotCode: string,
  operatorId: string | null,
  fleetId: string | null = null,
  at?: string,
): LiveMoveResult {
  const pallet = snap.pallets.find((p) => p.id === palletId);
  if (!pallet) return { ok: false, error: "pallet_missing" };
  const from = pallet.slotId ? snap.slots.find((s) => s.id === pallet.slotId) : undefined;
  if (!from) return { ok: false, error: "wrong_from" };
  const input: TransferInput = {
    sscc: pallet.sscc,
    fromSlotCode: from.code,
    toSlotCode,
    operatorId,
    fleetId,
  };
  const moved = at ? confirmPutaway(snap, input, at) : confirmPutaway(snap, input);
  if (!moved.ok) return moved;
  if (!pallet.asnId) return moved;
  const closed = closeAsnIfLocated(moved.snap, pallet.asnId);
  if (!closed.ok) return moved;
  return { ok: true, snap: closed.snap };
}

/** Confirma una recomendación de slotting. Sin este paso el palet no se mueve. */
export function acceptSlottingRecommendation(
  snap: WmsSnapshot,
  recId: string,
  operatorId: string | null,
  fleetId: string | null = null,
  at = WMS_DEMO_NOW,
): LiveMoveResult {
  const rec = (snap.slottingRecommendations ?? []).find((r) => r.id === recId);
  if (!rec) return { ok: false, error: "rec_missing" };
  if (rec.acceptedAt) return { ok: false, error: "rec_accepted" };
  const moved = putawayReceivedPallet(snap, rec.palletId, rec.toCode, operatorId, fleetId, at);
  if (!moved.ok) return moved;
  return {
    ok: true,
    snap: {
      ...moved.snap,
      slottingRecommendations: (moved.snap.slottingRecommendations ?? []).map((r) =>
        r.id === recId ? { ...r, acceptedAt: at, acceptedBy: operatorId } : r,
      ),
    },
  };
}

/** Putaway: palet en muelle → hueco de almacén. */
export function confirmPutaway(
  snap: WmsSnapshot,
  input: TransferInput,
  at = "2026-08-15T11:05:00.000Z",
): LiveMoveResult {
  const pallet = snap.pallets.find((p) => p.sscc === input.sscc.trim());
  if (!pallet) return { ok: false, error: "pallet_missing" };
  if (pallet.status === "cuarentena") return { ok: false, error: "pallet_quarantined" };
  const from = pallet.slotId ? snap.slots.find((s) => s.id === pallet.slotId) : undefined;
  if (!from || from.zone !== "muelle") return { ok: false, error: "not_on_dock" };
  if (!palletCanPutaway(pallet)) return { ok: false, error: "qc_pending" };
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

/**
 * Traslado de un palet real a un hueco libre de otro centro.
 * No fabrica mercancía ni huecos; el destino lo elige quien mueve.
 */
export function transferPalletBetweenSites(
  snap: WmsSnapshot,
  input: {
    palletId: string;
    destSiteId: string;
    toSlotCode: string;
    operatorId?: string | null;
    fleetId?: string | null;
    note?: string;
  },
  at = new Date().toISOString(),
): LiveMoveResult {
  const pallet = snap.pallets.find((p) => p.id === input.palletId);
  if (!pallet) return { ok: false, error: "pallet_missing" };
  if (pallet.status === "expedido") return { ok: false, error: "pallet_shipped" };
  if (pallet.siteId === input.destSiteId) return { ok: false, error: "same_site" };
  if (pallet.status === "picking" || pallet.status === "muelle") {
    return { ok: false, error: "pallet_in_wave" };
  }
  const reserved = snap.pickWaves.some(
    (w) =>
      w.status !== "cerrada" &&
      w.lines.some(
        (l) =>
          l.palletId === pallet.id &&
          (l.status === "pendiente" || l.status === "en_curso"),
      ),
  );
  if (reserved) return { ok: false, error: "pallet_in_wave" };

  const dest = snap.sites.find((s) => s.id === input.destSiteId);
  if (!dest) return { ok: false, error: "to_missing" };
  const to = findSlot(snap, input.toSlotCode, input.destSiteId);
  if (!to) return { ok: false, error: "to_missing" };
  if (to.status === "bloqueado") return { ok: false, error: "slot_blocked" };
  if (to.palletId) return { ok: false, error: "slot_occupied" };

  const from = pallet.slotId ? snap.slots.find((s) => s.id === pallet.slotId) : undefined;
  const nextSlots = snap.slots.map((s) => {
    if (from && s.id === from.id) return vacate(s);
    if (s.id === to.id) return occupy(s, pallet);
    return s;
  });
  const nextPallets = snap.pallets.map((p) =>
    p.id === pallet.id
      ? {
          ...p,
          siteId: input.destSiteId,
          slotId: to.id,
          status: to.zone === "muelle" ? ("muelle" as const) : ("en_ubicacion" as const),
        }
      : p,
  );
  const fromSite = snap.sites.find((s) => s.id === pallet.siteId);
  const movement: StockMovement = {
    id: `mv-hub-${pallet.id}-${at}`,
    at,
    type: "traslado",
    skuId: pallet.skuId,
    palletId: pallet.id,
    fromSlotId: from?.id ?? null,
    toSlotId: to.id,
    qty: pallet.qty,
    operatorId: input.operatorId ?? null,
    fleetId: input.fleetId ?? null,
    note:
      input.note ??
      `Inter-centro ${fromSite?.code ?? pallet.siteId} ${from?.code ?? "—"} → ${dest.code} ${to.code}`,
  };
  const physical = appendMove(snap, movement, nextSlots, nextPallets);
  if (pallet.qty < 1) return { ok: true, snap: physical };
  const led = applyTxToSnapshot(physical, {
    type: "MOVE",
    skuId: pallet.skuId,
    lot: pallet.lot || null,
    fromLocationId: from?.id ?? locationOfPallet(pallet),
    toLocationId: to.id,
    qty: pallet.qty,
    reason: movement.note,
    refType: "pallet",
    refId: pallet.id,
    palletId: pallet.id,
    actorId: input.operatorId ?? null,
    at,
    id: `itx-HUB-${pallet.id}-${at}`,
  });
  if (!led.ok) return { ok: false, error: "stock_negative" };
  return { ok: true, snap: led.snap };
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
      ledgerType: "REPLENISH",
    },
    at,
  );
}
