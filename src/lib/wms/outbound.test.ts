import { describe, expect, it } from "vitest";
import {
  buildLoadManifest,
  buildWmsSeed,
  confirmPick,
  createOutboundOrder,
  nextOpenLine,
  openWaveFromOrder,
  orderFulfillment,
  packPickLine,
  packPickedLines,
  shipOutboundOrder,
  skipPickLine,
  stageOrderToDock,
} from "@/lib/wms";

function pickOpenLine(snap: ReturnType<typeof buildWmsSeed>, waveId: string) {
  const wave = snap.pickWaves.find((w) => w.id === waveId)!;
  const line = nextOpenLine(wave)!;
  const slot = snap.slots.find((s) => s.id === line.slotId)!;
  const pallet = snap.pallets.find((p) => p.id === line.palletId)!;
  return confirmPick(snap, waveId, line.id, {
    slotCode: slot.code,
    sscc: pallet.sscc,
    qty: line.qty,
  });
}

describe("fase 12 · cargar muelle y expedir", () => {
  it("vacía el hueco, carga el palet entero y expede sin inventar tracking", () => {
    const snap = buildWmsSeed();
    const created = createOutboundOrder(snap, {
      customer: "Tienda CN · Mairena",
      cutOff: "2026-08-15T17:00:00.000Z",
      dock: "M-06",
      siteId: "site-sev",
      lines: 1,
      pallets: 1,
      priority: "urgente",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const opened = openWaveFromOrder(created.snap, created.orderId, "op-08");
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const picked = pickOpenLine(opened.snap, opened.waveId);
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const line = opened.snap.pickWaves.find((w) => w.id === opened.waveId)!.lines[0]!;
    const emptied = picked.snap.pallets.find((p) => p.id === line.palletId)!;
    expect(emptied.qty).toBe(0);
    expect(emptied.status).toBe("picking");
    expect(emptied.slotId).toBeNull();
    expect(picked.snap.slots.find((s) => s.id === line.slotId)?.status).toBe("libre");
    expect(picked.snap.outbound.find((o) => o.id === created.orderId)?.tracking).toBeNull();

    const earlyShip = shipOutboundOrder(picked.snap, created.orderId, "op-08");
    expect(earlyShip.ok).toBe(false);
    if (!earlyShip.ok) expect(earlyShip.error).toBe("pallets_not_staged");

    const staged = stageOrderToDock(picked.snap, created.orderId, "op-08");
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const onDock = staged.snap.pallets.find((p) => p.id === line.palletId)!;
    expect(onDock.status).toBe("muelle");
    expect(staged.snap.outbound.find((o) => o.id === created.orderId)?.status).toBe("muelle");
    const dockSlot = staged.snap.slots.find((s) => s.id === onDock.slotId);
    expect(dockSlot?.zone).toBe("muelle");

    const shipped = shipOutboundOrder(staged.snap, created.orderId, "op-08");
    expect(shipped.ok).toBe(true);
    if (!shipped.ok) return;
    const order = shipped.snap.outbound.find((o) => o.id === created.orderId)!;
    expect(order.status).toBe("expedido");
    expect(order.tracking).toBeNull();
    expect(shipped.snap.pallets.find((p) => p.id === line.palletId)?.status).toBe("expedido");
    expect(shipped.snap.slots.find((s) => s.id === dockSlot?.id)?.status).toBe("libre");
  });

  it("no expede si la ola sigue abierta o no se ha picado nada", () => {
    const snap = buildWmsSeed();
    const created = createOutboundOrder(snap, {
      customer: "Tienda CN · Osuna",
      cutOff: "2026-08-15T18:00:00.000Z",
      dock: "M-05",
      siteId: "site-sev",
      lines: 2,
      pallets: 2,
      priority: "normal",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(shipOutboundOrder(created.snap, created.orderId).ok).toBe(false);
    const opened = openWaveFromOrder(created.snap, created.orderId, "op-03");
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const blocked = shipOutboundOrder(opened.snap, created.orderId);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe("wave_open");
    const fill = orderFulfillment(opened.snap, created.orderId);
    expect(fill?.canShip).toBe(false);
    expect(fill?.canStage).toBe(false);
  });

  it("expide cajas sueltas cuando no queda palet entero que cargar", () => {
    const snap = buildWmsSeed();
    const wave = snap.pickWaves.find((w) => w.id === "wave-01")!;
    let current = snap;
    const first = nextOpenLine(wave)!;
    const firstSlot = snap.slots.find((s) => s.id === first.slotId)!;
    const firstPal = snap.pallets.find((p) => p.id === first.palletId)!;
    const firstPick = confirmPick(snap, "wave-01", first.id, {
      slotCode: firstSlot.code,
      sscc: firstPal.sscc,
      qty: 1,
    });
    expect(firstPick.ok).toBe(true);
    if (!firstPick.ok) return;
    current = firstPick.snap;
    while (nextOpenLine(current.pickWaves.find((w) => w.id === "wave-01")!)) {
      const open = nextOpenLine(current.pickWaves.find((w) => w.id === "wave-01")!)!;
      const done = skipPickLine(current, "wave-01", open.id);
      expect(done.ok).toBe(true);
      if (!done.ok) return;
      current = done.snap;
    }
    const order = current.outbound.find((o) => o.code === wave.lines[0]!.orderCode)!;
    const fill = orderFulfillment(current, order.id);
    expect(fill?.wavesClosed).toBe(true);
    expect(fill?.qtyPicked).toBeGreaterThan(0);
    expect(fill?.fullPalletsToStage).toHaveLength(0);
    expect(fill?.canShip).toBe(false);
    expect(fill?.canPack).toBe(true);
    const blocked = shipOutboundOrder(current, order.id, "op-03");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe("not_packed");

    const packed = packPickedLines(current, order.id, "op-03");
    expect(packed.ok).toBe(true);
    if (!packed.ok) return;
    expect(packed.snap.outbound.find((o) => o.id === order.id)?.status).toBe("embalaje");
    const manifest = buildLoadManifest(packed.snap, order.id);
    expect(manifest?.rows.every((r) => r.kind === "caja")).toBe(true);
    expect(manifest?.caseCount).toBe(1);
    expect(manifest?.tracking).toBeNull();
    const shipped = shipOutboundOrder(packed.snap, order.id, "op-03");
    expect(shipped.ok).toBe(true);
    if (!shipped.ok) return;
    expect(shipped.snap.outbound.find((o) => o.id === order.id)?.status).toBe("expedido");
  });

  it("no embala más unidades de las picadas y el manifiesto no inventa SSCC", () => {
    const snap = buildWmsSeed();
    const wave = snap.pickWaves.find((w) => w.id === "wave-01")!;
    const line = nextOpenLine(wave)!;
    const slot = snap.slots.find((s) => s.id === line.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === line.palletId)!;
    const picked = confirmPick(snap, "wave-01", line.id, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: 2,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const over = packPickLine(picked.snap, "wave-01", line.id, 3);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toBe("invalid_qty");
    const ok = packPickLine(picked.snap, "wave-01", line.id, 2);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const packedLine = ok.snap.pickWaves
      .find((w) => w.id === "wave-01")!
      .lines.find((l) => l.id === line.id);
    expect(packedLine?.qtyPacked).toBe(2);
    const order = ok.snap.outbound.find((o) => o.code === line.orderCode)!;
    const manifest = buildLoadManifest(ok.snap, order.id);
    expect(manifest?.rows.some((r) => r.kind === "caja" && r.qty === 2 && r.sscc === null)).toBe(true);
  });
});
