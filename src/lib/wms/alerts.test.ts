import { describe, expect, it } from "vitest";
import { alertCounts, computeWmsAlerts, WMS_DEMO_NOW } from "./alerts";
import { buildWmsSeed } from "./seed";

describe("wms operational alerts", () => {
  it("flags battery, expiry, cut-off and empty pick face", () => {
    const snap = buildWmsSeed();
    const alerts = computeWmsAlerts(snap, new Date(WMS_DEMO_NOW), "site-sev");
    const kinds = new Set(alerts.map((a) => a.kind));
    expect(kinds.has("bateria")).toBe(true);
    expect(kinds.has("caducidad")).toBe(true);
    expect(kinds.has("cut_off")).toBe(true);
    expect(kinds.has("pick_face")).toBe(true);
    const counts = alertCounts(alerts);
    expect(counts.critical).toBeGreaterThan(0);
    expect(counts.total).toBeGreaterThan(3);
  });
});
