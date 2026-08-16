import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { confirmPick, nextOpenLine } from "./picking";
import { createOutboundOrder, openWaveFromOrder } from "./waves";
import { shipOutboundOrder, stageOrderToDock } from "./outbound";
import { markShipmentLoaded, MockCarrierAdapter, mockCarrierAdapter, shipmentForOrder } from "./shipping";
import { buildWmsSeed } from "./seed";

function pickAndStage() {
  const snap = buildWmsSeed();
  const created = createOutboundOrder(snap, {
    customer: "Tienda CN · mock",
    cutOff: "2026-08-15T17:00:00.000Z",
    dock: "M-06",
    siteId: "site-sev",
    lines: 1,
    pallets: 1,
    priority: "urgente",
  });
  if (!created.ok) throw new Error("order");
  const opened = openWaveFromOrder(created.snap, created.orderId, "op-08");
  if (!opened.ok) throw new Error("wave");
  const wave = opened.snap.pickWaves.find((w) => w.id === opened.waveId)!;
  const line = nextOpenLine(wave)!;
  const slot = opened.snap.slots.find((s) => s.id === line.slotId)!;
  const pallet = opened.snap.pallets.find((p) => p.id === line.palletId)!;
  const picked = confirmPick(opened.snap, opened.waveId, line.id, {
    slotCode: slot.code,
    sscc: pallet.sscc,
    qty: line.qty,
  });
  if (!picked.ok) throw new Error("pick");
  const staged = stageOrderToDock(picked.snap, created.orderId, "op-08");
  if (!staged.ok) throw new Error("stage");
  return { snap: staged.snap, orderId: created.orderId };
}

describe("oleada 9 · shipping + MockCarrierAdapter", () => {
  it("semilla no inventa shipments ni eventos de tracking", () => {
    const snap = buildWmsSeed();
    expect(snap.shipments).toEqual([]);
    expect(snap.trackingEvents).toEqual([]);
  });

  it("expedir sin tracking sigue siendo válido y el stage/ship rellenan timestamps", () => {
    const { snap, orderId } = pickAndStage();
    const staged = shipmentForOrder(snap, orderId);
    expect(staged?.status).toBe("STAGED");
    expect(staged?.stagedAt).toBeTruthy();
    expect(staged?.tracking).toBeNull();

    const shipped = shipOutboundOrder(snap, orderId, "op-08");
    expect(shipped.ok).toBe(true);
    if (!shipped.ok) return;
    const order = shipped.snap.outbound.find((o) => o.id === orderId)!;
    expect(order.status).toBe("expedido");
    expect(order.tracking).toBeNull();
    const shipment = shipmentForOrder(shipped.snap, orderId);
    expect(shipment?.status).toBe("SHIPPED");
    expect(shipment?.shippedAt).toBeTruthy();
    expect(shipment?.tracking).toBeNull();
  });

  it("el mock no fabrica tracking y etiqueta MOCK, no SEUR", () => {
    const seed = buildWmsSeed();
    const order = seed.outbound.find((o) => o.status !== "expedido")!;
    const adapter = new MockCarrierAdapter();
    expect(adapter.kind).toBe("mock");
    expect(adapter.displayName).toBe("MockCarrierAdapter");

    const created = adapter.createShipment(seed, order.id);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const shipment = created.snap.shipments.find((s) => s.id === created.shipmentId)!;
    expect(shipment.tracking).toBeNull();
    expect(created.snap.outbound.find((o) => o.id === order.id)?.tracking).toBeNull();
    const events = adapter.trackShipment(created.snap, created.shipmentId);
    expect(events.every((e) => e.source === "mock")).toBe(true);
    expect(events[0]?.note).toContain("MockCarrierAdapter");
    expect(events[0]?.note.toLowerCase()).not.toContain("seur api");

    const html = adapter.getLabel(created.snap, created.shipmentId, "es");
    expect(html).toContain("MOCK");
    expect(html).toContain("MockCarrierAdapter");
    expect(html).toContain("sin tracking");
    expect(html).toContain("No es una etiqueta SEUR ni DHL");

    const written = adapter.createShipment(created.snap, order.id, "  MOCK-CN-1  ");
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.snap.shipments.find((s) => s.id === written.shipmentId)?.tracking).toBe("MOCK-CN-1");
    expect(written.snap.shipments.find((s) => s.id === written.shipmentId)?.mock).toBe(true);
    expect(written.snap.outbound.find((o) => o.id === order.id)?.tracking).toBe("MOCK-CN-1");
  });

  it("LOADED no se inventa; cancelar no expedido; el módulo no importa seur", () => {
    const { snap, orderId } = pickAndStage();
    const before = shipmentForOrder(snap, orderId)!;
    expect(before.loadedAt).toBeNull();
    const loaded = markShipmentLoaded(snap, orderId);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.snap.shipments.find((s) => s.id === loaded.shipmentId)?.status).toBe("LOADED");
    expect(loaded.snap.shipments.find((s) => s.id === loaded.shipmentId)?.loadedAt).toBeTruthy();

    const cancelled = mockCarrierAdapter.cancelShipment(loaded.snap, loaded.shipmentId);
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.snap.shipments.find((s) => s.id === loaded.shipmentId)?.status).toBe("CANCELLED");
    expect(cancelled.snap.outbound.find((o) => o.id === orderId)?.status).not.toBe("expedido");

    expect(Object.keys(mockCarrierAdapter)).not.toContain("seur");
    const src = readFileSync(new URL("./shipping.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*seur[^"']*["']/i);
  });
});
