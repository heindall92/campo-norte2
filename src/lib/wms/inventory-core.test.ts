import { describe, expect, it } from "vitest";
import {
  applyInventoryTx,
  applyTxToSnapshot,
  availableOf,
  balancesEqual,
  emptyBalance,
  INVENTORY_TX_TYPES,
  locationOfPallet,
  projectBalances,
  seedInventoryCore,
  type InventoryLedgerState,
} from "./inventory-core";
import { confirmCycleCount, planCycleCounts } from "./cycle-count";
import { declareMerma } from "./merma";
import { confirmPick, nextOpenLine } from "./picking";
import { availableQty, releaseReservation, reserveStock } from "./reservations";
import { buildWmsSeed } from "./seed";

const ORG = "org-camponorte";

function blankState(): InventoryLedgerState {
  return { balances: [], transactions: [] };
}

describe("inventory core · ledger", () => {
  it("expone los 16 tipos de transacción", () => {
    expect(INVENTORY_TX_TYPES).toEqual([
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
    ]);
  });

  it("available = on_hand - allocated - blocked - quarantined", () => {
    const row = emptyBalance(ORG, "sku-aceite", "L01", "slot-1", "2026-08-15T11:00:00.000Z");
    row.onHand = 40;
    row.allocated = 10;
    row.blocked = 5;
    row.quarantined = 3;
    expect(availableOf(row)).toBe(22);
  });

  it("RECEIPT + ALLOCATE + PICK se reconstruye desde el ledger", () => {
    let state = blankState();
    const receipt = applyInventoryTx(state, ORG, {
      type: "RECEIPT",
      skuId: "sku-aceite",
      lot: "L01",
      toLocationId: "A-01-01-1",
      qty: 48,
      at: "2026-08-15T07:00:00.000Z",
      id: "t1",
    });
    expect(receipt.ok).toBe(true);
    if (!receipt.ok) return;
    state = receipt.state;
    expect(availableOf(receipt.balance)).toBe(48);

    const alloc = applyInventoryTx(state, ORG, {
      type: "ALLOCATE",
      skuId: "sku-aceite",
      lot: "L01",
      fromLocationId: "A-01-01-1",
      qty: 10,
      at: "2026-08-15T08:00:00.000Z",
      id: "t2",
    });
    expect(alloc.ok).toBe(true);
    if (!alloc.ok) return;
    state = alloc.state;
    expect(availableOf(alloc.balance)).toBe(38);

    const pick = applyInventoryTx(state, ORG, {
      type: "PICK",
      skuId: "sku-aceite",
      lot: "L01",
      fromLocationId: "A-01-01-1",
      qty: 10,
      at: "2026-08-15T09:00:00.000Z",
      id: "t3",
    });
    expect(pick.ok).toBe(true);
    if (!pick.ok) return;
    expect(pick.balance.onHand).toBe(38);
    expect(pick.balance.allocated).toBe(0);
    expect(pick.balance.picked).toBe(10);
    expect(availableOf(pick.balance)).toBe(38);

    const projected = projectBalances(ORG, pick.state.transactions);
    expect(balancesEqual(projected, pick.state.balances)).toBe(true);
  });

  it("rechaza stock negativo salvo allowNegativeInventory", () => {
    const denied = applyInventoryTx(blankState(), ORG, {
      type: "PICK",
      skuId: "sku-aceite",
      lot: "L01",
      fromLocationId: "A-01-01-1",
      qty: 1,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error).toBe("negative_stock");

    const allowed = applyInventoryTx(blankState(), ORG, {
      type: "PICK",
      skuId: "sku-aceite",
      lot: "L01",
      fromLocationId: "A-01-01-1",
      qty: 1,
      allowNegative: true,
    });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.balance.onHand).toBe(-1);
    expect(availableOf(allowed.balance)).toBe(-1);
  });

  it("COUNT y ADJUSTMENT dejan rastro reconstruible", () => {
    let state = blankState();
    const open = applyInventoryTx(state, ORG, {
      type: "RECEIPT",
      skuId: "sku-agua",
      lot: "L02",
      toLocationId: "B-01-01-1",
      qty: 20,
      id: "c1",
    });
    expect(open.ok).toBe(true);
    if (!open.ok) return;
    state = open.state;

    const counted = applyInventoryTx(state, ORG, {
      type: "COUNT",
      skuId: "sku-agua",
      lot: "L02",
      fromLocationId: "B-01-01-1",
      qty: 0,
      countedQty: 17,
      id: "c2",
    });
    expect(counted.ok).toBe(true);
    if (!counted.ok) return;
    expect(counted.balance.onHand).toBe(17);
    expect(counted.tx.qty).toBe(-3);
    expect(counted.tx.countedQty).toBe(17);
    state = counted.state;

    const adj = applyInventoryTx(state, ORG, {
      type: "ADJUSTMENT",
      skuId: "sku-agua",
      lot: "L02",
      fromLocationId: "B-01-01-1",
      qty: -2,
      reason: "merma",
      id: "c3",
    });
    expect(adj.ok).toBe(true);
    if (!adj.ok) return;
    expect(adj.balance.onHand).toBe(15);
    expect(balancesEqual(projectBalances(ORG, adj.state.transactions), adj.state.balances)).toBe(true);
  });

  it("revision_conflict evita dos escrituras sobre el mismo balance", () => {
    const open = applyInventoryTx(blankState(), ORG, {
      type: "RECEIPT",
      skuId: "sku-arroz",
      lot: "L03",
      toLocationId: "A-02-01-1",
      qty: 10,
      id: "r1",
    });
    expect(open.ok).toBe(true);
    if (!open.ok) return;
    const stale = applyInventoryTx(open.state, ORG, {
      type: "ALLOCATE",
      skuId: "sku-arroz",
      lot: "L03",
      fromLocationId: "A-02-01-1",
      qty: 1,
      expectedRevision: 0,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error).toBe("revision_conflict");

    const fresh = applyInventoryTx(open.state, ORG, {
      type: "ALLOCATE",
      skuId: "sku-arroz",
      lot: "L03",
      fromLocationId: "A-02-01-1",
      qty: 1,
      expectedRevision: open.balance.revision,
    });
    expect(fresh.ok).toBe(true);
  });

  it("QUARANTINE / RELEASE y MOVE conservan la fórmula available", () => {
    let state = blankState();
    const open = applyInventoryTx(state, ORG, {
      type: "RECEIPT",
      skuId: "sku-jamon",
      lot: "L04",
      toLocationId: "C-01-01-1",
      qty: 12,
      id: "q1",
    });
    expect(open.ok).toBe(true);
    if (!open.ok) return;
    state = open.state;
    const q = applyInventoryTx(state, ORG, {
      type: "QUARANTINE",
      skuId: "sku-jamon",
      lot: "L04",
      fromLocationId: "C-01-01-1",
      qty: 12,
      id: "q2",
    });
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    expect(availableOf(q.balance)).toBe(0);
    state = q.state;
    const rel = applyInventoryTx(state, ORG, {
      type: "RELEASE",
      skuId: "sku-jamon",
      lot: "L04",
      fromLocationId: "C-01-01-1",
      qty: 12,
      id: "q3",
    });
    expect(rel.ok).toBe(true);
    if (!rel.ok) return;
    expect(availableOf(rel.balance)).toBe(12);
    const moved = applyInventoryTx(rel.state, ORG, {
      type: "MOVE",
      skuId: "sku-jamon",
      lot: "L04",
      fromLocationId: "C-01-01-1",
      toLocationId: "C-02-01-1",
      qty: 12,
      id: "q4",
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    const dest = moved.state.balances.find((b) => b.locationId === "C-02-01-1")!;
    expect(dest.onHand).toBe(12);
    expect(availableOf(dest)).toBe(12);
  });
});

describe("inventory core · semilla y planta", () => {
  it("la semilla abre el ledger desde palets y se puede reconstruir", () => {
    const snap = buildWmsSeed();
    expect(snap.products).toHaveLength(snap.skus.length);
    expect(snap.serialNumbers).toEqual([]);
    expect(snap.inventoryTransactions.length).toBeGreaterThan(0);
    expect(snap.org.allowNegativeInventory).toBe(false);
    const projected = projectBalances(snap.org.id, snap.inventoryTransactions);
    expect(balancesEqual(projected, snap.inventoryBalances)).toBe(true);

    const live = snap.pallets.filter((p) => p.qty > 0 && p.status !== "expedido");
    for (const pallet of live) {
      const loc = locationOfPallet(pallet);
      const row = snap.inventoryBalances.find(
        (b) => b.skuId === pallet.skuId && (b.lot ?? "") === (pallet.lot || "") && b.locationId === loc,
      );
      expect(row).toBeTruthy();
      expect(row!.onHand).toBe(pallet.qty);
      expect(row!.available).toBe(availableOf(row!));
    }
  });

  it("confirmPick, reserva, merma y conteo escriben transacción", () => {
    const snap = buildWmsSeed();
    const wave = snap.pickWaves.find((w) => w.id === "wave-01")!;
    const line = nextOpenLine(wave)!;
    const slot = snap.slots.find((s) => s.id === line.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === line.palletId)!;
    const before = snap.inventoryTransactions.length;

    const picked = confirmPick(snap, wave.id, line.id, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: line.qty,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    expect(picked.snap.inventoryTransactions.length).toBe(before + 1);
    expect(picked.snap.inventoryTransactions.at(-1)?.type).toBe("PICK");
    expect(
      balancesEqual(
        projectBalances(picked.snap.org.id, picked.snap.inventoryTransactions),
        picked.snap.inventoryBalances,
      ),
    ).toBe(true);

    const free = snap.pallets.find(
      (p) =>
        p.siteId === "site-sev" &&
        p.status === "en_ubicacion" &&
        p.qty > 4 &&
        !p.expiry,
    )!;
    const reserved = reserveStock(snap, {
      palletId: free.id,
      qty: 2,
      orderCode: "OUT-LEDGER-1",
      warehouseId: "site-sev",
    });
    expect(reserved.ok).toBe(true);
    if (!reserved.ok) return;
    expect(reserved.snap.inventoryTransactions.at(-1)?.type).toBe("ALLOCATE");
    expect(availableQty(reserved.snap, free.id)).toBe(free.qty - 2);
    const released = releaseReservation(reserved.snap, reserved.reservation.id);
    expect(released.ok).toBe(true);
    if (!released.ok) return;
    expect(released.snap.inventoryTransactions.at(-1)?.type).toBe("DEALLOCATE");

    const mermaPal = snap.pallets.find((p) => p.status === "en_ubicacion" && p.qty > 2 && p.slotId)!;
    const from = snap.slots.find((s) => s.id === mermaPal.slotId)!;
    const merma = declareMerma(snap, {
      sscc: mermaPal.sscc,
      fromSlotCode: from.code,
      qty: 1,
      reason: "caida",
    });
    expect(merma.ok).toBe(true);
    if (!merma.ok) return;
    expect(merma.snap.inventoryTransactions.at(-1)?.type).toBe("ADJUSTMENT");
    expect(merma.snap.inventoryAdjustments[0]?.qty).toBe(-1);

    const tasks = planCycleCounts(snap, { siteId: "site-sev", limit: 1 });
    expect(tasks.length).toBeGreaterThan(0);
    const task = tasks[0]!;
    const taskPal = snap.pallets.find((p) => p.id === task.palletId)!;
    const taskSlot = snap.slots.find((s) => s.id === task.slotId)!;
    const counted = confirmCycleCount(snap, task, {
      slotCode: taskSlot.code,
      sscc: taskPal.sscc,
      qty: taskPal.qty,
    });
    expect(counted.ok).toBe(true);
    if (!counted.ok) return;
    expect(counted.snap.inventoryTransactions.at(-1)?.type).toBe("COUNT");
    expect(counted.snap.inventoryCounts[0]?.variance).toBe(0);
  });

  it("no hay atajo: applyTxToSnapshot es quien muta el balance", () => {
    const snap = buildWmsSeed();
    const pallet = snap.pallets.find((p) => p.status === "en_ubicacion" && p.qty > 0)!;
    const loc = locationOfPallet(pallet);
    const before = snap.inventoryBalances.find(
      (b) => b.skuId === pallet.skuId && b.locationId === loc && (b.lot ?? "") === (pallet.lot || ""),
    )!;
    const led = applyTxToSnapshot(snap, {
      type: "ADJUSTMENT",
      skuId: pallet.skuId,
      lot: pallet.lot || null,
      fromLocationId: loc,
      qty: -1,
      reason: "test",
    });
    expect(led.ok).toBe(true);
    if (!led.ok) return;
    const after = led.snap.inventoryBalances.find((b) => b.id === before.id)!;
    expect(after.onHand).toBe(before.onHand - 1);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.available).toBe(availableOf(after));
  });

  it("seedInventoryCore no inventa seriales ni SKU extra", () => {
    const snap = buildWmsSeed();
    const slice = seedInventoryCore({
      orgId: snap.org.id,
      skus: snap.skus,
      pallets: snap.pallets,
      now: "2026-08-15T11:00:00.000Z",
    });
    expect(slice.serialNumbers).toEqual([]);
    expect(slice.products.map((p) => p.id).sort()).toEqual(snap.skus.map((s) => s.id).sort());
    expect(slice.productUoms.every((u) => snap.skus.some((s) => s.id === u.productId))).toBe(true);
  });
});
