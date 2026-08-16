export * from "./types";
export * from "./seed";
export * from "./stats";
export * from "./location";
export * from "./picking";
export * from "./movements";
export * from "./cycle-count";
export * from "./alerts";
export * from "./economics";
export * from "./shifts";
export * from "./org";
export * from "./onboard";
export * from "./carriers";
export * from "./rf";
export * from "./roster";
export * from "./fingerprint";
export * from "./clock";
export * from "./priorities";
export * from "./catalog";
export * from "./normalize";
export * from "./jornada";
export * from "./waves";
export * from "./outbound";
export * from "./floor";
export * from "./merma";
export * from "./voice";
export * from "./slot-fix";
export * from "./uom";
export * from "./lots";
export * from "./order-state";
export * from "./audit";
export * from "./offline-queue";
export * from "./offline-apply";
export * from "./tower";
export * from "./reservations";
export * from "./returns";
export * from "./permissions";
export * from "./copilot";
export * from "./productivity";
export * from "./costs";
export * from "./alert-engine";
export * from "./inventory-core";
export * from "./rbac";
export * from "./tenant";
export * from "./persist";
export * from "./receiving";
export * from "./replenishment";
export * from "./packing";

import { buildWmsSeed } from "./seed";
import { normalizeWmsSnapshot, snapshotLooksUsable } from "./normalize";
import { WMS_STORAGE_KEY, WMS_STORAGE_KEY_LEGACY, type WmsSnapshot } from "./types";

function readStoredSnapshot(): WmsSnapshot | null {
  const keys = [WMS_STORAGE_KEY, ...WMS_STORAGE_KEY_LEGACY];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as WmsSnapshot;
      if (snapshotLooksUsable(parsed)) return normalizeWmsSnapshot(parsed);
    } catch {
      /* try next key */
    }
  }
  return null;
}

export function loadWmsSnapshot(): WmsSnapshot {
  const stored = readStoredSnapshot();
  if (stored) {
    try {
      localStorage.setItem(WMS_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      /* ignore */
    }
    return stored;
  }
  const seed = buildWmsSeed();
  try {
    localStorage.setItem(WMS_STORAGE_KEY, JSON.stringify(seed));
  } catch {
    /* ignore */
  }
  return seed;
}

export function saveWmsSnapshot(snap: WmsSnapshot): void {
  try {
    localStorage.setItem(WMS_STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

export function resetWmsSnapshot(): WmsSnapshot {
  const seed = buildWmsSeed();
  saveWmsSnapshot(seed);
  return seed;
}
