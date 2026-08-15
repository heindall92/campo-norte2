import { describe, expect, it } from "vitest";
import {
  computeShiftCoverage,
  computeSitePnl,
  computeUnitEconomics,
  countPalletMoves,
} from "./economics";
import { buildWmsSeed } from "./seed";

describe("wms economics & shifts", () => {
  it("computes cost per pallet move and per pick line", () => {
    const snap = buildWmsSeed();
    const unit = computeUnitEconomics(snap, "site-sev");
    expect(countPalletMoves(snap, "site-sev")).toBeGreaterThan(0);
    expect(unit.costPerPalletMoveEur).toBeGreaterThan(0);
    expect(unit.costPerPickLineEur).toBeGreaterThan(0);
    expect(Number.isFinite(unit.costPerPalletMoveEur)).toBe(true);
  });

  it("builds a site P&L with 3PL revenue vs warehouse opex", () => {
    const pnl = computeSitePnl(buildWmsSeed(), "2026-08", "site-sev");
    expect(pnl.revenueEur).toBeGreaterThan(0);
    expect(pnl.opexEur).toBeGreaterThan(100_000);
    expect(pnl.storageEur).toBeGreaterThan(0);
    expect(pnl.handlingEur).toBeGreaterThan(0);
  });

  it("flags night picker coverage gap in Sevilla", () => {
    const cov = computeShiftCoverage(buildWmsSeed(), "site-sev");
    expect(cov.headsByShift.manana).toBeGreaterThan(0);
    const nightPicker = cov.gaps.find((g) => g.shift === "noche" && g.role === "picker");
    expect(nightPicker).toBeDefined();
    expect(nightPicker!.gap).toBeLessThan(0);
  });
});
