import { describe, expect, it } from "vitest";
import { WMS_DEMO_NOW } from "./alerts";
import { buildWmsSeed } from "./seed";
import { computeTowerPulse, recommendTowerActions } from "./tower";

describe("control tower pulse", () => {
  it("cuenta líneas reales de la ola, no un 38 inventado", () => {
    const snap = buildWmsSeed();
    const wave = snap.pickWaves.find((w) => w.id === "wave-01")!;
    const pending = wave.lines.filter((l) => l.status === "pendiente" || l.status === "en_curso").length;
    expect(pending).toBeGreaterThan(0);
    expect(pending).not.toBe(38);

    const pulse = computeTowerPulse(snap, "site-sev", new Date(WMS_DEMO_NOW));
    expect(pulse.wavesOpen).toBeGreaterThan(0);
    expect(pulse.pickOpen).toBeGreaterThan(0);
    expect(pulse.ordersOpen).toBeGreaterThan(0);
    expect(pulse.stockAvailabilityPct).toBeGreaterThanOrEqual(0);
    expect(pulse.stockAvailabilityPct).toBeLessThanOrEqual(100);
    expect(pulse.dockOccupancyPct).toBeGreaterThanOrEqual(0);
    expect(pulse.workforceCoveragePct).toBeGreaterThanOrEqual(0);
    expect(pulse.incidents).toBe(pulse.mermaToday + pulse.slotFixes);

    const actions = recommendTowerActions(snap, "site-sev", new Date(WMS_DEMO_NOW));
    const aboutWave = actions.find((a) => a.waveId === "wave-01");
    expect(aboutWave?.titleEs).toContain(String(pending));
    expect(aboutWave?.titleEs).not.toContain("38 líneas");
    expect(aboutWave?.kind).toBe("OPEN_PICKING");

    const noOp = {
      ...snap,
      pickWaves: snap.pickWaves.map((w) => (w.id === "wave-01" ? { ...w, operatorId: null } : w)),
    };
    const assign = recommendTowerActions(noOp, "site-sev", new Date(WMS_DEMO_NOW)).find((a) => a.waveId === "wave-01");
    expect(assign?.kind).toBe("ASSIGN_PICKER");
    expect(assign?.actionEs).toBe("ASIGNAR PICKER");

    const ship = recommendTowerActions(snap, "site-sev", new Date(WMS_DEMO_NOW)).find((a) => a.kind === "SHIP_RISK");
    expect(ship?.titleEs).toContain("OUT-SEV-8840");
  });
});
