import { buildWmsSeed } from "@/lib/wms/seed";
import { normalizeWmsSnapshot, snapshotLooksUsable } from "@/lib/wms/normalize";
import { WMS_STORAGE_KEY, WMS_STORAGE_KEY_LEGACY, type WmsSnapshot } from "@/lib/wms/types";
import type { WmsPort } from "./port";

export interface SyncStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DemoWmsPort extends WmsPort {
  reset(): WmsSnapshot;
}

export function createMemoryStorage(initial?: Record<string, string>): SyncStorage {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function browserStorage(): SyncStorage {
  return {
    getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* quota / private mode */
      }
    },
    removeItem(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export function createDemoWmsAdapter(storage: SyncStorage = browserStorage()): DemoWmsPort {
  function readOrSeed(): WmsSnapshot {
    const keys = [WMS_STORAGE_KEY, ...WMS_STORAGE_KEY_LEGACY];
    for (const key of keys) {
      const raw = storage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as WmsSnapshot;
        if (snapshotLooksUsable(parsed)) {
          const normalized = normalizeWmsSnapshot(parsed);
          storage.setItem(WMS_STORAGE_KEY, JSON.stringify(normalized));
          return normalized;
        }
      } catch {
        /* try next key */
      }
    }
    const seed = buildWmsSeed();
    storage.setItem(WMS_STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }

  return {
    peek: readOrSeed,
    async load(_orgId) {
      return readOrSeed();
    },
    async save(snap) {
      storage.setItem(WMS_STORAGE_KEY, JSON.stringify(snap));
    },
    reset() {
      const seed = buildWmsSeed();
      storage.setItem(WMS_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    },
  };
}

export const demoWmsAdapter = createDemoWmsAdapter();
