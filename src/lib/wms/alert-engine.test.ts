import { describe, expect, it } from "vitest";
import { WMS_DEMO_NOW } from "./alerts";
import { buildOpsAlerts, opsAlertCounts } from "./alert-engine";
import { buildWmsSeed } from "./seed";

describe("ops alert engine", () => {
  it("emite tipos del brief con severity/status/entity/acción", () => {
    const snap = buildWmsSeed();
    const alerts = buildOpsAlerts(snap, new Date(WMS_DEMO_NOW), "site-sev");
    const types = new Set(alerts.map((a) => a.type));
    expect(types.has("SHIPMENT_DELAY")).toBe(true);
    expect(types.has("DOCK_DELAY")).toBe(true);
    expect(types.has("WAVE_AT_RISK") || types.has("PICKING_DELAY")).toBe(true);
    expect(types.has("REPLENISHMENT_REQUIRED")).toBe(true);
    expect(alerts.some((a) => a.type === "LOW_STOCK" || a.type === "STOCKOUT" || a.type === "EXPIRING" || a.type === "EXPIRED")).toBe(true);
    for (const a of alerts) {
      expect(a.severity).toMatch(/info|warn|critical/);
      expect(a.status).toMatch(/open|resolved/);
      expect(a.createdAt).toBeTruthy();
      expect(a.entity).toBeTruthy();
      expect(a.recommendedAction).toBeTruthy();
      if (a.status === "open") expect(a.resolvedAt).toBeNull();
    }
    const ship = alerts.find((a) => a.type === "SHIPMENT_DELAY");
    expect(ship?.titleEs).toContain("OUT-SEV-8840");
    expect(opsAlertCounts(alerts).total).toBeGreaterThan(0);
  });
});
