import { describe, expect, it } from "vitest";
import { computeCostStructure, computeUnitOpCosts } from "./costs";
import { buildWmsSeed } from "./seed";

describe("wms operational costs", () => {
  it("arma labor/carrier/handling/storage y costes unitarios finitos", () => {
    const snap = buildWmsSeed();
    const structure = computeCostStructure(snap, "2026-08", "site-sev");
    expect(structure.laborEur).toBeGreaterThan(0);
    expect(structure.carrierEur).toBe(54_300);
    expect(structure.handlingEur).toBeGreaterThan(0);
    expect(structure.storageEur).toBeGreaterThan(0);

    const unit = computeUnitOpCosts(snap, "2026-08", "site-sev");
    expect(unit.costPerOrderEur).toBeGreaterThan(0);
    expect(unit.costPerLineEur).toBeGreaterThan(0);
    expect(unit.costPerPalletEur).toBeGreaterThan(0);
    expect(unit.costPerPickEur).toBeGreaterThan(0);
    expect(unit.costPerShipEur).toBeGreaterThan(0);
    expect(Number.isFinite(unit.costPerShipEur)).toBe(true);
  });
});
