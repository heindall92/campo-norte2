import { describe, expect, it } from "vitest";
import { acceptSlottingRecommendation } from "./movements";
import { buildWmsSeed } from "./seed";
import {
  addSlottingRule,
  openSlottingRecommendation,
  rankPutawayCandidates,
  suggestPutawaySlot,
  zoneForCategory,
} from "./slotting";

describe("oleada 6 · putaway ranking + slotting", () => {
  it("prioriza la zona del SKU y no inventa metros", () => {
    const snap = buildWmsSeed();
    const leche = snap.pallets.find((p) => p.status === "muelle" && p.skuId === "sku-arroz") ??
      snap.pallets.find((p) => p.status === "muelle")!;
    expect(leche).toBeTruthy();
    const ranked = rankPutawayCandidates(snap, leche, { limit: 8 });
    expect(ranked.length).toBeGreaterThan(0);
    const preferred = zoneForCategory(snap.skus.find((s) => s.id === leche.skuId)!.category);
    expect(ranked[0]!.zone).toBe(preferred);
    expect(ranked[0]!.score).toBeGreaterThanOrEqual(ranked.at(-1)!.score);
    expect(ranked.every((c) => c.travelPct >= 0 && c.travelPct <= 100)).toBe(true);
    expect(ranked[0]!.reasons).toContain("zone_match");
    const suggested = suggestPutawaySlot(snap, leche);
    expect(suggested?.id).toBe(ranked[0]!.slotId);
  });

  it("la recomendación no aplica el putaway hasta confirmar", () => {
    const snap = buildWmsSeed();
    const pal = snap.pallets.find((p) => p.status === "muelle")!;
    const slotBefore = pal.slotId;
    const opened = openSlottingRecommendation(snap, pal.id);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const still = opened.snap.pallets.find((p) => p.id === pal.id)!;
    expect(still.slotId).toBe(slotBefore);
    expect(still.status).toBe("muelle");
    const rec = opened.snap.slottingRecommendations.find((r) => r.id === opened.recId)!;
    expect(rec.acceptedAt).toBeNull();
    expect(rec.toCode).toBeTruthy();

    const accepted = acceptSlottingRecommendation(opened.snap, opened.recId, "op-02");
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    const moved = accepted.snap.pallets.find((p) => p.id === pal.id)!;
    expect(moved.status).toBe("en_ubicacion");
    expect(moved.slotId).not.toBe(slotBefore);
    expect(accepted.snap.slottingRecommendations.find((r) => r.id === opened.recId)?.acceptedAt).toBeTruthy();
  });

  it("excluye capacidad 0 y bahía incompatible solo con regla escrita", () => {
    const seed = buildWmsSeed();
    const pal = seed.pallets.find((p) => p.status === "muelle")!;
    const top = rankPutawayCandidates(seed, pal, { limit: 1 })[0]!;
    const zeroCap: typeof seed = {
      ...seed,
      slots: seed.slots.map((s) => (s.id === top.slotId ? { ...s, capacityPallets: 0 } : s)),
    };
    const withoutZero = rankPutawayCandidates(zeroCap, pal, { limit: 12 });
    expect(withoutZero.some((c) => c.slotId === top.slotId)).toBe(false);

    const det = seed.pallets.find((p) => p.skuId === "sku-detergente" && p.slotId && p.siteId === pal.siteId);
    const detSlot = det ? seed.slots.find((s) => s.id === det.slotId) : undefined;
    const neighbor = detSlot
      ? seed.slots.find(
          (s) =>
            s.siteId === detSlot.siteId &&
            s.aisle === detSlot.aisle &&
            s.rack === detSlot.rack &&
            s.id !== detSlot.id &&
            s.status === "libre" &&
            !s.palletId &&
            s.zone !== "muelle",
        )
      : undefined;
    expect(neighbor).toBeTruthy();
    const aceite = { ...pal, skuId: "sku-aceite" as const };
    const before = rankPutawayCandidates(seed, aceite, { limit: 40 });
    expect(before.some((c) => c.slotId === neighbor!.id)).toBe(true);

    const ruled = addSlottingRule(seed, {
      kind: "incompatible_sku",
      left: "sku-aceite",
      right: "sku-detergente",
      note: "no mezclar aceite y droguería en la misma bahía",
    });
    expect(ruled.ok).toBe(true);
    if (!ruled.ok) return;
    const after = rankPutawayCandidates(ruled.snap, aceite, { limit: 40 });
    expect(after.some((c) => c.slotId === neighbor!.id)).toBe(false);
  });

  it("semilla no inventa reglas ni recomendaciones", () => {
    const snap = buildWmsSeed();
    expect(snap.slottingRules).toEqual([]);
    expect(snap.slottingRecommendations).toEqual([]);
  });
});
