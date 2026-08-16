import { correlationId, wmsUid } from "./ids";
import type {
  InventoryBalance,
  InventoryReservation,
  InventoryTx,
  InventoryTxType,
  Pallet,
  Slot,
  WmsSnapshot,
} from "./types";

export type InventoryError = "negative_stock" | "insufficient_available" | "invalid_qty" | "pallet_missing";

export type InventoryTxDraft = Omit<InventoryTx, "id" | "correlationId" | "idempotencyKey"> & {
  id?: string;
  correlationId?: string;
  idempotencyKey?: string | null;
};

export function availableQty(balance: InventoryBalance): number {
  return balance.onHand - balance.allocated - balance.blocked - balance.quarantined;
}

export function balancesOf(snap: WmsSnapshot): InventoryBalance[] {
  return snap.balances ?? [];
}

export function ledgerOf(snap: WmsSnapshot): InventoryTx[] {
  return snap.ledger ?? [];
}

export function reservationsOf(snap: WmsSnapshot): InventoryReservation[] {
  return snap.reservations ?? [];
}

function slotOf(snap: WmsSnapshot, id: string | null): Slot | undefined {
  return id ? snap.slots.find((s) => s.id === id) : undefined;
}

function allocatedForPallet(reservations: InventoryReservation[], palletId: string): number {
  return reservations
    .filter((r) => r.palletId === palletId && r.status === "open")
    .reduce((s, r) => s + r.qty, 0);
}

/** available = on_hand − allocated − blocked − quarantined. Palet expedido = 0. */
export function rebuildBalancesFromPallets(snap: WmsSnapshot): InventoryBalance[] {
  const reservations = reservationsOf(snap);
  const rows: InventoryBalance[] = [];
  for (const pallet of snap.pallets) {
    if (pallet.status === "expedido") continue;
    const slot = slotOf(snap, pallet.slotId);
    const quarantined = pallet.status === "cuarentena" ? pallet.qty : 0;
    const blocked = slot?.status === "bloqueado" ? pallet.qty : 0;
    rows.push({
      id: `bal-${pallet.id}`,
      palletId: pallet.id,
      skuId: pallet.skuId,
      lot: pallet.lot,
      slotId: pallet.slotId,
      siteId: pallet.siteId,
      onHand: pallet.qty,
      allocated: allocatedForPallet(reservations, pallet.id),
      blocked,
      quarantined,
    });
  }
  return rows;
}

/**
 * Reconstruye on_hand por palet a partir del ledger (qty > 0 + from/to).
 * RECEIPT/RETURN/RELEASE/ADJUSTMENT(+) suben; PICK/SHIP/ADJUSTMENT(−) bajan;
 * MOVE/PUTAWAY/STAGE/REPLENISH no cambian qty si from y to existen.
 */
export function onHandFromLedger(ledger: InventoryTx[], palletId: string): number {
  const txs = ledger.filter((t) => t.palletId === palletId).slice().reverse();
  let qty = 0;
  let skipNextAdjustment = false;
  for (const tx of txs) {
    if (tx.qty < 0) continue;
    switch (tx.type) {
      case "RECEIPT":
      case "RETURN":
      case "RELEASE":
        qty += tx.qty;
        skipNextAdjustment = false;
        break;
      case "PICK":
        qty -= tx.qty;
        skipNextAdjustment = false;
        break;
      case "SHIP":
      case "PACK":
        skipNextAdjustment = false;
        break;
      case "ADJUSTMENT":
        if (!skipNextAdjustment) {
          if (tx.fromSlotId && !tx.toSlotId) qty -= tx.qty;
          else qty += tx.qty;
        }
        skipNextAdjustment = false;
        break;
      case "COUNT":
        qty = tx.qty;
        skipNextAdjustment = true;
        break;
      default:
        skipNextAdjustment = false;
        break;
    }
  }
  return qty;
}

export function fefoCandidates(
  snap: WmsSnapshot,
  skuId: string,
  siteId: string,
): Array<{ pallet: Pallet; balance: InventoryBalance; available: number }> {
  const balances = rebuildBalancesFromPallets(snap);
  const rows: Array<{ pallet: Pallet; balance: InventoryBalance; available: number }> = [];
  for (const pallet of snap.pallets) {
    if (pallet.skuId !== skuId || pallet.siteId !== siteId) continue;
    if (pallet.status === "expedido" || pallet.status === "cuarentena" || pallet.status === "muelle") continue;
    if (pallet.qty < 1) continue;
    const slot = slotOf(snap, pallet.slotId);
    if (!slot || slot.status === "bloqueado") continue;
    const balance = balances.find((b) => b.palletId === pallet.id);
    if (!balance) continue;
    const avail = availableQty(balance);
    if (avail < 1) continue;
    rows.push({ pallet, balance, available: avail });
  }
  return rows.sort((a, b) => {
    const ea = a.pallet.expiry ? new Date(a.pallet.expiry).getTime() : Number.POSITIVE_INFINITY;
    const eb = b.pallet.expiry ? new Date(b.pallet.expiry).getTime() : Number.POSITIVE_INFINITY;
    if (ea !== eb) return ea - eb;
    return a.pallet.receivedAt.localeCompare(b.pallet.receivedAt);
  });
}

export function selectFefo(
  snap: WmsSnapshot,
  skuId: string,
  siteId: string,
  qtyNeeded: number,
): Array<{ palletId: string; lot: string; qty: number; expiry: string | null }> {
  if (!Number.isFinite(qtyNeeded) || qtyNeeded < 1) return [];
  let remaining = qtyNeeded;
  const picked: Array<{ palletId: string; lot: string; qty: number; expiry: string | null }> = [];
  for (const row of fefoCandidates(snap, skuId, siteId)) {
    if (remaining <= 0) break;
    const take = Math.min(row.available, remaining);
    picked.push({ palletId: row.pallet.id, lot: row.pallet.lot, qty: take, expiry: row.pallet.expiry });
    remaining -= take;
  }
  return picked;
}

function makeTx(draft: InventoryTxDraft): InventoryTx | { error: InventoryError } {
  if (!Number.isFinite(draft.qty) || draft.qty < 0) return { error: "invalid_qty" };
  if (draft.qty === 0 && draft.type !== "COUNT") return { error: "invalid_qty" };
  return {
    ...draft,
    id: draft.id ?? wmsUid("tx"),
    correlationId: draft.correlationId ?? correlationId(),
    idempotencyKey: draft.idempotencyKey ?? null,
  };
}

function findBalance(balances: InventoryBalance[], palletId: string | null): InventoryBalance | undefined {
  return palletId ? balances.find((b) => b.palletId === palletId) : undefined;
}

function cloneBalances(balances: InventoryBalance[]): InventoryBalance[] {
  return balances.map((b) => ({ ...b }));
}

/**
 * Aplica una tx al vector de balances. No muta palets.
 * Negativos prohibidos salvo allowNegative.
 */
export function applyTxToBalances(
  balances: InventoryBalance[],
  tx: InventoryTx,
  allowNegative = false,
): { ok: true; balances: InventoryBalance[] } | { ok: false; error: InventoryError } {
  if (tx.qty < 0) return { ok: false, error: "invalid_qty" };
  if (tx.qty === 0 && tx.type !== "COUNT") return { ok: false, error: "invalid_qty" };
  const next = cloneBalances(balances);
  const row = findBalance(next, tx.palletId);

  const ensure = (): InventoryBalance => {
    if (row) return row;
    const created: InventoryBalance = {
      id: `bal-${tx.palletId ?? tx.id}`,
      palletId: tx.palletId,
      skuId: tx.skuId,
      lot: tx.lot ?? "",
      slotId: tx.toSlotId ?? tx.fromSlotId,
      siteId: "",
      onHand: 0,
      allocated: 0,
      blocked: 0,
      quarantined: 0,
    };
    next.push(created);
    return created;
  };

  const bumpOnHand = (delta: number, target: InventoryBalance) => {
    const nextQty = target.onHand + delta;
    if (nextQty < 0 && !allowNegative) return false;
    target.onHand = nextQty;
    return true;
  };

  switch (tx.type) {
    case "RECEIPT":
    case "RETURN":
      if (!bumpOnHand(tx.qty, ensure())) return { ok: false, error: "negative_stock" };
      if (tx.toSlotId) ensure().slotId = tx.toSlotId;
      break;
    case "PICK":
    case "SHIP": {
      if (!row) return { ok: false, error: "pallet_missing" };
      if (availableQty(row) < tx.qty && !allowNegative) return { ok: false, error: "insufficient_available" };
      if (!bumpOnHand(-tx.qty, row)) return { ok: false, error: "negative_stock" };
      row.allocated = Math.max(0, row.allocated - tx.qty);
      break;
    }
    case "PACK":
      break;
    case "ALLOCATE": {
      if (!row) return { ok: false, error: "pallet_missing" };
      if (availableQty(row) < tx.qty && !allowNegative) return { ok: false, error: "insufficient_available" };
      row.allocated += tx.qty;
      break;
    }
    case "DEALLOCATE": {
      if (!row) return { ok: false, error: "pallet_missing" };
      row.allocated = Math.max(0, row.allocated - tx.qty);
      break;
    }
    case "QUARANTINE": {
      if (!row) return { ok: false, error: "pallet_missing" };
      if (availableQty(row) < tx.qty && !allowNegative) return { ok: false, error: "insufficient_available" };
      row.quarantined += tx.qty;
      break;
    }
    case "RELEASE": {
      if (!row) return { ok: false, error: "pallet_missing" };
      row.quarantined = Math.max(0, row.quarantined - tx.qty);
      break;
    }
    case "ADJUSTMENT": {
      const target = ensure();
      const delta = tx.fromSlotId && !tx.toSlotId ? -tx.qty : tx.qty;
      if (!bumpOnHand(delta, target)) return { ok: false, error: "negative_stock" };
      break;
    }
    case "COUNT": {
      const target = ensure();
      if (tx.qty < 0 && !allowNegative) return { ok: false, error: "negative_stock" };
      target.onHand = tx.qty;
      break;
    }
    case "PUTAWAY":
    case "MOVE":
    case "REPLENISH":
    case "STAGE":
    case "LOAD":
      if (row && tx.toSlotId) row.slotId = tx.toSlotId;
      break;
    default:
      break;
  }

  return { ok: true, balances: next };
}

export function applyInventoryTx(
  snap: WmsSnapshot,
  draft: InventoryTxDraft,
  allowNegative = false,
): { ok: true; snap: WmsSnapshot; tx: InventoryTx } | { ok: false; error: InventoryError } {
  const built = makeTx(draft);
  if ("error" in built) return { ok: false, error: built.error };
  const current = rebuildBalancesFromPallets(snap);
  const applied = applyTxToBalances(current, built, allowNegative);
  if (!applied.ok) return applied;
  const ledger = [built, ...ledgerOf(snap)];
  return { ok: true, tx: built, snap: { ...snap, ledger, balances: applied.balances } };
}

/**
 * Tras mutar palets/huecos (camino histórico), anexa el ledger y recalcula balances.
 * No puede fallar por negativo: el palet ya es la fuente física.
 */
export function recordPhysicalTx(snap: WmsSnapshot, draft: InventoryTxDraft): WmsSnapshot {
  const locationOnly =
    draft.qty <= 0 &&
    (draft.type === "STAGE" || draft.type === "LOAD" || draft.type === "SHIP" || draft.type === "MOVE");
  const qty = locationOnly ? 1 : draft.qty;
  const built = makeTx({ ...draft, qty });
  if ("error" in built) {
    return { ...snap, balances: rebuildBalancesFromPallets(snap), ledger: ledgerOf(snap) };
  }
  const tx: InventoryTx = locationOnly ? { ...built, note: `${draft.note} · qty física 0` } : built;
  return {
    ...snap,
    ledger: [tx, ...ledgerOf(snap)],
    balances: rebuildBalancesFromPallets(snap),
  };
}

export function hydrateInventory(snap: WmsSnapshot): WmsSnapshot {
  const balances = rebuildBalancesFromPallets(snap);
  const ledger = ledgerOf(snap);
  const seededLedger =
    ledger.length > 0
      ? ledger
      : snap.pallets
          .filter((p) => p.status !== "expedido" && p.qty > 0)
          .map((p) => ({
            id: `tx-seed-${p.id}`,
            at: p.receivedAt,
            type: "RECEIPT" as InventoryTxType,
            skuId: p.skuId,
            palletId: p.id,
            lot: p.lot,
            fromSlotId: null,
            toSlotId: p.slotId,
            qty: p.qty,
            operatorId: null,
            correlationId: `seed-${p.id}`,
            idempotencyKey: `seed-receipt-${p.id}`,
            note: "Saldo inicial hidratado desde palet",
          }));
  return { ...snap, ledger: seededLedger, balances };
}

export function skuOnHand(snap: WmsSnapshot, skuId: string, siteId?: string): number {
  return rebuildBalancesFromPallets(snap)
    .filter((b) => b.skuId === skuId && (!siteId || b.siteId === siteId))
    .reduce((s, b) => s + b.onHand, 0);
}

export function skuAvailable(snap: WmsSnapshot, skuId: string, siteId?: string): number {
  return rebuildBalancesFromPallets(snap)
    .filter((b) => b.skuId === skuId && (!siteId || b.siteId === siteId))
    .reduce((s, b) => s + availableQty(b), 0);
}
