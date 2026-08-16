import { hydrateInventory } from "@/lib/wms/inventory";
import { normalizeWmsSnapshot } from "@/lib/wms/normalize";
import { buildWmsSeed } from "@/lib/wms/seed";
import type {
  InventoryTx,
  InventoryTxType,
  Pallet,
  PalletStatus,
  Slot,
  WmsSnapshot,
} from "@/lib/wms/types";

const PALLET_STATUSES: PalletStatus[] = [
  "en_ubicacion",
  "en_transito",
  "picking",
  "muelle",
  "expedido",
  "cuarentena",
];

const TX_TYPES: InventoryTxType[] = [
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
];

export interface HandlingUnitRow {
  external_id: string | null;
  sscc: string;
  qty_base: number;
  status: string;
  location_code: string | null;
  lot_code: string | null;
  sku_code: string | null;
  received_at: string | null;
  warehouse_code: string | null;
}

export interface LedgerRow {
  id: string;
  type: string;
  qty_base: number;
  occurred_at: string;
  correlation_id: string | null;
  idempotency_key: string | null;
  reason: string | null;
  sku: string | null;
  pallet_external_id: string | null;
}

export function isPalletStatus(value: string): value is PalletStatus {
  return (PALLET_STATUSES as string[]).includes(value);
}

export function isInventoryTxType(value: string): value is InventoryTxType {
  return (TX_TYPES as string[]).includes(value);
}

/** Planta operativa para el primer arranque en PRODUCTION (stock vía ledger, no jsonb). */
export function productionPlantSnapshot(): WmsSnapshot {
  const seed = hydrateInventory(buildWmsSeed());
  return normalizeWmsSnapshot({
    ...seed,
    seededFromDemo: false,
    org: { ...seed.org, rlsMode: "postgres" },
  });
}

/** Layout de semilla sin stock. PRODUCTION vacío no hereda palets demo. */
export function productionBootstrapSnapshot(): WmsSnapshot {
  const seed = buildWmsSeed();
  const slots: Slot[] = seed.slots.map((s) => ({
    ...s,
    status: "libre",
    palletId: null,
    lastCountedAt: null,
  }));
  return normalizeWmsSnapshot({
    ...seed,
    seededFromDemo: false,
    org: { ...seed.org, rlsMode: "postgres" },
    slots,
    pallets: [],
    inbound: [],
    outbound: [],
    pickWaves: [],
    movements: [],
    costs: [],
    ledger: [],
    balances: [],
    reservations: [],
    orderLines: [],
    asnLines: [],
    receiptIncidents: [],
    packages: [],
    dockAppointments: [],
    yardVisits: [],
    returns: [],
    qualityHolds: [],
    cycleCountSessions: [],
    rfOutbox: [],
    auditLogs: [],
  });
}

/** Stock NUNCA viaja en jsonb. Identidad de palet sí (expiry, proveedor, ASN). */
export function stripStockForFloor(snap: WmsSnapshot): WmsSnapshot {
  return {
    ...snap,
    ledger: [],
    balances: [],
    pallets: snap.pallets.map((p) => ({ ...p, qty: 0 })),
  };
}

export function palletStockPayload(snap: WmsSnapshot) {
  const balances = snap.balances ?? [];
  return snap.pallets.map((p) => {
    const slot = snap.slots.find((s) => s.id === p.slotId);
    const bal = balances.find((b) => b.palletId === p.id);
    return {
      id: p.id,
      sscc: p.sscc,
      skuId: p.skuId,
      qty: p.qty,
      lot: p.lot,
      status: p.status,
      slotCode: slot?.code ?? null,
      siteId: p.siteId,
      receivedAt: p.receivedAt,
      allocated: bal?.allocated ?? 0,
      blocked: bal?.blocked ?? 0,
      quarantined: bal?.quarantined ?? 0,
    };
  });
}

export function ledgerStockPayload(snap: WmsSnapshot) {
  return (snap.ledger ?? []).map((tx) => {
    const pallet = tx.palletId ? snap.pallets.find((p) => p.id === tx.palletId) : undefined;
    const slot = snap.slots.find((s) => s.id === (tx.toSlotId ?? tx.fromSlotId));
    return {
      ...tx,
      siteId: pallet?.siteId ?? slot?.siteId ?? snap.sites[0]?.id ?? "DEFAULT",
    };
  });
}

export type StockCommitBatch = {
  pallets: ReturnType<typeof palletStockPayload>;
  ledger: ReturnType<typeof ledgerStockPayload>;
};

/** Palets primero, ledger después. Mezclarlos en el primer lote rompe el FK de HU. */
export function stockCommitBatches(
  pallets: ReturnType<typeof palletStockPayload>,
  ledger: ReturnType<typeof ledgerStockPayload>,
  chunk = 80,
): StockCommitBatch[] {
  const batches: StockCommitBatch[] = [];
  for (let i = 0; i < pallets.length; i += chunk) {
    batches.push({ pallets: pallets.slice(i, i + chunk), ledger: [] });
  }
  for (let i = 0; i < ledger.length; i += chunk) {
    batches.push({ pallets: [], ledger: ledger.slice(i, i + chunk) });
  }
  return batches;
}

function syncSlots(slots: Slot[], pallets: Pallet[]): Slot[] {
  const bySlot = new Map<string, Pallet>();
  for (const p of pallets) {
    if (p.slotId && p.status !== "expedido") bySlot.set(p.slotId, p);
  }
  return slots.map((s) => {
    const pallet = bySlot.get(s.id);
    if (!pallet) {
      if (s.status === "bloqueado" || s.status === "inventario") return { ...s, palletId: null };
      return { ...s, palletId: null, status: s.status === "reservado" ? "reservado" : "libre" };
    }
    return {
      ...s,
      palletId: pallet.id,
      status: s.status === "bloqueado" || s.status === "inventario" ? s.status : "ocupado",
    };
  });
}

/** Superpone HU + ledger Postgres sobre el floor (olas/flota/huecos). */
export function overlayStock(
  floor: WmsSnapshot,
  hus: HandlingUnitRow[],
  ledger: LedgerRow[],
): WmsSnapshot {
  const slotsByCode = new Map(floor.slots.map((s) => [s.code, s]));
  const pallets = new Map(floor.pallets.map((p) => [p.id, { ...p }]));
  const idBySscc = new Map(floor.pallets.map((p) => [p.sscc, p.id]));

  for (const hu of hus) {
    const id = hu.external_id || idBySscc.get(hu.sscc) || `hu-${hu.sscc}`;
    const existing = pallets.get(id);
    const slot = hu.location_code ? slotsByCode.get(hu.location_code) : undefined;
    const status = isPalletStatus(hu.status) ? hu.status : (existing?.status ?? "en_ubicacion");
    const next: Pallet = {
      id,
      sscc: hu.sscc,
      skuId: hu.sku_code ?? existing?.skuId ?? "sku",
      qty: Number(hu.qty_base) || 0,
      lot: hu.lot_code ?? existing?.lot ?? "",
      expiry: existing?.expiry ?? null,
      status,
      slotId: slot?.id ?? existing?.slotId ?? null,
      siteId: existing?.siteId ?? slot?.siteId ?? hu.warehouse_code ?? floor.sites[0]?.id ?? "site",
      receivedAt: hu.received_at ?? existing?.receivedAt ?? "2026-08-15T07:00:00.000Z",
      supplier: existing?.supplier ?? "",
      asnId: existing?.asnId ?? null,
    };
    pallets.set(id, next);
    idBySscc.set(hu.sscc, id);
  }

  const livePallets = [...pallets.values()];
  const txs: InventoryTx[] = ledger.map((row) => ({
    id: row.id,
    at: row.occurred_at,
    type: isInventoryTxType(row.type) ? row.type : "MOVE",
    skuId: row.sku ?? "sku",
    palletId: row.pallet_external_id,
    lot: null,
    fromSlotId: null,
    toSlotId: null,
    qty: Number(row.qty_base) || 0,
    operatorId: null,
    correlationId: row.correlation_id ?? row.id,
    idempotencyKey: row.idempotency_key,
    note: row.reason ?? "",
  }));

  return normalizeWmsSnapshot({
    ...floor,
    seededFromDemo: false,
    org: { ...floor.org, rlsMode: "postgres" },
    pallets: livePallets,
    slots: syncSlots(floor.slots, livePallets),
    ledger: txs,
  });
}
