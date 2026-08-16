import { correlationId, wmsUid } from "./ids";
import type { WmsAuditLog, WmsSnapshot } from "./types";

export function auditLogsOf(snap: WmsSnapshot): WmsAuditLog[] {
  return snap.auditLogs ?? [];
}

/** Append-only. Nunca reescribe una fila existente. */
export function appendAudit(
  snap: WmsSnapshot,
  input: {
    at?: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    correlationId?: string;
    before?: string | null;
    after?: string | null;
  },
): WmsSnapshot {
  const row: WmsAuditLog = {
    id: wmsUid("aud"),
    at: input.at ?? "2026-08-15T12:00:00.000Z",
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    correlationId: input.correlationId ?? correlationId(),
    before: input.before ?? null,
    after: input.after ?? null,
  };
  return { ...snap, auditLogs: [row, ...auditLogsOf(snap)] };
}

export function auditForEntity(snap: WmsSnapshot, entityType: string, entityId: string): WmsAuditLog[] {
  return auditLogsOf(snap).filter((a) => a.entityType === entityType && a.entityId === entityId);
}

export function auditForOrg(snap: WmsSnapshot, orgId: string): WmsAuditLog[] {
  if (snap.org.id !== orgId) return [];
  return auditLogsOf(snap);
}
