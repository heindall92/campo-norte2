import type { WmsOrg, WmsSnapshot } from "./types";

export const CAMPO_NORTE_ORG: WmsOrg = {
  id: "org-camponorte",
  legalName: "Campo Norte Logística, S.L.",
  plan: "WMS OS · multi-hub",
  billingCurrency: "EUR",
  rlsMode: "snapshot",
  allowNegativeInventory: false,
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
    chargers: snap.chargers.filter((c) => siteIds.has(c.siteId)),
    operators: snap.operators.filter((o) => siteIds.has(o.siteId)),
    clockPunches: snap.clockPunches.filter((p) => siteIds.has(p.siteId)),
    inbound: snap.inbound.filter((i) => siteIds.has(i.siteId)),
    asnLines: (snap.asnLines ?? []).filter((l) => {
      const asn = snap.inbound.find((a) => a.id === l.asnId);
      return asn ? siteIds.has(asn.siteId) : false;
    }),
    asnIncidents: (snap.asnIncidents ?? []).filter((i) => {
      const asn = snap.inbound.find((a) => a.id === i.asnId);
      return asn ? siteIds.has(asn.siteId) : false;
    }),
    outbound: snap.outbound.filter((o) => siteIds.has(o.siteId)),
    costs: snap.costs.filter((c) => siteIds.has(c.siteId)),
    pickWaves: snap.pickWaves.filter((w) => siteIds.has(w.siteId)),
    auditLogs: (snap.auditLogs ?? []).filter((a) => !a.warehouseId || siteIds.has(a.warehouseId)),
    reservations: (snap.reservations ?? []).filter((r) => siteIds.has(r.warehouseId)),
    products: (snap.products ?? []).filter((p) => p.orgId === orgId),
    productUoms: (snap.productUoms ?? []).filter((u) => u.orgId === orgId),
    lots: (snap.lots ?? []).filter((l) => l.orgId === orgId),
    serialNumbers: (snap.serialNumbers ?? []).filter((s) => s.orgId === orgId),
    inventoryBalances: (snap.inventoryBalances ?? []).filter((b) => b.orgId === orgId),
    inventoryReservations: (snap.inventoryReservations ?? []).filter((r) => r.orgId === orgId),
    inventoryTransactions: (snap.inventoryTransactions ?? []).filter((t) => t.orgId === orgId),
    inventoryAdjustments: (snap.inventoryAdjustments ?? []).filter((a) => a.orgId === orgId),
    inventoryCounts: (snap.inventoryCounts ?? []).filter((c) => c.orgId === orgId),
    countSessions: (snap.countSessions ?? []).filter((s) => s.orgId === orgId),
    countLines: (snap.countLines ?? []).filter((l) => {
      const session = (snap.countSessions ?? []).find((s) => s.id === l.sessionId);
      return !session || session.orgId === orgId;
    }),
    memberships: (snap.memberships ?? []).filter((m) => m.organizationId === orgId),
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

/** Aísla un centro. No inventa el otro hub. */
export function scopeSnapshotToWarehouse(snap: WmsSnapshot, siteId: string): WmsSnapshot {
  if (!belongsToOrg(snap, siteId)) {
    return scopeSnapshotToOrg({ ...snap, sites: [] }, snap.org.id);
  }
  const scoped = scopeSnapshotToOrg(snap, snap.org.id);
  const sites = scoped.sites.filter((s) => s.id === siteId);
  const siteIds = new Set(sites.map((s) => s.id));
  return {
    ...scoped,
    sites,
    slots: scoped.slots.filter((s) => siteIds.has(s.siteId)),
    pallets: scoped.pallets.filter((p) => siteIds.has(p.siteId)),
    fleet: scoped.fleet.filter((f) => siteIds.has(f.siteId)),
    chargers: scoped.chargers.filter((c) => siteIds.has(c.siteId)),
    operators: scoped.operators.filter((o) => siteIds.has(o.siteId)),
    clockPunches: scoped.clockPunches.filter((p) => siteIds.has(p.siteId)),
    inbound: scoped.inbound.filter((i) => siteIds.has(i.siteId)),
    asnLines: (scoped.asnLines ?? []).filter((l) => {
      const asn = scoped.inbound.find((a) => a.id === l.asnId);
      return asn ? siteIds.has(asn.siteId) : false;
    }),
    asnIncidents: (scoped.asnIncidents ?? []).filter((i) => {
      const asn = scoped.inbound.find((a) => a.id === i.asnId);
      return asn ? siteIds.has(asn.siteId) : false;
    }),
    outbound: scoped.outbound.filter((o) => siteIds.has(o.siteId)),
    costs: scoped.costs.filter((c) => siteIds.has(c.siteId)),
    pickWaves: scoped.pickWaves.filter((w) => siteIds.has(w.siteId)),
    auditLogs: scoped.auditLogs.filter((a) => !a.warehouseId || siteIds.has(a.warehouseId)),
    reservations: scoped.reservations.filter((r) => siteIds.has(r.warehouseId)),
    inventoryBalances: scoped.inventoryBalances.filter((b) => locationInSites(b.locationId, siteIds, scoped.slots)),
    inventoryReservations: scoped.inventoryReservations.filter((r) =>
      locationInSites(r.locationId, siteIds, scoped.slots),
    ),
    inventoryTransactions: scoped.inventoryTransactions.filter((t) => {
      const loc = t.fromLocationId ?? t.toLocationId;
      return !loc || locationInSites(loc, siteIds, scoped.slots);
    }),
    inventoryAdjustments: scoped.inventoryAdjustments.filter((a) =>
      locationInSites(a.locationId, siteIds, scoped.slots),
    ),
    inventoryCounts: scoped.inventoryCounts.filter((c) => locationInSites(c.locationId, siteIds, scoped.slots)),
    countSessions: (scoped.countSessions ?? []).filter((s) => siteIds.has(s.warehouseId)),
    countLines: (scoped.countLines ?? []).filter((l) => {
      const session = (scoped.countSessions ?? []).find((s) => s.id === l.sessionId);
      return !session || siteIds.has(session.warehouseId);
    }),
  };
}

function locationInSites(locationId: string, siteIds: Set<string>, slots: WmsSnapshot["slots"]): boolean {
  if (locationId.startsWith("SITE:")) return siteIds.has(locationId.slice(5));
  const slot = slots.find((s) => s.id === locationId);
  return !slot || siteIds.has(slot.siteId);
}
