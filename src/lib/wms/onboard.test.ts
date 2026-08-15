import { describe, expect, it } from "vitest";
import { assignOutboundCarrier, trackingFor } from "./carriers";
import { CAMPO_NORTE_ORG, scopeSnapshotToOrg } from "./org";
import { generateSiteSlots, nextSiteCode, onboardSite } from "./onboard";
import { buildWmsSeed } from "./seed";

describe("wms org, onboard and carriers", () => {
  it("scopes snapshot to org_id and drops foreign sites", () => {
    const snap = buildWmsSeed();
    expect(snap.org.id).toBe(CAMPO_NORTE_ORG.id);
    const scoped = scopeSnapshotToOrg(snap, CAMPO_NORTE_ORG.id);
    expect(scoped.sites).toHaveLength(snap.sites.length);
    expect(scoped.carriers.every((c) => c.orgId === CAMPO_NORTE_ORG.id)).toBe(true);

    const empty = scopeSnapshotToOrg(snap, "org-other");
    expect(empty.sites).toHaveLength(0);
    expect(empty.slots).toHaveLength(0);
    expect(empty.carriers).toHaveLength(0);
  });

  it("onboards a Basel hub with empty selective rack + dock", () => {
    const snap = buildWmsSeed();
    const result = onboardSite(snap, {
      orgId: CAMPO_NORTE_ORG.id,
      city: "Basel",
      region: "Basel-Stadt",
      country: "CH",
      aisles: ["H", "I"],
      bays: 4,
      levels: 4,
      zone: "seco",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.site.code).toBe("CN-BAS-03");
    expect(result.site.orgId).toBe(CAMPO_NORTE_ORG.id);
    const newSlots = result.snap.slots.filter((s) => s.siteId === result.site.id);
    expect(newSlots.length).toBeGreaterThan(20);
    expect(newSlots.every((s) => s.status === "libre")).toBe(true);
    expect(newSlots.some((s) => s.aisle === "M" && s.zone === "muelle")).toBe(true);
    expect(newSlots.some((s) => s.pickFace && s.aisle === "H")).toBe(true);
    expect(snap.sites).toHaveLength(2);
  });

  it("rejects onboarding for another org", () => {
    const result = onboardSite(buildWmsSeed(), {
      orgId: "org-other",
      city: "München",
      region: "Bayern",
      country: "DE",
      aisles: ["A"],
      bays: 2,
      levels: 2,
      zone: "seco",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("wrong_org");
  });

  it("assigns carrier, tracking and dock window", () => {
    const snap = buildWmsSeed();
    const order = snap.outbound.find((o) => o.id === "out-02")!;
    expect(order.carrierId).toBeTruthy();
    const result = assignOutboundCarrier(snap, "out-02", "car-dhl");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.snap.outbound.find((o) => o.id === "out-02")!;
    expect(next.carrierId).toBe("car-dhl");
    expect(next.tracking).toMatch(/^DHL-/);
    expect(next.dockWindowStart).toBeTruthy();
    expect(trackingFor("SEUR", "OUT-SEV-8841")).toBe("SEUR-TSEV8841");
  });

  it("builds occupied demo slots like the seed layout helper", () => {
    const slots = generateSiteSlots("site-x", [{ zone: "seco", aisle: "A", racks: 2, levels: 2 }], {
      occupy: true,
    });
    expect(slots.some((s) => s.status === "ocupado")).toBe(true);
    expect(nextSiteCode(buildWmsSeed().sites, "Valencia")).toBe("CN-VAL-03");
  });
});
