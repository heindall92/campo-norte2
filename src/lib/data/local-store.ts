import { normalizePaymentChannel } from "@/lib/demo-data";
import { buildSeedSnapshot } from "./seed";
import {
  HUB_VERSION,
  LOCAL_STORAGE_KEY,
  type DataStore,
  type HubSnapshot,
} from "./types";

function scrubBizum(snapshot: HubSnapshot): HubSnapshot {
  return {
    ...snapshot,
    clients: snapshot.clients.map((c) => ({
      ...c,
      paymentMethod: normalizePaymentChannel(c.paymentMethod),
    })),
    reservations: snapshot.reservations.map((r) => ({
      ...r,
      paymentChannel: normalizePaymentChannel(r.paymentChannel),
    })),
    invoices: snapshot.invoices.map((inv) => ({
      ...inv,
      paymentChannel: normalizePaymentChannel(inv.paymentChannel),
    })),
  };
}

function isValidSnapshot(value: unknown): value is HubSnapshot {
  if (!value || typeof value !== "object") return false;
  const s = value as HubSnapshot;
  return (
    Array.isArray(s.leads) &&
    Array.isArray(s.clients) &&
    Array.isArray(s.reservations) &&
    Array.isArray(s.invoices) &&
    !!s.meta
  );
}

export class LocalDataStore implements DataStore {
  mode = "local" as const;

  isConfigured() {
    return typeof localStorage !== "undefined";
  }

  async load(): Promise<HubSnapshot> {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        const seed = buildSeedSnapshot("local");
        await this.save(seed);
        return seed;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isValidSnapshot(parsed)) {
        const seed = buildSeedSnapshot("local");
        await this.save(seed);
        return seed;
      }
      return scrubBizum({
        ...parsed,
        meta: {
          ...parsed.meta,
          version: HUB_VERSION,
          mode: "local",
        },
      });
    } catch {
      const seed = buildSeedSnapshot("local");
      await this.save(seed);
      return seed;
    }
  }

  async save(snapshot: HubSnapshot): Promise<void> {
    const next: HubSnapshot = {
      ...snapshot,
      meta: {
        ...snapshot.meta,
        version: HUB_VERSION,
        mode: "local",
        updatedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
      },
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  }
}
