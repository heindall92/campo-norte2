import { describe, expect, it } from "vitest";
import {
  closeCountSession,
  confirmCountSessionLine,
  confirmCycleCount,
  linesForSession,
  openCountSession,
  planCycleCounts,
  skipCountSessionLine,
} from "./cycle-count";
import { buildWmsSeed } from "./seed";

describe("wms cycle count", () => {
  it("prioritizes expiry, ABC-A and stale slots", () => {
    const snap = buildWmsSeed();
    const tasks = planCycleCounts(snap, { siteId: "site-sev", limit: 8 });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0]!.score).toBeGreaterThanOrEqual(tasks.at(-1)!.score);
    expect(tasks.some((t) => t.reason === "caducidad" || t.reason === "abc_a")).toBe(true);
  });

  it("confirms a count and records variance as ajuste", () => {
    const snap = buildWmsSeed();
    const task = planCycleCounts(snap, { siteId: "site-sev", limit: 1 })[0]!;
    const slot = snap.slots.find((s) => s.id === task.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === task.palletId)!;
    const ok = confirmCycleCount(snap, task, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: pallet.qty - 1,
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.variance).toBe(-1);
    expect(ok.snap.movements[0]?.type).toBe("ajuste");
    expect(ok.snap.pallets.find((p) => p.id === pallet.id)?.qty).toBe(pallet.qty - 1);
  });

  it("abre sesión cíclica, el desvío lleva operatorId y audit, y no inventa full count", () => {
    const snap = buildWmsSeed();
    const opened = openCountSession(snap, { warehouseId: "site-sev", kind: "cyclic", operatorId: "op-08" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const line = linesForSession(opened.snap, opened.sessionId)[0]!;
    const slot = opened.snap.slots.find((s) => s.id === line.slotId)!;
    const pallet = opened.snap.pallets.find((p) => p.id === line.palletId)!;
    const counted = confirmCountSessionLine(opened.snap, opened.sessionId, line.id, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: pallet.qty - 1,
      operatorId: "op-08",
    });
    expect(counted.ok).toBe(true);
    if (!counted.ok) return;
    expect(counted.variance).toBe(-1);
    expect(counted.snap.movements[0]?.type).toBe("ajuste");
    expect(counted.snap.movements[0]?.operatorId).toBe("op-08");
    expect(counted.snap.auditLogs[0]?.action).toBe("cycle_count_adjust");
    expect(counted.snap.auditLogs[0]?.actorId).toBe("op-08");
    const skuKind = openCountSession(snap, { warehouseId: "site-sev", kind: "sku" });
    expect(skuKind.ok).toBe(false);
    if (!skuKind.ok) expect(skuKind.error).toBe("filter_required");
  });

  it("SKU/lote/hueco exigen el filtro escrito; omitir cierra la línea sin inventar qty", () => {
    const snap = buildWmsSeed();
    const pallet = snap.pallets.find((p) => p.siteId === "site-sev" && p.slotId && p.qty > 0)!;
    const bySku = openCountSession(snap, { warehouseId: "site-sev", kind: "sku", skuId: pallet.skuId });
    expect(bySku.ok).toBe(true);
    if (!bySku.ok) return;
    expect(linesForSession(bySku.snap, bySku.sessionId).every((l) => l.skuId === pallet.skuId)).toBe(true);

    const byLot = openCountSession(snap, { warehouseId: "site-sev", kind: "lot", lot: pallet.lot });
    expect(byLot.ok).toBe(true);
    if (!byLot.ok) return;
    const skipped = skipCountSessionLine(byLot.snap, byLot.sessionId, linesForSession(byLot.snap, byLot.sessionId)[0]!.id);
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    const closed = closeCountSession(skipped.snap, byLot.sessionId);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.snap.countSessions.find((s) => s.id === byLot.sessionId)?.status).toBe("closed");
    expect(closed.snap.pallets.find((p) => p.id === pallet.id)?.qty).toBe(pallet.qty);
  });
});
