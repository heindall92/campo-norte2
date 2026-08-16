import type { RfOutboxItem } from "@/lib/wms/types";

const DB_NAME = "cn-wms-rf-outbox";
const STORE = "commands";

export interface RfOutboxStore {
  put(item: RfOutboxItem): Promise<void>;
  list(): Promise<RfOutboxItem[]>;
  remove(idempotencyKey: string): Promise<void>;
  clear(): Promise<void>;
}

export function mergeRfOutbox(a: RfOutboxItem[] | undefined, b: RfOutboxItem[]): RfOutboxItem[] {
  const map = new Map<string, RfOutboxItem>();
  for (const item of a ?? []) map.set(item.idempotencyKey, item);
  for (const item of b) {
    const prev = map.get(item.idempotencyKey);
    if (!prev || item.queuedAt >= prev.queuedAt) map.set(item.idempotencyKey, item);
  }
  return [...map.values()].sort((x, y) => (x.queuedAt < y.queuedAt ? 1 : -1));
}

export function createMemoryRfOutbox(initial: RfOutboxItem[] = []): RfOutboxStore {
  const map = new Map<string, RfOutboxItem>(initial.map((i) => [i.idempotencyKey, i]));
  return {
    async put(item) {
      map.set(item.idempotencyKey, item);
    },
    async list() {
      return [...map.values()];
    },
    async remove(idempotencyKey) {
      map.delete(idempotencyKey);
    },
    async clear() {
      map.clear();
    },
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "idempotencyKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb_open_failed"));
  });
}

function createIndexedDbRfOutbox(): RfOutboxStore {
  return {
    async put(item) {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("idb_put_failed"));
      });
      db.close();
    },
    async list() {
      const db = await openDb();
      const rows = await new Promise<RfOutboxItem[]>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve((req.result as RfOutboxItem[]) ?? []);
        req.onerror = () => reject(req.error ?? new Error("idb_list_failed"));
      });
      db.close();
      return rows;
    },
    async remove(idempotencyKey) {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(idempotencyKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("idb_del_failed"));
      });
      db.close();
    },
    async clear() {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("idb_clear_failed"));
      });
      db.close();
    },
  };
}

let singleton: RfOutboxStore | null = null;

export function getRfOutboxStore(): RfOutboxStore {
  if (singleton) return singleton;
  singleton = typeof indexedDB === "undefined" ? createMemoryRfOutbox() : createIndexedDbRfOutbox();
  return singleton;
}

/** Tests: sustituye el store (p. ej. memoria). */
export function setRfOutboxStoreForTests(store: RfOutboxStore | null): void {
  singleton = store;
}
