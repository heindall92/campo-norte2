import type { AppUser } from "@/lib/auth/types";
import { demoWmsAdapter } from "./demo-adapter";
import { canWriteWmsProduction, type WmsPort } from "./port";
import { postgresWmsAdapter } from "./postgres-adapter";

export type { WmsPort } from "./port";
export {
  WMS_PG_ORG_ID,
  WMS_SNAPSHOT_ORG_ID,
  canWriteWmsProduction,
  isDemoWmsEmail,
  toPostgresOrgId,
} from "./port";
export { createDemoWmsAdapter, createMemoryStorage, demoWmsAdapter } from "./demo-adapter";
export { postgresWmsAdapter, createPostgresWmsAdapter } from "./postgres-adapter";
export {
  overlayStock,
  productionBootstrapSnapshot,
  productionPlantSnapshot,
  stripStockForFloor,
  palletStockPayload,
  ledgerStockPayload,
  stockCommitBatches,
} from "./mapper";
export {
  getRfOutboxStore,
  createMemoryRfOutbox,
  mergeRfOutbox,
  setRfOutboxStoreForTests,
  type RfOutboxStore,
} from "./rf-idb";

let bound: WmsPort = demoWmsAdapter;

export function resolveWmsAdapter(user?: Pick<AppUser, "provider" | "email"> | null): WmsPort {
  if (canWriteWmsProduction(user)) return postgresWmsAdapter;
  return demoWmsAdapter;
}

export function bindWmsAdapter(port: WmsPort): void {
  bound = port;
}

export function currentWmsAdapter(): WmsPort {
  return bound;
}

export function loadWmsSnapshot() {
  return bound.peek();
}

export async function saveWmsSnapshot(
  snap: Parameters<WmsPort["save"]>[0],
  user?: Pick<AppUser, "provider" | "email" | "organizationId"> | null,
) {
  bound = resolveWmsAdapter(user);
  await bound.save(snap, user);
}

export function resetWmsSnapshot() {
  const seed = demoWmsAdapter.reset();
  bound = demoWmsAdapter;
  return seed;
}
