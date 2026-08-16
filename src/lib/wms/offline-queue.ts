/**
 * Cola RF offline-first. No aplica stock inventado:
 * al volver la red, un `apply` externo decide; si choca, queda `conflict`.
 */

export const WMS_OFFLINE_QUEUE_KEY = "cn-wms-offline-q-v1";
export const WMS_DEVICE_ID_KEY = "cn-wms-device-id";

/** Id estable de este aparato. No se inventa un IMEI. */
export function localDeviceId(): string {
  try {
    const existing = localStorage.getItem(WMS_DEVICE_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `dev-${crypto.randomUUID()}`
        : `dev-${Date.now()}`;
    localStorage.setItem(WMS_DEVICE_ID_KEY, id);
    return id;
  } catch {
    return "dev-unknown";
  }
}

export function readOfflineQueue(): OfflineRfEvent[] {
  return readRaw();
}

export type OfflineEventKind = "confirm_pick" | "skip_pick" | "putaway" | "count";

export type OfflineEventStatus = "queued" | "synced" | "conflict";

export interface OfflineRfEvent {
  id: string;
  at: string;
  kind: OfflineEventKind;
  entity: string;
  entityId: string;
  payload: Record<string, unknown>;
  correlationId: string;
  status: OfflineEventStatus;
  conflictReason: string | null;
}

export type OfflineApplyResult = { ok: true } | { ok: false; reason: string };

function readRaw(): OfflineRfEvent[] {
  try {
    const raw = localStorage.getItem(WMS_OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineRfEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(rows: OfflineRfEvent[]): void {
  try {
    localStorage.setItem(WMS_OFFLINE_QUEUE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore quota */
  }
}

export function enqueueOfflineEvent(
  event: Omit<OfflineRfEvent, "status" | "conflictReason">,
  store: OfflineRfEvent[] = readRaw(),
): OfflineRfEvent[] {
  const next = [{ ...event, status: "queued" as const, conflictReason: null }, ...store];
  writeRaw(next);
  return next;
}

export function pendingOfflineEvents(store: OfflineRfEvent[] = readRaw()): OfflineRfEvent[] {
  return store.filter((e) => e.status === "queued");
}

/**
 * Sincroniza en orden (más antiguo primero).
 * Conflicto = el apply rechaza (hueco/SSCC/qty ya no cuadran). No se inventa el stock.
 */
export function syncOfflineQueue(
  store: OfflineRfEvent[],
  apply: (event: OfflineRfEvent) => OfflineApplyResult,
  online: boolean,
): OfflineRfEvent[] {
  if (!online) return store;
  const queued = store.filter((e) => e.status === "queued").slice().reverse();
  const done = new Map<string, OfflineRfEvent>();
  for (const event of queued) {
    const result = apply(event);
    done.set(
      event.id,
      result.ok
        ? { ...event, status: "synced", conflictReason: null }
        : { ...event, status: "conflict", conflictReason: result.reason },
    );
  }
  const next = store.map((e) => done.get(e.id) ?? e);
  writeRaw(next);
  return next;
}
