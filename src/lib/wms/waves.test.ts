import { describe, expect, it } from "vitest";
import {
  availableQty,
  buildWmsSeed,
  confirmPick,
  createOutboundOrder,
  declareMerma,
  holdForLine,
  openWaveFromOrder,
  skipPickLine,
} from "@/lib/wms";
import { emptyInventorySlice, hydrateInventoryIfMissing } from "./inventory-core";
import type { Pallet, WmsSnapshot } from "./types";

function withClosedWaves(snap: WmsSnapshot): WmsSnapshot {
  return {
    ...snap,
    pickWaves: snap.pickWaves.map((w) => ({ ...w, status: "cerrada" as const })),
  };
}

function rehydrate(snap: WmsSnapshot): WmsSnapshot {
  return hydrateInventoryIfMissing({ ...snap, ...emptyInventorySlice() });
}

function pickFacePallets(snap: WmsSnapshot, siteId: string): Pallet[] {
  const ids = new Set(
    snap.slots.filter((s) => s.siteId === siteId && s.pickFace && s.palletId).map((s) => s.palletId!),
  );
  return snap.pallets.filter((p) => ids.has(p.id));
}

describe("olas · FEFO al abrir", () => {
  it("no mete un palet caducado de cara de picking en la ola nueva", () => {
    const seed = withClosedWaves(buildWmsSeed());
    const faces = pickFacePallets(seed, "site-sev");
    expect(faces.length).toBeGreaterThan(1);
    const deadId = faces[0]!.id;
    const snap = rehydrate({
      ...seed,
      pallets: seed.pallets.map((p) =>
        p.id === deadId ? { ...p, expiry: "2026-08-01T00:00:00.000Z", status: "en_ubicacion" } : p,
      ),
    });
    const created = createOutboundOrder(snap, {
      customer: "Tienda CN · FEFO caducado",
      cutOff: "2026-08-15T17:00:00.000Z",
      dock: "M-06",
      siteId: "site-sev",
      lines: 8,
      pallets: 12,
      priority: "normal",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const opened = openWaveFromOrder(created.snap, created.orderId, "op-08");
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const wave = opened.snap.pickWaves.find((w) => w.id === opened.waveId);
    expect(wave?.lines.some((l) => l.palletId === deadId)).toBe(false);
    expect(wave?.lines.length).toBeGreaterThan(0);
  });

  it("ordena por caducidad más cercana, no por receivedAt", () => {
    const seed = withClosedWaves(buildWmsSeed());
    const faces = pickFacePallets(seed, "site-sev");
    expect(faces.length).toBeGreaterThan(1);
    const laterExpiry = faces[0]!;
    const soonerExpiry = faces[1]!;
    const snap = rehydrate({
      ...seed,
      pallets: seed.pallets.map((p) => {
        if (p.id === laterExpiry.id) {
          return {
            ...p,
            expiry: "2026-10-01T00:00:00.000Z",
            receivedAt: "2026-01-01T00:00:00.000Z",
            status: "en_ubicacion" as const,
          };
        }
        if (p.id === soonerExpiry.id) {
          return {
            ...p,
            expiry: "2026-08-20T00:00:00.000Z",
            receivedAt: "2026-08-10T00:00:00.000Z",
            status: "en_ubicacion" as const,
          };
        }
        return { ...p, expiry: "2026-12-01T00:00:00.000Z" };
      }),
    });
    const created = createOutboundOrder(snap, {
      customer: "Tienda CN · FEFO orden",
      cutOff: "2026-08-15T18:00:00.000Z",
      dock: "M-05",
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
    const wave = opened.snap.pickWaves.find((w) => w.id === opened.waveId);
    expect(wave?.lines[0]?.palletId).toBe(soonerExpiry.id);
  });

  it("no pica palet en cuarentena aunque esté en cara de picking", () => {
    const seed = withClosedWaves(buildWmsSeed());
    const faces = pickFacePallets(seed, "site-sev");
    const blockedId = faces[0]!.id;
    const snap = rehydrate({
      ...seed,
      pallets: seed.pallets.map((p) => (p.id === blockedId ? { ...p, status: "cuarentena" as const } : p)),
    });
    const created = createOutboundOrder(snap, {
      customer: "Tienda CN · cuarentena",
      cutOff: "2026-08-15T19:00:00.000Z",
      dock: "M-04",
      siteId: "site-sev",
      lines: 4,
      pallets: 4,
      priority: "normal",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const opened = openWaveFromOrder(created.snap, created.orderId, "op-08");
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const wave = opened.snap.pickWaves.find((w) => w.id === opened.waveId);
    expect(wave?.lines.some((l) => l.palletId === blockedId)).toBe(false);
  });
});

describe("olas · holds al abrir", () => {
  it("reserva el palet, deja available a 0 y no admite otro hold", () => {
    const seed = withClosedWaves(buildWmsSeed());
    const created = createOutboundOrder(seed, {
      customer: "Tienda CN · hold",
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
    const wave = opened.snap.pickWaves.find((w) => w.id === opened.waveId)!;
    const line = wave.lines[0]!;
    expect(line.qty).toBe(opened.snap.pallets.find((p) => p.id === line.palletId)?.qty);
    const hold = holdForLine(opened.snap, line.id);
    expect(hold?.status).toBe("hold");
    expect(hold?.qty).toBe(line.qty);
    expect(availableQty(opened.snap, line.palletId!)).toBe(0);
  });

  it("omitir libera el hold; picar lo consume", () => {
    const seed = withClosedWaves(buildWmsSeed());
    const created = createOutboundOrder(seed, {
      customer: "Tienda CN · hold pick",
      cutOff: "2026-08-15T18:00:00.000Z",
      dock: "M-05",
      siteId: "site-sev",
      lines: 2,
      pallets: 2,
      priority: "normal",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const opened = openWaveFromOrder(created.snap, created.orderId, "op-08");
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const wave = opened.snap.pickWaves.find((w) => w.id === opened.waveId)!;
    const first = wave.lines[0]!;
    const pallet = opened.snap.pallets.find((p) => p.id === first.palletId)!;
    const slot = opened.snap.slots.find((s) => s.id === first.slotId)!;

    const skipped = skipPickLine(opened.snap, opened.waveId, first.id);
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(holdForLine(skipped.snap, first.id)).toBeUndefined();
    expect(availableQty(skipped.snap, pallet.id)).toBe(pallet.qty);

    const second = skipped.snap.pickWaves.find((w) => w.id === opened.waveId)!.lines.find((l) => l.id !== first.id);
    expect(second).toBeTruthy();
    if (!second?.palletId) return;
    const pal2 = skipped.snap.pallets.find((p) => p.id === second.palletId)!;
    const slot2 = skipped.snap.slots.find((s) => s.id === second.slotId)!;
    const picked = confirmPick(skipped.snap, opened.waveId, second.id, {
      slotCode: slot2.code,
      sscc: pal2.sscc,
      qty: second.qty,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const consumed = picked.snap.reservations.find((r) => r.lineId === second.id);
    expect(consumed?.status).toBe("consumed");
    expect(availableQty(picked.snap, pal2.id)).toBe(0);
    expect(slot.code).toBeTruthy();
  });

  it("la merma recorta el hold antes de bajar el físico", () => {
    const seed = withClosedWaves(buildWmsSeed());
    const created = createOutboundOrder(seed, {
      customer: "Tienda CN · hold merma",
      cutOff: "2026-08-15T19:00:00.000Z",
      dock: "M-04",
      siteId: "site-sev",
      lines: 1,
      pallets: 1,
      priority: "normal",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const opened = openWaveFromOrder(created.snap, created.orderId, "op-08");
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const wave = opened.snap.pickWaves.find((w) => w.id === opened.waveId)!;
    const line = wave.lines[0]!;
    const pallet = opened.snap.pallets.find((p) => p.id === line.palletId)!;
    const slot = opened.snap.slots.find((s) => s.id === pallet.slotId)!;
    expect(pallet.qty).toBeGreaterThan(1);
    const merma = declareMerma(opened.snap, {
      sscc: pallet.sscc,
      fromSlotCode: slot.code,
      qty: 1,
      reason: "caida",
    });
    expect(merma.ok).toBe(true);
    if (!merma.ok) return;
    const hold = holdForLine(merma.snap, line.id);
    expect(hold?.qty).toBe(pallet.qty - 1);
    expect(merma.snap.pallets.find((p) => p.id === pallet.id)?.qty).toBe(pallet.qty - 1);
  });
});

