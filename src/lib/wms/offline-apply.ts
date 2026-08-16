import { appendAuditLog } from "./audit";
import type { OfflineRfEvent } from "./offline-queue";
import { buildRfQueue, confirmRfTask, type RfSession } from "./rf";
import type { WmsSnapshot } from "./types";

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asQty(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Aplica un evento RF encolado contra el snapshot actual.
 * Si el hueco/SSCC/línea ya no cuadran, conflicto — no se inventa stock.
 */
export function applyOfflineRfEvent(
  snap: WmsSnapshot,
  event: OfflineRfEvent,
  actorId: string | null = null,
): { ok: true; snap: WmsSnapshot } | { ok: false; reason: string } {
  const payload = event.payload;
  const siteId = typeof payload.siteId === "string" ? payload.siteId : undefined;
  const queue = buildRfQueue(snap, siteId);
  const taskId = asString(payload.taskId, "");
  const task =
    queue.find((t) => t.id === taskId) ??
    queue.find((t) => t.lineId === event.entityId) ??
    queue.find((t) => t.id === event.entityId) ??
    null;
  if (!task) return { ok: false, reason: "task_stale" };

  const session: RfSession = {
    task,
    fromCode: asString(payload.from, task.fromCode),
    sscc: asString(payload.sscc, task.sscc),
    toCode: asString(payload.to, task.toCode ?? ""),
    qty: asQty(payload.qty, task.qty),
    step: "ready",
  };

  const result = confirmRfTask(snap, session, actorId);
  if (!result.ok) return { ok: false, reason: result.error };

  return {
    ok: true,
    snap: appendAuditLog(result.snap, {
      actorId,
      warehouseId: task.siteId,
      action: "rf.confirm.sync",
      entity: event.entity,
      entityId: event.entityId,
      beforeData: { status: "queued" },
      afterData: { qty: session.qty, sscc: session.sscc },
      reason: "sync_offline_queue",
      deviceId: typeof payload.deviceId === "string" ? payload.deviceId : null,
      correlationId: event.correlationId,
    }),
  };
}
