import { wmsUid } from "./ids";
import { applyInventoryTx, rebuildBalancesFromPallets, recordPhysicalTx } from "./inventory";
import type { ReturnOrder, ReturnStatus, WmsSnapshot } from "./types";
import { appendAudit } from "./audit";
import { quarantinePallet } from "./quality";

export type ReturnError = "invalid_qty" | "return_missing" | "illegal_status" | "pallet_missing";

const NEXT: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["received"],
  received: ["inspecting"],
  inspecting: ["restock", "quarantine", "scrap"],
  restock: [],
  quarantine: [],
  scrap: [],
};

export function createReturn(
  snap: WmsSnapshot,
  input: { siteId: string; customer: string; skuId: string; qty: number; note?: string },
  at = "2026-08-15T14:00:00.000Z",
): { ok: true; snap: WmsSnapshot; id: string } | { ok: false; error: ReturnError } {
  if (!Number.isFinite(input.qty) || input.qty < 1) return { ok: false, error: "invalid_qty" };
  const row: ReturnOrder = {
    id: wmsUid("ret"),
    code: `RMA-${String((snap.returns ?? []).length + 1).padStart(4, "0")}`,
    siteId: input.siteId,
    customer: input.customer.trim() || "—",
    skuId: input.skuId,
    qty: input.qty,
    status: "requested",
    palletId: null,
    note: input.note ?? "",
    createdAt: at,
  };
  return { ok: true, id: row.id, snap: { ...snap, returns: [row, ...(snap.returns ?? [])] } };
}

export function inspectReturn(
  snap: WmsSnapshot,
  returnId: string,
  decision: "restock" | "quarantine" | "scrap",
  palletId: string | null = null,
  at = "2026-08-15T15:00:00.000Z",
): { ok: true; snap: WmsSnapshot } | { ok: false; error: ReturnError } {
  const row = (snap.returns ?? []).find((r) => r.id === returnId);
  if (!row) return { ok: false, error: "return_missing" };
  const from = row.status === "requested" ? "received" : row.status;
  if (from !== "inspecting" && from !== "received") {
    if (!NEXT[row.status]?.includes("inspecting") && !NEXT[row.status]?.includes(decision)) {
      return { ok: false, error: "illegal_status" };
    }
  }

  let next: WmsSnapshot = {
    ...snap,
    returns: (snap.returns ?? []).map((r) =>
      r.id === returnId ? { ...r, status: decision, palletId: palletId ?? r.palletId } : r,
    ),
  };

  if (decision === "restock" && palletId) {
    next = recordPhysicalTx(next, {
      at,
      type: "RETURN",
      skuId: row.skuId,
      palletId,
      lot: next.pallets.find((p) => p.id === palletId)?.lot ?? null,
      fromSlotId: null,
      toSlotId: next.pallets.find((p) => p.id === palletId)?.slotId ?? null,
      qty: row.qty,
      operatorId: null,
      note: `RMA restock ${row.code}`,
    });
  }
  if (decision === "quarantine" && palletId) {
    const held = quarantinePallet(next, palletId, `RMA ${row.code}`, at);
    if (!held.ok) return { ok: false, error: "illegal_status" };
    next = held.snap;
  }
  if (decision === "scrap" && palletId) {
    const tx = applyInventoryTx(next, {
      at,
      type: "ADJUSTMENT",
      skuId: row.skuId,
      palletId,
      lot: next.pallets.find((p) => p.id === palletId)?.lot ?? null,
      fromSlotId: next.pallets.find((p) => p.id === palletId)?.slotId ?? null,
      toSlotId: null,
      qty: row.qty,
      operatorId: null,
      note: `RMA scrap ${row.code}`,
    });
    if (tx.ok) {
      next = {
        ...tx.snap,
        pallets: tx.snap.pallets.map((p) => (p.id === palletId ? { ...p, qty: Math.max(0, p.qty - row.qty) } : p)),
      };
      next = { ...next, balances: rebuildBalancesFromPallets(next) };
    }
  }

  return {
    ok: true,
    snap: appendAudit(next, {
      at,
      actorId: null,
      action: `return.${decision}`,
      entityType: "return",
      entityId: returnId,
      after: decision,
    }),
  };
}
