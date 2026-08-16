import { describe, expect, it } from "vitest";
import { applyOrderEvent } from "./order-state";
import { authorizeWms, type WmsActor } from "./permissions";
import { confirmPick, nextOpenLine } from "./picking";
import { applyRfScan, buildRfQueue, confirmRfTask, startRfSession } from "./rf";
import { availableQty, reserveStock } from "./reservations";
import { returnShippedPallet } from "./returns";
import { buildWmsSeed } from "./seed";
import { proposeReplenishments, putawayReceivedPallet, suggestPutawaySlot } from "./movements";
import { confirmCycleCount, planCycleCounts } from "./cycle-count";
import { selectLot, lotFromPallet } from "./lots";
import { CAMPO_NORTE_ORG } from "./org";

const ops: WmsActor = { role: "ops", orgId: CAMPO_NORTE_ORG.id, warehouseIds: "*" };
const guide: WmsActor = { role: "guide", orgId: CAMPO_NORTE_ORG.id, warehouseIds: ["site-sev"] };
const office: WmsActor = { role: "booking", orgId: CAMPO_NORTE_ORG.id, warehouseIds: "*" };
const stranger: WmsActor = { role: "ops", orgId: "org-otra", warehouseIds: "*" };

describe("ops críticas · inventory / allocation / picking", () => {
  it("rechaza inventario negativo y escasez al picar", () => {
    const snap = buildWmsSeed();
    const wave = snap.pickWaves.find((w) => w.id === "wave-01")!;
    const line = nextOpenLine(wave)!;
    const slot = snap.slots.find((s) => s.id === line.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === line.palletId)!;
    const over = confirmPick(snap, wave.id, line.id, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: pallet.qty + 50,
    });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toBe("invalid_qty");
  });

  it("reserva, impide doble hold y respeta revisión concurrente", () => {
    const snap = buildWmsSeed();
    const pallet = snap.pallets.find((p) => p.siteId === "site-sev" && p.status === "en_ubicacion" && p.qty > 4)!;
    const first = reserveStock(snap, {
      palletId: pallet.id,
      qty: 2,
      orderCode: "OUT-TEST-1",
      warehouseId: "site-sev",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(availableQty(first.snap, pallet.id)).toBe(pallet.qty - 2);

    const dup = reserveStock(first.snap, {
      palletId: pallet.id,
      qty: 1,
      orderCode: "OUT-TEST-1",
      warehouseId: "site-sev",
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toBe("already_reserved");

    const shortage = reserveStock(first.snap, {
      palletId: pallet.id,
      qty: pallet.qty,
      orderCode: "OUT-TEST-2",
      warehouseId: "site-sev",
    });
    expect(shortage.ok).toBe(false);
    if (!shortage.ok) expect(shortage.error).toBe("stock_shortage");

    const stale = reserveStock(first.snap, {
      palletId: pallet.id,
      qty: 1,
      orderCode: "OUT-TEST-3",
      warehouseId: "site-sev",
      expectedRevision: 0,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error).toBe("revision_conflict");
  });

  it("rechaza lote caducado en la reserva", () => {
    const snap = buildWmsSeed();
    const pallet = snap.pallets.find((p) => p.siteId === "site-sev" && p.qty > 0)!;
    const expired = {
      ...snap,
      pallets: snap.pallets.map((p) =>
        p.id === pallet.id ? { ...p, expiry: "2026-08-01T00:00:00.000Z", status: "en_ubicacion" as const } : p,
      ),
    };
    const res = reserveStock(expired, {
      palletId: pallet.id,
      qty: 1,
      orderCode: "OUT-EXP",
      warehouseId: pallet.siteId,
      nowMs: Date.parse("2026-08-15T11:00:00.000Z"),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("expired_lot");
  });
});

describe("ops críticas · RF / transiciones / permisos", () => {
  it("escaneo duplicado no vuelve a confirmar la línea", () => {
    const snap = buildWmsSeed();
    const wave = snap.pickWaves.find((w) => w.id === "wave-01")!;
    const line = nextOpenLine(wave)!;
    const task = buildRfQueue(snap, "site-sev").find((t) => t.lineId === line.id)!;
    let session = startRfSession(task);
    for (const raw of [task.fromCode, task.sscc, String(task.qty)]) {
      const step = applyRfScan(session, raw);
      expect(step.ok).toBe(true);
      if (step.ok) session = step.session;
    }
    const first = confirmRfTask(snap, session, "op-03");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = confirmRfTask(first.snap, session, "op-03");
    expect(second.ok).toBe(false);
  });

  it("transición inválida de pedido se rechaza", () => {
    const ship = applyOrderEvent("CREATED", "ship", "2026-08-15T11:00:00.000Z");
    expect(ship.ok).toBe(false);
    if (!ship.ok) expect(ship.error).toBe("invalid_transition");
  });

  it("el frontend no basta: booking no expide y otro org no entra", () => {
    const snap = buildWmsSeed();
    expect(authorizeWms(snap, office, "ship", "site-sev").ok).toBe(false);
    expect(authorizeWms(snap, guide, "wave.assign", "site-sev").ok).toBe(false);
    expect(authorizeWms(snap, guide, "stock.write", "site-sev").ok).toBe(true);
    const hue = authorizeWms(snap, guide, "stock.write", "site-hue");
    expect(hue.ok).toBe(false);
    if (!hue.ok) expect(hue.error).toBe("warehouse_forbidden");
    const other = authorizeWms(snap, stranger, "stock.read");
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.error).toBe("org_mismatch");
    expect(authorizeWms(snap, ops, "ship", "site-sev").ok).toBe(true);
  });
});

describe("ops críticas · receiving / putaway / replenish / FEFO / count / returns", () => {
  it("putaway y reposición salen de huecos reales", () => {
    const snap = buildWmsSeed();
    const dockPallet = snap.pallets.find((p) => p.status === "muelle" && p.siteId === "site-sev");
    expect(dockPallet).toBeTruthy();
    if (!dockPallet) return;
    const dest = suggestPutawaySlot(snap, dockPallet);
    expect(dest).toBeTruthy();
    if (!dest) return;
    const put = putawayReceivedPallet(snap, dockPallet.id, dest.code, "op-02");
    expect(put.ok).toBe(true);
    expect(proposeReplenishments(snap).length).toBeGreaterThan(0);
  });

  it("FEFO no elige caducado; cycle count no inventa qty", () => {
    const now = Date.parse("2026-08-15T11:00:00.000Z");
    const snap = buildWmsSeed();
    const live = snap.pallets.filter((p) => p.expiry && p.status !== "expedido").slice(0, 2);
    const candidates = live.map((p) => lotFromPallet(p));
    if (candidates.length) {
      const picked = selectLot(
        [
          ...candidates,
          {
            id: "dead",
            lot: "X",
            batchCode: "X",
            qty: 9,
            receivedAt: "2026-01-01T00:00:00.000Z",
            expiry: "2026-08-01T00:00:00.000Z",
            manufacturedAt: null,
            blocked: false,
          },
        ],
        "FEFO",
        now,
      );
      expect(picked?.id).not.toBe("dead");
    }
    const task = planCycleCounts(snap, { siteId: "site-sev", limit: 1 })[0];
    expect(task).toBeTruthy();
    if (!task) return;
    const slot = snap.slots.find((s) => s.id === task.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === task.palletId)!;
    const counted = confirmCycleCount(snap, task, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: task.expectedQty,
    });
    expect(counted.ok).toBe(true);
    if (counted.ok) expect(counted.variance).toBe(0);
  });

  it("devolución solo de palet expedido a hueco libre", () => {
    const snap = buildWmsSeed();
    const pallet = snap.pallets.find((p) => p.siteId === "site-sev")!;
    const shipped = {
      ...snap,
      pallets: snap.pallets.map((p) =>
        p.id === pallet.id ? { ...p, status: "expedido" as const, slotId: null } : p,
      ),
      slots: snap.slots.map((s) => (s.palletId === pallet.id ? { ...s, palletId: null, status: "libre" as const } : s)),
      outbound: snap.outbound.map((o) =>
        o.id === "out-04" ? o : o.id === "out-03" ? { ...o, status: "expedido" as const } : o,
      ),
    };
    const free = shipped.slots.find((s) => s.siteId === "site-sev" && s.status === "libre" && !s.palletId)!;
    const live = returnShippedPallet(shipped, {
      palletId: pallet.id,
      orderCode: "OUT-SEV-8840",
      toSlotCode: free.code,
    });
    expect(live.ok).toBe(true);
    const again = returnShippedPallet(snap, {
      palletId: pallet.id,
      orderCode: "OUT-SEV-8840",
      toSlotCode: free.code,
    });
    expect(again.ok).toBe(false);
  });
});
