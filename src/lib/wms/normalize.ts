import { hydrateInventoryIfMissing } from "./inventory-core";
import { seedMemberships } from "./tenant";
import { ensureShiftRoster, normalizeOperator, ROSTER_PRIMARY_SITE } from "./roster";
import { SYSTEM_CATEGORIES, type FleetUnit, type Pallet, type PickWave, type WmsSnapshot } from "./types";

function normalizeFleet(unit: FleetUnit): FleetUnit {
  return {
    ...unit,
    batteryPct: typeof unit.batteryPct === "number" ? unit.batteryPct : null,
    batterySource: unit.batterySource ?? (typeof unit.batteryPct === "number" ? "seed" : "unknown"),
    batteryReportedAt: unit.batteryReportedAt ?? null,
    chargerId: unit.chargerId ?? null,
  };
}

function normalizePallet(pallet: Pallet): Pallet {
  return { ...pallet, asnId: pallet.asnId ?? null, qcStatus: pallet.qcStatus ?? "APPROVED" };
}

function normalizeWave(wave: PickWave): PickWave {
  return {
    ...wave,
    lines: wave.lines.map((l) => ({
      ...l,
      qtyPacked: l.qtyPacked ?? 0,
      cartonSscc: l.cartonSscc ?? null,
      pickPack: l.pickPack === "contenedor" ? "contenedor" : "caja",
    })),
  };
}

/** Completa campos de v7→v8 sin inventar telemetría ni identidades. */
export function normalizeWmsSnapshot(snap: WmsSnapshot): WmsSnapshot {
  const base: WmsSnapshot = {
    ...snap,
    categories: snap.categories?.length ? snap.categories : SYSTEM_CATEGORIES,
    chargers: Array.isArray(snap.chargers) ? snap.chargers : [],
    clockPunches: Array.isArray(snap.clockPunches) ? snap.clockPunches : [],
    fleet: (snap.fleet ?? []).map(normalizeFleet),
    pallets: (snap.pallets ?? []).map(normalizePallet),
    pickWaves: (snap.pickWaves ?? []).map(normalizeWave),
    operators: ensureShiftRoster((snap.operators ?? []).map(normalizeOperator), ROSTER_PRIMARY_SITE),
    loadUnits: Array.isArray(snap.loadUnits) ? snap.loadUnits : [],
    superAssignments: Array.isArray(snap.superAssignments)
      ? snap.superAssignments.map((a) => ({
          ...a,
          loadKind: a.loadKind ?? null,
          unitsMade: a.unitsMade ?? null,
          labelsPrinted: a.labelsPrinted ?? 0,
        }))
      : [],
    mermaEvents: Array.isArray(snap.mermaEvents) ? snap.mermaEvents : [],
    slotFixes: Array.isArray(snap.slotFixes) ? snap.slotFixes : [],
    auditLogs: Array.isArray(snap.auditLogs) ? snap.auditLogs : [],
    reservations: Array.isArray(snap.reservations) ? snap.reservations : [],
    asnLines: Array.isArray(snap.asnLines) ? snap.asnLines : [],
    asnIncidents: Array.isArray(snap.asnIncidents) ? snap.asnIncidents : [],
    slottingRules: Array.isArray(snap.slottingRules) ? snap.slottingRules : [],
    slottingRecommendations: Array.isArray(snap.slottingRecommendations) ? snap.slottingRecommendations : [],
    countSessions: Array.isArray(snap.countSessions) ? snap.countSessions : [],
    countLines: Array.isArray(snap.countLines) ? snap.countLines : [],
    org: {
      ...snap.org,
      allowNegativeInventory: snap.org.allowNegativeInventory === true,
    },
    ledgerRevision: typeof snap.ledgerRevision === "number" ? snap.ledgerRevision : 0,
    memberships: Array.isArray(snap.memberships) && snap.memberships.length
      ? snap.memberships
      : seedMemberships(snap.org.id),
  };
  return hydrateInventoryIfMissing(base);
}

export function snapshotLooksUsable(parsed: Partial<WmsSnapshot> | null | undefined): parsed is WmsSnapshot {
  return Boolean(
    parsed?.sites?.length &&
      parsed.slots?.length &&
      parsed.slots[0] &&
      "position" in parsed.slots[0] &&
      Array.isArray(parsed.pickWaves) &&
      parsed.org?.id &&
      Array.isArray(parsed.carriers) &&
      typeof parsed.seededFromDemo === "boolean",
  );
}
