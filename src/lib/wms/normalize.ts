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
  return { ...pallet, asnId: pallet.asnId ?? null };
}

function normalizeWave(wave: PickWave): PickWave {
  return {
    ...wave,
    lines: wave.lines.map((l) => ({
      ...l,
      qtyPacked: l.qtyPacked ?? 0,
      cartonSscc: l.cartonSscc ?? null,
    })),
  };
}

/** Completa campos de v7→v8 sin inventar telemetría ni identidades. */
export function normalizeWmsSnapshot(snap: WmsSnapshot): WmsSnapshot {
  return {
    ...snap,
    categories: snap.categories?.length ? snap.categories : SYSTEM_CATEGORIES,
    chargers: Array.isArray(snap.chargers) ? snap.chargers : [],
    clockPunches: Array.isArray(snap.clockPunches) ? snap.clockPunches : [],
    fleet: (snap.fleet ?? []).map(normalizeFleet),
    pallets: (snap.pallets ?? []).map(normalizePallet),
    pickWaves: (snap.pickWaves ?? []).map(normalizeWave),
    operators: ensureShiftRoster((snap.operators ?? []).map(normalizeOperator), ROSTER_PRIMARY_SITE),
  };
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
