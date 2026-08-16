/**
 * Inventory Core — balances (estado) + transactions (ledger).
 * La única API que muta un balance es `applyInventoryTx`.
 * Toda cifra se puede reconstruir con `projectBalances`.
 */

import { factorsFromSku, LEGACY_UOM, type UomCode } from "./uom";
import type {
  InventoryAdjustment,
  InventoryBalance,
  InventoryCount,
  InventoryReservation,
  InventoryTransaction,
  InventoryTxType,
  Pallet,
  Sku,
  WmsLot,
  WmsProduct,
  WmsProductUom,
  WmsSerialNumber,
  WmsSnapshot,
} from "./types";

export const INVENTORY_TX_TYPES = [
  "RECEIPT",
  "PUTAWAY",
  "MOVE",
  "ALLOCATE",
  "DEALLOCATE",
  "PICK",
  "REPLENISH",
  "PACK",
  "STAGE",
  "LOAD",
  "SHIP",
  "RETURN",
  "ADJUSTMENT",
  "COUNT",
  "QUARANTINE",
  "RELEASE",
] as const satisfies readonly InventoryTxType[];

export type ApplyTxError =
  | "invalid_qty"
  | "unknown_type"
  | "revision_conflict"
  | "negative_stock"
  | "location_required";

export type ApplyTxInput = {
  type: InventoryTxType;
  skuId: string;
  lot?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  /** Magnitud. En ADJUSTMENT es delta con signo. En COUNT se ignora (usa countedQty). */
  qty: number;
  countedQty?: number | null;
  uom?: string;
  reason?: string;
  refType?: string | null;
  refId?: string | null;
  palletId?: string | null;
  actorId?: string | null;
  at?: string;
  id?: string;
  /** Lock optimista del balance que se toca primero (from, o to si no hay from). */
  expectedRevision?: number;
  allowNegative?: boolean;
  bucket?: "on_hand" | "blocked" | "quarantined";
};

export type InventoryLedgerState = {
  balances: InventoryBalance[];
  transactions: InventoryTransaction[];
};

export type ApplyTxResult =
  | { ok: true; state: InventoryLedgerState; balance: InventoryBalance; tx: InventoryTransaction }
  | { ok: false; error: ApplyTxError };

export type ApplySnapResult = { ok: true; snap: WmsSnapshot } | { ok: false; error: ApplyTxError };

const OPENING_AT = "2026-08-15T06:00:00.000Z";

export function balanceKey(orgId: string, skuId: string, lot: string | null, locationId: string): string {
  return `${orgId}|${skuId}|${lot ?? ""}|${locationId}`;
}

export function locationOfPallet(pallet: Pick<Pallet, "slotId" | "siteId">): string {
  return pallet.slotId ?? `SITE:${pallet.siteId}`;
}

export function availableOf(b: Pick<InventoryBalance, "onHand" | "allocated" | "blocked" | "quarantined">): number {
  return b.onHand - b.allocated - b.blocked - b.quarantined;
}

export function withAvailable(b: Omit<InventoryBalance, "available"> & { available?: number }): InventoryBalance {
  const next = { ...b, available: availableOf(b) };
  return next;
}

export function emptyBalance(
  orgId: string,
  skuId: string,
  lot: string | null,
  locationId: string,
  at: string,
): InventoryBalance {
  return withAvailable({
    id: `ibal-${balanceKey(orgId, skuId, lot, locationId)}`,
    orgId,
    skuId,
    lot,
    locationId,
    onHand: 0,
    allocated: 0,
    picked: 0,
    packed: 0,
    staged: 0,
    blocked: 0,
    quarantined: 0,
    revision: 0,
    updatedAt: at,
  });
}

function cloneBalance(b: InventoryBalance): InventoryBalance {
  return { ...b };
}

function isTxType(value: string): value is InventoryTxType {
  return (INVENTORY_TX_TYPES as readonly string[]).includes(value);
}

function bucketsLegal(b: InventoryBalance, allowNegative: boolean): boolean {
  if (allowNegative) return true;
  if (
    b.onHand < 0 ||
    b.allocated < 0 ||
    b.picked < 0 ||
    b.packed < 0 ||
    b.staged < 0 ||
    b.blocked < 0 ||
    b.quarantined < 0
  ) {
    return false;
  }
  return availableOf(b) >= 0;
}

function findIndex(
  balances: InventoryBalance[],
  orgId: string,
  skuId: string,
  lot: string | null,
  locationId: string,
): number {
  const key = balanceKey(orgId, skuId, lot, locationId);
  return balances.findIndex((b) => balanceKey(b.orgId, b.skuId, b.lot, b.locationId) === key);
}

function upsert(
  balances: InventoryBalance[],
  orgId: string,
  skuId: string,
  lot: string | null,
  locationId: string,
  at: string,
): { balances: InventoryBalance[]; index: number; created: boolean } {
  const idx = findIndex(balances, orgId, skuId, lot, locationId);
  if (idx >= 0) return { balances, index: idx, created: false };
  return { balances: [...balances, emptyBalance(orgId, skuId, lot, locationId, at)], index: balances.length, created: true };
}

function transferFull(from: InventoryBalance, to: InventoryBalance): void {
  to.onHand += from.onHand;
  to.allocated += from.allocated;
  to.picked += from.picked;
  to.packed += from.packed;
  to.staged += from.staged;
  to.blocked += from.blocked;
  to.quarantined += from.quarantined;
  from.onHand = 0;
  from.allocated = 0;
  from.picked = 0;
  from.packed = 0;
  from.staged = 0;
  from.blocked = 0;
  from.quarantined = 0;
}

function consumePipeline(
  b: InventoryBalance,
  qty: number,
  keys: Array<"picked" | "packed" | "staged" | "onHand">,
): number {
  let left = qty;
  for (const key of keys) {
    const take = Math.min(b[key], left);
    b[key] -= take;
    left -= take;
  }
  return left;
}

/**
 * Aplica una transacción al estado. No hay otro camino para cambiar un número de stock.
 */
export function applyInventoryTx(
  state: InventoryLedgerState,
  orgId: string,
  input: ApplyTxInput,
): ApplyTxResult {
  if (!isTxType(input.type)) return { ok: false, error: "unknown_type" };

  const allowNegative = Boolean(input.allowNegative);
  const at = input.at ?? new Date().toISOString();
  const lot = input.lot ?? null;
  const fromId = input.fromLocationId ?? null;
  const toId = input.toLocationId ?? null;

  const needsFrom = new Set<InventoryTxType>([
    "PUTAWAY",
    "MOVE",
    "REPLENISH",
    "ALLOCATE",
    "DEALLOCATE",
    "PICK",
    "PACK",
    "STAGE",
    "LOAD",
    "SHIP",
    "QUARANTINE",
    "RELEASE",
    "ADJUSTMENT",
    "COUNT",
  ]);
  const needsTo = new Set<InventoryTxType>(["RECEIPT", "PUTAWAY", "MOVE", "REPLENISH", "RETURN"]);

  if (needsFrom.has(input.type) && !fromId && input.type !== "RECEIPT") {
    if (input.type === "ADJUSTMENT" || input.type === "COUNT") {
      if (!fromId && !toId) return { ok: false, error: "location_required" };
    } else if (!fromId) {
      return { ok: false, error: "location_required" };
    }
  }
  if (needsTo.has(input.type) && !toId) return { ok: false, error: "location_required" };

  const counted = input.countedQty;
  if (input.type === "COUNT") {
    if (counted == null || !Number.isFinite(counted) || counted < 0) return { ok: false, error: "invalid_qty" };
  } else if (input.type === "ADJUSTMENT") {
    if (!Number.isFinite(input.qty) || input.qty === 0) return { ok: false, error: "invalid_qty" };
  } else if (!Number.isFinite(input.qty) || input.qty <= 0) {
    return { ok: false, error: "invalid_qty" };
  }

  const locPrimary = fromId ?? toId;
  if (!locPrimary) return { ok: false, error: "location_required" };

  let balances = state.balances.map(cloneBalance);
  const primary = upsert(balances, orgId, input.skuId, lot, locPrimary, at);
  balances = primary.balances;
  const first = cloneBalance(balances[primary.index]!);

  if (input.expectedRevision != null && !primary.created && first.revision !== input.expectedRevision) {
    return { ok: false, error: "revision_conflict" };
  }
  if (input.expectedRevision != null && primary.created && input.expectedRevision !== 0) {
    return { ok: false, error: "revision_conflict" };
  }

  let second: InventoryBalance | null = null;
  let secondIndex = -1;
  if (toId && toId !== locPrimary) {
    const dest = upsert(balances, orgId, input.skuId, lot, toId, at);
    balances = dest.balances;
    secondIndex = dest.index;
    second = cloneBalance(balances[secondIndex]!);
  }

  const qty = input.type === "COUNT" ? (counted as number) - first.onHand : input.qty;

  switch (input.type) {
    case "RECEIPT":
    case "RETURN":
      if (!second) {
        first.onHand += input.qty;
      } else {
        second.onHand += input.qty;
      }
      break;
    case "PUTAWAY":
    case "MOVE":
    case "REPLENISH":
      if (!second) return { ok: false, error: "location_required" };
      if (input.qty === first.onHand) {
        transferFull(first, second);
      } else {
        first.onHand -= input.qty;
        second.onHand += input.qty;
      }
      break;
    case "ALLOCATE":
      first.allocated += input.qty;
      break;
    case "DEALLOCATE":
      first.allocated -= input.qty;
      break;
    case "PICK":
      first.onHand -= input.qty;
      first.allocated -= Math.min(first.allocated, input.qty);
      first.picked += input.qty;
      break;
    case "PACK":
      first.picked -= input.qty;
      first.packed += input.qty;
      break;
    case "STAGE": {
      const dest = second ?? first;
      if (second) {
        if (input.qty === first.onHand) transferFull(first, second);
        else {
          first.onHand -= input.qty;
          second.onHand += input.qty;
        }
      }
      const takePacked = Math.min(dest.packed, input.qty);
      dest.packed -= takePacked;
      dest.picked -= Math.min(dest.picked, input.qty - takePacked);
      dest.staged += input.qty;
      break;
    }
    case "LOAD":
      first.staged -= input.qty;
      break;
    case "SHIP": {
      const leftover = consumePipeline(first, input.qty, ["picked", "packed", "staged", "onHand"]);
      first.allocated -= Math.min(first.allocated, input.qty);
      if (leftover > 0) first.onHand -= leftover;
      break;
    }
    case "ADJUSTMENT": {
      const target = second ?? first;
      const bucket = input.bucket ?? "on_hand";
      if (bucket === "blocked") target.blocked += input.qty;
      else if (bucket === "quarantined") target.quarantined += input.qty;
      else target.onHand += input.qty;
      break;
    }
    case "COUNT": {
      const target = second ?? first;
      target.onHand = counted as number;
      break;
    }
    case "QUARANTINE":
      first.quarantined += input.qty;
      break;
    case "RELEASE":
      first.quarantined -= input.qty;
      break;
    default:
      return { ok: false, error: "unknown_type" };
  }

  const touched = [first, second].filter((b): b is InventoryBalance => Boolean(b));
  for (const b of touched) {
    if (b.blocked > b.onHand) b.blocked = Math.max(0, b.onHand);
    if (!bucketsLegal(b, allowNegative)) return { ok: false, error: "negative_stock" };
  }

  first.revision += 1;
  first.updatedAt = at;
  balances[primary.index] = withAvailable(first);
  if (second && secondIndex >= 0) {
    second.revision += 1;
    second.updatedAt = at;
    balances[secondIndex] = withAvailable(second);
  }

  const tx: InventoryTransaction = {
    id: input.id ?? `itx-${input.type}-${input.palletId ?? input.skuId}-${at}`,
    orgId,
    type: input.type,
    skuId: input.skuId,
    lot,
    fromLocationId: fromId,
    toLocationId: toId,
    qty: input.type === "COUNT" ? qty : input.qty,
    countedQty: input.type === "COUNT" ? (counted as number) : null,
    uom: input.uom ?? "ud",
    reason: input.reason ?? "",
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    palletId: input.palletId ?? null,
    createdAt: at,
    actorId: input.actorId ?? null,
  };

  return {
    ok: true,
    state: { balances, transactions: [...state.transactions, tx] },
    balance: balances[primary.index]!,
    tx,
  };
}

/** Reconstruye balances aplicando el ledger en orden. */
export function projectBalances(
  orgId: string,
  transactions: InventoryTransaction[],
  allowNegative = false,
): InventoryBalance[] {
  let state: InventoryLedgerState = { balances: [], transactions: [] };
  for (const tx of transactions) {
    const applied = applyInventoryTx(state, orgId, {
      type: tx.type,
      skuId: tx.skuId,
      lot: tx.lot,
      fromLocationId: tx.fromLocationId,
      toLocationId: tx.toLocationId,
      qty: tx.type === "COUNT" ? tx.countedQty ?? 0 : tx.qty,
      countedQty: tx.countedQty,
      uom: tx.uom,
      reason: tx.reason,
      refType: tx.refType,
      refId: tx.refId,
      palletId: tx.palletId,
      actorId: tx.actorId,
      at: tx.createdAt,
      id: tx.id,
      allowNegative,
    });
    if (!applied.ok) return state.balances;
    state = applied.state;
  }
  return state.balances;
}

export function balancesEqual(a: InventoryBalance[], b: InventoryBalance[]): boolean {
  if (a.length !== b.length) return false;
  const sort = (rows: InventoryBalance[]) =>
    [...rows].sort((x, y) => balanceKey(x.orgId, x.skuId, x.lot, x.locationId).localeCompare(balanceKey(y.orgId, y.skuId, y.lot, y.locationId)));
  const left = sort(a);
  const right = sort(b);
  return left.every((row, i) => {
    const other = right[i]!;
    return (
      row.skuId === other.skuId &&
      row.lot === other.lot &&
      row.locationId === other.locationId &&
      row.onHand === other.onHand &&
      row.allocated === other.allocated &&
      row.picked === other.picked &&
      row.packed === other.packed &&
      row.staged === other.staged &&
      row.blocked === other.blocked &&
      row.quarantined === other.quarantined &&
      availableOf(row) === availableOf(other)
    );
  });
}

export type InventorySeedSlice = {
  products: WmsProduct[];
  productUoms: WmsProductUom[];
  lots: WmsLot[];
  serialNumbers: WmsSerialNumber[];
  inventoryBalances: InventoryBalance[];
  inventoryReservations: InventoryReservation[];
  inventoryTransactions: InventoryTransaction[];
  inventoryAdjustments: InventoryAdjustment[];
  inventoryCounts: InventoryCount[];
};

function productFromSku(orgId: string, sku: Sku): WmsProduct {
  return {
    id: sku.id,
    orgId,
    sku: sku.sku,
    name: sku.name,
    ean: null,
    status: "active",
    category: sku.category,
  };
}

function uomsFromSku(orgId: string, sku: Sku): WmsProductUom[] {
  const base = LEGACY_UOM[sku.uom];
  const rows: WmsProductUom[] = [
    {
      id: `puom-${sku.id}-${base}`,
      orgId,
      productId: sku.id,
      uom: base,
      isBase: true,
      factorToBase: 1,
    },
  ];
  for (const factor of factorsFromSku(sku)) {
    if (factor.from === base) continue;
    rows.push({
      id: `puom-${sku.id}-${factor.from}`,
      orgId,
      productId: sku.id,
      uom: factor.from as UomCode,
      isBase: false,
      factorToBase: factor.factor,
    });
  }
  return rows;
}

/**
 * Apertura del ledger desde palets físicos. No inventa seriales ni SKU.
 * Palet expedido: RECEIPT + SHIP. Cuarentena: QUARANTINE. Caducado: blocked.
 */
export function seedInventoryCore(input: {
  orgId: string;
  skus: Sku[];
  pallets: Pallet[];
  now?: string;
}): InventorySeedSlice {
  const now = input.now ?? OPENING_AT;
  const nowMs = Date.parse(now);
  const products = input.skus.map((s) => productFromSku(input.orgId, s));
  const productUoms = input.skus.flatMap((s) => uomsFromSku(input.orgId, s));
  const lotMap = new Map<string, WmsLot>();
  let state: InventoryLedgerState = { balances: [], transactions: [] };
  const adjustments: InventoryAdjustment[] = [];

  const apply = (txInput: ApplyTxInput) => {
    const result = applyInventoryTx(state, input.orgId, txInput);
    if (!result.ok) return result;
    state = result.state;
    return result;
  };

  for (const pallet of input.pallets) {
    const lotKey = `${pallet.skuId}|${pallet.lot}`;
    if (pallet.lot && !lotMap.has(lotKey)) {
      const expiryMs = pallet.expiry ? Date.parse(pallet.expiry) : NaN;
      lotMap.set(lotKey, {
        id: `lot-${pallet.skuId}-${pallet.lot}`,
        orgId: input.orgId,
        productId: pallet.skuId,
        lot: pallet.lot,
        expiry: pallet.expiry,
        receivedAt: pallet.receivedAt,
        blocked: Number.isFinite(expiryMs) && expiryMs <= nowMs,
      });
    }

    if (pallet.qty <= 0) continue;
    const loc = locationOfPallet(pallet);
    const base = {
      skuId: pallet.skuId,
      lot: pallet.lot || null,
      palletId: pallet.id,
      uom: "ud",
      at: pallet.receivedAt || OPENING_AT,
    };

    apply({
      ...base,
      type: "RECEIPT",
      toLocationId: loc,
      qty: pallet.qty,
      reason: "opening",
      refType: "pallet",
      refId: pallet.id,
      id: `itx-RECEIPT-${pallet.id}`,
    });

    if (pallet.status === "cuarentena") {
      apply({
        ...base,
        type: "QUARANTINE",
        fromLocationId: loc,
        qty: pallet.qty,
        reason: "opening-quarantine",
        refType: "pallet",
        refId: pallet.id,
        id: `itx-QUARANTINE-${pallet.id}`,
      });
    } else {
      const expiryMs = pallet.expiry ? Date.parse(pallet.expiry) : NaN;
      if (Number.isFinite(expiryMs) && expiryMs <= nowMs) {
        const adj = apply({
          ...base,
          type: "ADJUSTMENT",
          fromLocationId: loc,
          qty: pallet.qty,
          bucket: "blocked",
          reason: "opening-expired",
          refType: "pallet",
          refId: pallet.id,
          id: `itx-BLOCK-${pallet.id}`,
        });
        if (adj.ok) {
          adjustments.push({
            id: `iadj-${pallet.id}`,
            orgId: input.orgId,
            skuId: pallet.skuId,
            lot: pallet.lot || null,
            locationId: loc,
            qty: pallet.qty,
            reason: "opening-expired",
            txId: adj.tx.id,
            createdAt: adj.tx.createdAt,
            actorId: null,
          });
        }
      }
    }

    if (pallet.status === "expedido") {
      apply({
        ...base,
        type: "SHIP",
        fromLocationId: loc,
        qty: pallet.qty,
        reason: "opening-shipped",
        refType: "pallet",
        refId: pallet.id,
        id: `itx-SHIP-${pallet.id}`,
      });
    }
  }

  return {
    products,
    productUoms,
    lots: [...lotMap.values()],
    serialNumbers: [],
    inventoryBalances: state.balances,
    inventoryReservations: [],
    inventoryTransactions: state.transactions,
    inventoryAdjustments: adjustments,
    inventoryCounts: [],
  };
}

export function emptyInventorySlice(): InventorySeedSlice {
  return {
    products: [],
    productUoms: [],
    lots: [],
    serialNumbers: [],
    inventoryBalances: [],
    inventoryReservations: [],
    inventoryTransactions: [],
    inventoryAdjustments: [],
    inventoryCounts: [],
  };
}

export function hasInventoryLedger(snap: Pick<WmsSnapshot, "inventoryTransactions" | "inventoryBalances">): boolean {
  return (snap.inventoryTransactions?.length ?? 0) > 0 || (snap.inventoryBalances?.length ?? 0) > 0;
}

/** Snapshot viejo sin ledger: apertura desde palets actuales. No inventa stock. */
export function hydrateInventoryIfMissing(snap: WmsSnapshot): WmsSnapshot {
  const defaults = {
    products: snap.products ?? [],
    productUoms: snap.productUoms ?? [],
    lots: snap.lots ?? [],
    serialNumbers: snap.serialNumbers ?? [],
    inventoryBalances: snap.inventoryBalances ?? [],
    inventoryReservations: snap.inventoryReservations ?? [],
    inventoryTransactions: snap.inventoryTransactions ?? [],
    inventoryAdjustments: snap.inventoryAdjustments ?? [],
    inventoryCounts: snap.inventoryCounts ?? [],
  };
  if (hasInventoryLedger({ ...snap, ...defaults })) {
    return { ...snap, ...defaults };
  }
  return {
    ...snap,
    ...seedInventoryCore({
      orgId: snap.org.id,
      skus: snap.skus ?? [],
      pallets: snap.pallets ?? [],
    }),
  };
}

export function applyTxToSnapshot(snap: WmsSnapshot, input: ApplyTxInput): ApplySnapResult {
  const ready = hydrateInventoryIfMissing(snap);
  const allowNegative = input.allowNegative ?? Boolean(ready.org.allowNegativeInventory);
  const applied = applyInventoryTx(
    { balances: ready.inventoryBalances, transactions: ready.inventoryTransactions },
    ready.org.id,
    { ...input, allowNegative },
  );
  if (!applied.ok) return applied;

  let adjustments = ready.inventoryAdjustments;
  let counts = ready.inventoryCounts;
  if (applied.tx.type === "ADJUSTMENT") {
    adjustments = [
      {
        id: `iadj-${applied.tx.id}`,
        orgId: ready.org.id,
        skuId: applied.tx.skuId,
        lot: applied.tx.lot,
        locationId: applied.tx.fromLocationId ?? applied.tx.toLocationId ?? "",
        qty: applied.tx.qty,
        reason: applied.tx.reason,
        txId: applied.tx.id,
        createdAt: applied.tx.createdAt,
        actorId: applied.tx.actorId,
      },
      ...adjustments,
    ];
  }
  if (applied.tx.type === "COUNT") {
    const loc = applied.tx.fromLocationId ?? applied.tx.toLocationId ?? "";
    const expected = (snap.inventoryBalances ?? []).find(
      (b) =>
        b.skuId === applied.tx.skuId &&
        (b.lot ?? "") === (applied.tx.lot ?? "") &&
        b.locationId === loc,
    )?.onHand ?? 0;
    counts = [
      {
        id: `icnt-${applied.tx.id}`,
        orgId: ready.org.id,
        skuId: applied.tx.skuId,
        lot: applied.tx.lot,
        locationId: loc,
        expectedQty: expected,
        countedQty: applied.tx.countedQty ?? 0,
        variance: applied.tx.qty,
        txId: applied.tx.id,
        createdAt: applied.tx.createdAt,
        actorId: applied.tx.actorId,
      },
      ...counts,
    ];
  }

  return {
    ok: true,
    snap: {
      ...ready,
      inventoryBalances: applied.state.balances,
      inventoryTransactions: applied.state.transactions,
      inventoryAdjustments: adjustments,
      inventoryCounts: counts,
    },
  };
}

export function findBalance(
  snap: WmsSnapshot,
  skuId: string,
  lot: string | null,
  locationId: string,
): InventoryBalance | undefined {
  const key = balanceKey(snap.org.id, skuId, lot, locationId);
  return (snap.inventoryBalances ?? []).find((b) => balanceKey(b.orgId, b.skuId, b.lot, b.locationId) === key);
}

export function ledgerAvailableAt(snap: WmsSnapshot, pallet: Pallet): number | null {
  const row = findBalance(snap, pallet.skuId, pallet.lot || null, locationOfPallet(pallet));
  return row ? availableOf(row) : null;
}
