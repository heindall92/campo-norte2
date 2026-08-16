import type { WmsAuditLog, WmsSnapshot } from "./types";

export type AuditInput = Omit<WmsAuditLog, "id" | "organizationId" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};

/** Añade un log. No existe `deleteAuditLog` — la UI no puede borrar auditoría. */
export function appendAuditLog(snap: WmsSnapshot, input: AuditInput): WmsSnapshot {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const row: WmsAuditLog = {
    id: input.id ?? `aud-${timestamp}-${input.entityId}`,
    actorId: input.actorId,
    organizationId: snap.org.id,
    warehouseId: input.warehouseId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    beforeData: input.beforeData,
    afterData: input.afterData,
    timestamp,
    reason: input.reason,
    deviceId: input.deviceId,
    correlationId: input.correlationId,
  };
  return { ...snap, auditLogs: [row, ...(snap.auditLogs ?? [])] };
}

export function listAuditLogs(snap: WmsSnapshot, siteId?: string, limit = 40): WmsAuditLog[] {
  const rows = snap.auditLogs ?? [];
  const filtered = siteId ? rows.filter((r) => !r.warehouseId || r.warehouseId === siteId) : rows;
  return filtered.slice(0, limit);
}
