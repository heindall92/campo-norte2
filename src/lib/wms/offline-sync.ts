import { wmsUid } from "./ids";
import { confirmRfTask, type RfConfirmError, type RfSession } from "./rf";
import type { RfOutboxItem, WmsSnapshot } from "./types";
import { appendAudit } from "./audit";

export type OfflineResult =
  | { ok: true; snap: WmsSnapshot; queued: boolean }
  | { ok: false; error: RfConfirmError | "duplicate" };

function outboxOf(snap: WmsSnapshot): RfOutboxItem[] {
  return snap.rfOutbox ?? [];
}

/** Encola un comando RF. Misma idempotency_key = no-op (no duplica). */
export function enqueueRfCommand(
  snap: WmsSnapshot,
  session: RfSession,
  idempotencyKey: string,
  at = "2026-08-15T10:00:00.000Z",
): OfflineResult {
  const existing = outboxOf(snap).find((i) => i.idempotencyKey === idempotencyKey);
  if (existing) return { ok: true, snap, queued: false };
  const item: RfOutboxItem = {
    id: wmsUid("obx"),
    idempotencyKey,
    taskId: session.task.id,
    kind: session.task.kind,
    payload: {
      from: session.fromCode,
      sscc: session.sscc,
      to: session.toCode,
      qty: session.qty,
      waveId: session.task.waveId ?? null,
      lineId: session.task.lineId ?? null,
    },
    status: "pending",
    queuedAt: at,
    flushedAt: null,
    conflictReason: null,
  };
  return { ok: true, queued: true, snap: { ...snap, rfOutbox: [item, ...outboxOf(snap)] } };
}

/**
 * Aplica la cola. Si el servidor rechaza (task_stale), gana el servidor:
 * el snapshot no cambia y el item queda en conflict.
 */
export function flushRfOutbox(
  snap: WmsSnapshot,
  sessionFor: (item: RfOutboxItem) => RfSession | null,
  operatorId: string | null,
  online: boolean,
  at = "2026-08-15T10:05:00.000Z",
): { snap: WmsSnapshot; flushed: number; conflicts: number } {
  if (!online) return { snap, flushed: 0, conflicts: 0 };
  let next = snap;
  let flushed = 0;
  let conflicts = 0;
  const items = outboxOf(next).filter((i) => i.status === "pending");
  for (const item of items) {
    const session = sessionFor(item);
    if (!session) {
      next = {
        ...next,
        rfOutbox: outboxOf(next).map((i) =>
          i.id === item.id ? { ...i, status: "conflict" as const, conflictReason: "task_stale" } : i,
        ),
      };
      conflicts += 1;
      continue;
    }
    const result = confirmRfTask(next, session, operatorId);
    if (!result.ok) {
      next = {
        ...next,
        rfOutbox: outboxOf(next).map((i) =>
          i.id === item.id
            ? { ...i, status: "conflict" as const, conflictReason: result.error }
            : i,
        ),
      };
      conflicts += 1;
      continue;
    }
    next = {
      ...result.snap,
      rfOutbox: outboxOf(result.snap).map((i) =>
        i.id === item.id ? { ...i, status: "flushed" as const, flushedAt: at } : i,
      ),
    };
    flushed += 1;
  }
  if (flushed || conflicts) {
    next = appendAudit(next, {
      at,
      actorId: operatorId,
      action: "rf.flush",
      entityType: "rf_outbox",
      entityId: "batch",
      after: `${flushed}/${conflicts}`,
    });
  }
  return { snap: next, flushed, conflicts };
}

export function confirmRfTaskOrQueue(
  snap: WmsSnapshot,
  session: RfSession,
  operatorId: string | null,
  opts: { online: boolean; idempotencyKey: string; at?: string },
): OfflineResult {
  if (!opts.online) return enqueueRfCommand(snap, session, opts.idempotencyKey, opts.at);
  const queued = enqueueRfCommand(snap, session, opts.idempotencyKey, opts.at);
  if (!queued.ok) return queued;
  const flushed = flushRfOutbox(
    queued.snap,
    (item) => (item.idempotencyKey === opts.idempotencyKey ? session : null),
    operatorId,
    true,
    opts.at,
  );
  return { ok: true, snap: flushed.snap, queued: false };
}
