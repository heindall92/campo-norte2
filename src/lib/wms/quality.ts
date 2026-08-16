import { wmsUid } from "./ids";
import { applyInventoryTx, rebuildBalancesFromPallets } from "./inventory";
import type { WmsSnapshot } from "./types";
import { appendAudit } from "./audit";

export type QualityError = "pallet_missing" | "already_held" | "not_held" | "insufficient_available" | "negative_stock" | "invalid_qty";

export function quarantinePallet(
  snap: WmsSnapshot,
  palletId: string,
  reason: string,
  at = "2026-08-15T11:00:00.000Z",
): { ok: true; snap: WmsSnapshot } | { ok: false; error: QualityError } {
  const pallet = snap.pallets.find((p) => p.id === palletId);
  if (!pallet) return { ok: false, error: "pallet_missing" };
  if (pallet.status === "cuarentena") return { ok: false, error: "already_held" };
  const tx = applyInventoryTx(snap, {
    at,
    type: "QUARANTINE",
    skuId: pallet.skuId,
    palletId,
    lot: pallet.lot,
    fromSlotId: pallet.slotId,
    toSlotId: pallet.slotId,
    qty: Math.max(1, pallet.qty),
    operatorId: null,
    note: reason,
  });
  if (!tx.ok) return { ok: false, error: tx.error };
  const holds = [
    { id: wmsUid("qh"), palletId, reason, at, releasedAt: null },
    ...(tx.snap.qualityHolds ?? []),
  ];
  const next: WmsSnapshot = {
    ...tx.snap,
    pallets: tx.snap.pallets.map((p) => (p.id === palletId ? { ...p, status: "cuarentena" as const } : p)),
    qualityHolds: holds,
  };
  return {
    ok: true,
    snap: appendAudit(
      { ...next, balances: rebuildBalancesFromPallets(next) },
      { at, actorId: null, action: "quality.quarantine", entityType: "pallet", entityId: palletId, after: reason },
    ),
  };
}

export function releasePallet(
  snap: WmsSnapshot,
  palletId: string,
  at = "2026-08-15T16:00:00.000Z",
): { ok: true; snap: WmsSnapshot } | { ok: false; error: QualityError } {
  const pallet = snap.pallets.find((p) => p.id === palletId);
  if (!pallet) return { ok: false, error: "pallet_missing" };
  if (pallet.status !== "cuarentena") return { ok: false, error: "not_held" };
  const tx = applyInventoryTx(snap, {
    at,
    type: "RELEASE",
    skuId: pallet.skuId,
    palletId,
    lot: pallet.lot,
    fromSlotId: pallet.slotId,
    toSlotId: pallet.slotId,
    qty: Math.max(1, pallet.qty),
    operatorId: null,
    note: "release",
  });
  if (!tx.ok) return { ok: false, error: tx.error };
  const next: WmsSnapshot = {
    ...tx.snap,
    pallets: tx.snap.pallets.map((p) => (p.id === palletId ? { ...p, status: "en_ubicacion" as const } : p)),
    qualityHolds: (tx.snap.qualityHolds ?? []).map((h) =>
      h.palletId === palletId && !h.releasedAt ? { ...h, releasedAt: at } : h,
    ),
  };
  return { ok: true, snap: { ...next, balances: rebuildBalancesFromPallets(next) } };
}
