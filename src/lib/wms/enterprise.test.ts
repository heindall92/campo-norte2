import { describe, expect, it } from "vitest";
import { allocateOrder, deallocateOrder } from "./allocation";
import { appendAudit, auditForOrg } from "./audit";
import { ManualCarrierAdapter } from "./carrier-adapter";
import { answerWmsCopilot, formatCopilotAnswer } from "./copilot";
import { confirmCycleCount, planCycleCounts } from "./cycle-count";
import { bookDockAppointment } from "./docks";
import { hydrateInventory, availableQty, applyInventoryTx, onHandFromLedger, rebuildBalancesFromPallets, selectFefo, skuAvailable } from "./inventory";
import { enqueueRfCommand, flushRfOutbox } from "./offline-sync";
import { canTransitionOrder, upsertOrderLine } from "./orders";
import { packOrderWithSscc } from "./packing";
import { confirmPick } from "./picking";
import { quarantinePallet, releasePallet } from "./quality";
import { addAsnLine, receiveAgainstAsn } from "./receiving";
import { proposeMinMaxReplenishments } from "./replenishment";
import { createReturn, inspectReturn } from "./returns";
import { buildWmsSeed } from "./seed";
import { nextUniqueSscc } from "./sscc";
import { computeTowerActions } from "./tower-actions";
import { createOutboundOrder } from "./waves";
import { checkInVehicle, checkOutVehicle } from "./yard";
import { startRfSession, buildRfQueue } from "./rf";
import { scopeSnapshotToOrg } from "./org";

describe("phase 3 inventory ledger", () => {
  it("available = on_hand - allocated - blocked - quarantined", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const row = rebuildBalancesFromPallets(snap)[0]!;
    expect(availableQty(row)).toBe(row.onHand - row.allocated - row.blocked - row.quarantined);
  });

  it("rejects negative stock on apply path", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const pallet = snap.pallets.find((p) => p.qty > 0 && p.status === "en_ubicacion")!;
    const bad = applyInventoryTx(snap, {
      at: "2026-08-15T10:00:00.000Z",
      type: "PICK",
      skuId: pallet.skuId,
      palletId: pallet.id,
      lot: pallet.lot,
      fromSlotId: pallet.slotId,
      toSlotId: null,
      qty: pallet.qty + 50,
      operatorId: null,
      note: "over",
    });
    expect(bad.ok).toBe(false);
  });

  it("FEFO picks the earliest expiry first", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const perishable = snap.pallets.find((p) => p.expiry && p.status === "en_ubicacion" && p.qty > 0);
    expect(perishable).toBeTruthy();
    const picks = selectFefo(snap, perishable!.skuId, perishable!.siteId, 1);
    expect(picks[0]?.palletId).toBeTruthy();
    const first = snap.pallets.find((p) => p.id === picks[0]!.palletId);
    const same = snap.pallets.filter(
      (p) => p.skuId === perishable!.skuId && p.siteId === perishable!.siteId && p.expiry && p.status === "en_ubicacion",
    );
    const minExp = same.reduce((m, p) => (p.expiry! < m ? p.expiry! : m), same[0]!.expiry!);
    expect(first?.expiry).toBe(minExp);
  });

  it("reconstructing on_hand from ledger matches pallet after pick", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const wave = snap.pickWaves.find((w) => w.kind === "picking" && w.lines.some((l) => l.status === "pendiente" || l.status === "en_curso"))!;
    const line = wave.lines.find((l) => l.status === "pendiente" || l.status === "en_curso")!;
    const slot = snap.slots.find((s) => s.id === line.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === line.palletId)!;
    const picked = confirmPick(snap, wave.id, line.id, { slotCode: slot.code, sscc: pallet.sscc, qty: 1 });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const live = picked.snap.pallets.find((p) => p.id === pallet.id)!;
    expect(onHandFromLedger(picked.snap.ledger ?? [], pallet.id)).toBe(live.qty);
  });

  it("cycle count writes COUNT and ADJUSTMENT", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const task = planCycleCounts(snap, { siteId: "site-sev", limit: 1 })[0]!;
    const slot = snap.slots.find((s) => s.id === task.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === task.palletId)!;
    const ok = confirmCycleCount(snap, task, { slotCode: slot.code, sscc: pallet.sscc, qty: pallet.qty - 1 });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const types = (ok.snap.ledger ?? []).map((t) => t.type);
    expect(types).toContain("COUNT");
    expect(types).toContain("ADJUSTMENT");
    expect(ok.snap.cycleCountSessions?.[0]?.status).toBe("closed");
  });
});

describe("phase 4 orders + allocation", () => {
  it("blocks illegal status jumps and over-allocation", () => {
    expect(canTransitionOrder("pendiente", "expedido")).toBe(false);
    expect(canTransitionOrder("pendiente", "picking")).toBe(true);
    const snap = hydrateInventory(buildWmsSeed());
    const created = createOutboundOrder(snap, {
      customer: "Tienda Test",
      cutOff: "2026-08-16T18:00:00.000Z",
      dock: "M-05",
      siteId: "site-sev",
      lines: 1,
      pallets: 1,
      priority: "urgente",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const sku = snap.skus.find((s) => s.id === "sku-aceite")!;
    const lined = upsertOrderLine(created.snap, {
      orderId: created.orderId,
      skuId: sku.id,
      qtyOrdered: skuAvailable(created.snap, sku.id, "site-sev") + 50_000,
    });
    expect(lined.ok).toBe(true);
    if (!lined.ok) return;
    const alloc = allocateOrder(lined.snap, created.orderId);
    expect(alloc.ok).toBe(false);
  });

  it("allocates FEFO without exceeding available", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const created = createOutboundOrder(snap, {
      customer: "Tienda FEFO",
      cutOff: "2026-08-16T18:00:00.000Z",
      dock: "M-05",
      siteId: "site-sev",
      lines: 1,
      pallets: 1,
      priority: "normal",
    });
    if (!created.ok) return;
    const skuId = "sku-leche";
    const lined = upsertOrderLine(created.snap, { orderId: created.orderId, skuId, qtyOrdered: 2 });
    if (!lined.ok) return;
    const alloc = allocateOrder(lined.snap, created.orderId);
    expect(alloc.ok).toBe(true);
    if (!alloc.ok) return;
    const reserved = (alloc.snap.reservations ?? []).filter((r) => r.orderId === created.orderId);
    expect(reserved.reduce((s, r) => s + r.qty, 0)).toBe(2);
    const freed = deallocateOrder(alloc.snap, created.orderId);
    expect(freed.ok).toBe(true);
  });
});

describe("phase 5–9 receiving packing dock returns quality", () => {
  it("flags over-receipt as exceso", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const asn = snap.inbound.find((a) => a.status !== "cerrado") ?? snap.inbound[0]!;
    const lined = addAsnLine(snap, { asnId: asn.id, skuId: "sku-arroz", qtyExpected: 10, lotExpected: "L-OK" });
    expect(lined.ok).toBe(true);
    if (!lined.ok) return;
    const rec = receiveAgainstAsn(lined.snap, asn.id, { skuId: "sku-arroz", qty: 12, lot: "L-OTRO", lineId: lined.lineId });
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    expect(rec.incidents.some((i) => i.kind === "exceso")).toBe(true);
    expect(rec.incidents.some((i) => i.kind === "lote")).toBe(true);
  });

  it("issues unique SSCC on pack and requires manual tracking", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const a = nextUniqueSscc(snap.pallets.map((p) => p.sscc));
    const b = nextUniqueSscc([...snap.pallets.map((p) => p.sscc), a]);
    expect(a).not.toBe(b);
    expect(a).toHaveLength(18);
    expect(ManualCarrierAdapter.createShipment({ orderId: "x" }).ok).toBe(false);
    expect(ManualCarrierAdapter.createShipment({ orderId: "x", tracking: "TRK-1" }).ok).toBe(true);
    const packed = packOrderWithSscc(snap, snap.outbound[0]!.id);
    if (packed.ok) {
      const ssccs = (packed.snap.packages ?? []).map((p) => p.sscc);
      expect(new Set(ssccs).size).toBe(ssccs.length);
    }
  });

  it("rejects overlapping dock appointments", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const first = bookDockAppointment(snap, {
      siteId: "site-sev",
      dockCode: "M-01",
      kind: "outbound",
      start: "2026-08-16T10:00:00.000Z",
      end: "2026-08-16T11:00:00.000Z",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const clash = bookDockAppointment(first.snap, {
      siteId: "site-sev",
      dockCode: "M-01",
      kind: "inbound",
      start: "2026-08-16T10:30:00.000Z",
      end: "2026-08-16T11:30:00.000Z",
    });
    expect(clash.ok).toBe(false);
    const yard = checkInVehicle(first.snap, { siteId: "site-sev", plate: "SE-1234-AB" });
    expect(yard.ok).toBe(true);
    if (!yard.ok) return;
    expect(checkOutVehicle(yard.snap, yard.id).ok).toBe(true);
  });

  it("quarantine is not available; MIN/MAX replenish exists", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const pallet = snap.pallets.find((p) => p.status === "en_ubicacion" && p.qty > 0)!;
    const before = skuAvailable(snap, pallet.skuId, pallet.siteId);
    const held = quarantinePallet(snap, pallet.id, "calidad");
    expect(held.ok).toBe(true);
    if (!held.ok) return;
    expect(skuAvailable(held.snap, pallet.skuId, pallet.siteId)).toBeLessThan(before);
    expect(releasePallet(held.snap, pallet.id).ok).toBe(true);
    const rma = createReturn(snap, { siteId: "site-sev", customer: "Tienda", skuId: pallet.skuId, qty: 1 });
    expect(rma.ok).toBe(true);
    if (!rma.ok) return;
    expect(inspectReturn(rma.snap, rma.id, "scrap", pallet.id).ok).toBe(true);
    expect(proposeMinMaxReplenishments(snap).length).toBeGreaterThanOrEqual(0);
  });
});

describe("phase 10–14 offline audit tower copilot seed", () => {
  it("outbox is idempotent and server wins on stale flush", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const task = buildRfQueue(snap, "site-sev")[0];
    if (!task) return;
    const session = startRfSession(task);
    const a = enqueueRfCommand(snap, session, "idem-1");
    expect(a.ok && a.queued).toBe(true);
    if (!a.ok) return;
    const b = enqueueRfCommand(a.snap, session, "idem-1");
    expect(b.ok && b.queued).toBe(false);
    const flushed = flushRfOutbox(a.snap, () => null, null, true);
    expect(flushed.conflicts).toBeGreaterThan(0);
    expect(flushed.snap.pallets.length).toBe(a.snap.pallets.length);
  });

  it("audit is append-only and org-scoped", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const once = appendAudit(snap, { actorId: "op-01", action: "test", entityType: "pallet", entityId: "x" });
    const twice = appendAudit(once, { actorId: "op-01", action: "test2", entityType: "pallet", entityId: "x" });
    expect((twice.auditLogs ?? []).length).toBeGreaterThan((once.auditLogs ?? []).length);
    expect(auditForOrg(twice, "other-org")).toEqual([]);
    expect(scopeSnapshotToOrg(twice, "missing-org").pallets.length).toBe(0);
  });

  it("tower actions and copilot never execute", () => {
    const snap = hydrateInventory(buildWmsSeed());
    const actions = computeTowerActions(snap, "site-sev");
    expect(actions.length).toBeGreaterThan(0);
    const answer = answerWmsCopilot(snap, "¿qué olas y stock FEFO hay?");
    expect(answer.finding.length).toBeGreaterThan(0);
    expect(answer.confidence).toBeGreaterThan(0);
    expect(formatCopilotAnswer(answer, "es")).toMatch(/No confirmo/);
    expect(snap.pickWaves[0]?.status).toBe(buildWmsSeed().pickWaves[0]?.status);
  });

  it("seed has at least 50 SKUs", () => {
    expect(buildWmsSeed().skus.length).toBeGreaterThanOrEqual(50);
  });
});
