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

import { buildWmsSeed } from "./seed";
import { WMS_STORAGE_KEY, type WmsSnapshot } from "./types";

export function loadWmsSnapshot(): WmsSnapshot {
  try {
    const raw = localStorage.getItem(WMS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WmsSnapshot;
      if (
        parsed?.sites?.length &&
        parsed?.slots?.length &&
        parsed.slots[0] &&
        "position" in parsed.slots[0] &&
        Array.isArray(parsed.pickWaves) &&
        parsed.org?.id &&
        Array.isArray(parsed.carriers)
      ) {
        return parsed;
      }
    }
  } catch {
    /* fall through */
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
