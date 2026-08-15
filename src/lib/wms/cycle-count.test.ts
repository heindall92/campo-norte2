import { describe, expect, it } from "vitest";
import { confirmCycleCount, planCycleCounts } from "./cycle-count";
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
});
