import { describe, expect, it } from "vitest";
import { proposeReplenishments } from "./movements";
import {
  applyReplenishTask,
  currentSkuQty,
  minMaxReplenishQty,
  openMinMaxTasks,
  planMinMaxReplenishments,
} from "./replenishment";
import { buildWmsSeed } from "./seed";
import { createOutboundOrder, openWaveFromOrder } from "./waves";
import type { Pallet, WmsSnapshot } from "./types";

function withSkuCurrent(skuId: string, target: number, minStock = 30, maxStock = 100): WmsSnapshot {
  const seed = buildWmsSeed();
  let left = target;
  const pallets: Pallet[] = seed.pallets.map((p) => {
    if (p.skuId !== skuId || p.siteId !== "site-sev") {
      return p.skuId === skuId ? { ...p, qty: 0, status: "expedido" as const } : p;
    }
    if (left <= 0) return { ...p, qty: 0, status: "expedido" as const };
    const take = Math.min(p.qty, left);
    left -= take;
    return { ...p, qty: take };
  });
  return {
    ...seed,
    pallets,
    skus: seed.skus.map((s) => (s.id === skuId ? { ...s, minStock, maxStock } : s)),
  };
}

describe("oleada 7 · replenishment MIN/MAX", () => {
  it("SKU min 30 max 100 current 22 → propuesta 78", () => {
    expect(minMaxReplenishQty(30, 100, 22)).toBe(78);
    expect(minMaxReplenishQty(30, 100, 30)).toBe(0);
    expect(minMaxReplenishQty(30, 100, 40)).toBe(0);

    const snap = withSkuCurrent("sku-detergente", 22);
    expect(currentSkuQty(snap, "sku-detergente", "site-sev")).toBe(22);
    const plan = planMinMaxReplenishments(snap, { warehouseId: "site-sev" });
    const row = plan.find((r) => r.skuId === "sku-detergente");
    expect(row?.qty).toBe(78);
    expect(row?.kind).toBe("PLANNED");
  });

  it("AUTO no mueve sin operario; pick face vacío sigue proponiendo", () => {
    const seed = buildWmsSeed();
    expect(proposeReplenishments(seed).length).toBeGreaterThan(0);

    const snap = withSkuCurrent("sku-detergente", 22);
    const opened = openMinMaxTasks(snap, "site-sev");
    const task = opened.snap.replenishTasks.find((t) => t.skuId === "sku-detergente" && t.status === "open");
    expect(task).toBeTruthy();
    const auto = applyReplenishTask(opened.snap, task!.id, null);
    expect(auto.ok).toBe(false);
    if (!auto.ok) expect(auto.error).toBe("operator_required");
  });

  it("abrir ola encola AUTO si el proyectado baja del mínimo, sin mover palets", () => {
    const seed = buildWmsSeed();
    const base: WmsSnapshot = {
      ...seed,
      skus: seed.skus.map((s) => ({ ...s, minStock: 50_000, maxStock: 80_000 })),
      pickWaves: seed.pickWaves.map((w) => ({ ...w, status: "cerrada" as const })),
    };
    const created = createOutboundOrder(base, {
      customer: "Tienda CN · minmax",
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
    const wave = opened.snap.pickWaves.find((w) => w.id === opened.waveId)!;
    const skuId = wave.lines[0]!.skuId;
    const pal = opened.snap.pallets.find((p) => p.id === wave.lines[0]!.palletId)!;
    expect(pal.slotId).toBe(wave.lines[0]!.slotId);
    const task = opened.snap.replenishTasks.find((t) => t.waveId === opened.waveId && t.kind === "AUTO");
    expect(task).toBeTruthy();
    expect(task?.skuId).toBe(skuId);
    expect(task?.source).toBe("wave");
    expect(task?.qty).toBeGreaterThan(0);
  });

  it("semilla no inventa tareas MIN/MAX", () => {
    expect(buildWmsSeed().replenishTasks).toEqual([]);
  });
});
