import type { WmsOrg, WmsSnapshot } from "./types";

export const CAMPO_NORTE_ORG: WmsOrg = {
  id: "org-camponorte",
  legalName: "Campo Norte Logística, S.L.",
  plan: "WMS OS · multi-hub",
  billingCurrency: "EUR",
  rlsMode: "snapshot",
};

/** Filtra el snapshot al tenant. En demo hay un org; el contrato es el de RLS. */
export function scopeSnapshotToOrg(snap: WmsSnapshot, orgId: string): WmsSnapshot {
  const sites = snap.sites.filter((s) => s.orgId === orgId);
  const siteIds = new Set(sites.map((s) => s.id));
  return {
    ...snap,
    org: snap.org.id === orgId ? snap.org : { ...snap.org, id: orgId },
    sites,
    slots: snap.slots.filter((s) => siteIds.has(s.siteId)),
    pallets: snap.pallets.filter((p) => siteIds.has(p.siteId)),
    fleet: snap.fleet.filter((f) => siteIds.has(f.siteId)),
    operators: snap.operators.filter((o) => siteIds.has(o.siteId)),
    inbound: snap.inbound.filter((i) => siteIds.has(i.siteId)),
    outbound: snap.outbound.filter((o) => siteIds.has(o.siteId)),
    costs: snap.costs.filter((c) => siteIds.has(c.siteId)),
    pickWaves: snap.pickWaves.filter((w) => siteIds.has(w.siteId)),
    carriers: snap.carriers.filter((c) => c.orgId === orgId),
    movements: snap.movements.filter((m) => {
      const slotId = m.toSlotId ?? m.fromSlotId;
      if (!slotId) return true;
      const slot = snap.slots.find((s) => s.id === slotId);
      return !slot || siteIds.has(slot.siteId);
    }),
  };
}

export function belongsToOrg(snap: WmsSnapshot, siteId: string, orgId = snap.org.id): boolean {
  return snap.sites.some((s) => s.id === siteId && s.orgId === orgId);
}
