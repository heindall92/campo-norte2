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
    chargers: snap.chargers.filter((c) => siteIds.has(c.siteId)),
    operators: snap.operators.filter((o) => siteIds.has(o.siteId)),
    clockPunches: snap.clockPunches.filter((p) => siteIds.has(p.siteId)),
    inbound: snap.inbound.filter((i) => siteIds.has(i.siteId)),
    outbound: snap.outbound.filter((o) => siteIds.has(o.siteId)),
    costs: snap.costs.filter((c) => siteIds.has(c.siteId)),
    pickWaves: snap.pickWaves.filter((w) => siteIds.has(w.siteId)),
    carriers: snap.carriers.filter((c) => c.orgId === orgId),
    ledger: (snap.ledger ?? []).filter((t) => {
      const pallet = t.palletId ? snap.pallets.find((p) => p.id === t.palletId) : undefined;
      return !pallet || siteIds.has(pallet.siteId);
    }),
    balances: (snap.balances ?? []).filter((b) => siteIds.has(b.siteId)),
    reservations: (snap.reservations ?? []).filter((r) => {
      const order = snap.outbound.find((o) => o.id === r.orderId);
      return !order || siteIds.has(order.siteId);
    }),
    orderLines: (snap.orderLines ?? []).filter((l) => {
      const order = snap.outbound.find((o) => o.id === l.orderId);
      return !order || siteIds.has(order.siteId);
    }),
    packages: (snap.packages ?? []).filter((p) => {
      const order = snap.outbound.find((o) => o.id === p.orderId);
      return !order || siteIds.has(order.siteId);
    }),
    dockAppointments: (snap.dockAppointments ?? []).filter((a) => siteIds.has(a.siteId)),
    yardVisits: (snap.yardVisits ?? []).filter((v) => siteIds.has(v.siteId)),
    returns: (snap.returns ?? []).filter((r) => siteIds.has(r.siteId)),
    auditLogs: snap.org.id === orgId ? snap.auditLogs ?? [] : [],
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
