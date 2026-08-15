import { describe, expect, it } from "vitest";
import { buildWmsSeed, computeTowerKpis } from "@/lib/wms";

describe("wms seed & stats", () => {
  it("builds a usable warehouse snapshot", () => {
    const snap = buildWmsSeed();
    expect(snap.sites.length).toBeGreaterThanOrEqual(2);
    expect(snap.slots.length).toBeGreaterThan(50);
    expect(snap.pallets.length).toBeGreaterThan(10);
    expect(snap.fleet.length).toBeGreaterThan(3);
    expect(snap.operators.length).toBeGreaterThan(5);
    expect(snap.sites.some((s) => s.city === "Huelva")).toBe(true);
    expect(snap.slots.some((s) => s.siteId === "site-hue")).toBe(true);
  });

  it("computes tower KPIs", () => {
    const kpis = computeTowerKpis(buildWmsSeed());
    expect(kpis.occupancyPct).toBeGreaterThan(0);
    expect(kpis.palletsLive).toBeGreaterThan(0);
    expect(kpis.operatorsActive).toBeGreaterThan(0);
    expect(kpis.costMonthEur).toBeGreaterThan(0);
  });

  it("builds pick waves with aisle-bay-level-position codes", () => {
    const snap = buildWmsSeed();
    expect(snap.pickWaves.length).toBeGreaterThan(0);
    expect(snap.slots[0]?.position).toBeDefined();
    expect(snap.slots.some((s) => s.pickFace)).toBe(true);
    expect(snap.slots[0]?.code.split("-").length).toBe(4);
    expect(snap.fleet.some((f) => f.kind === "retractil_doble")).toBe(true);
    expect(snap.pickWaves.some((w) => w.kind === "reposicion" && w.fleetId === "fl-07")).toBe(true);
  });
});
