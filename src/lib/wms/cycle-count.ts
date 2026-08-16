import { WMS_DEMO_NOW } from "./alerts";
import { appendAuditLog } from "./audit";
import { applyTxToSnapshot, locationOfPallet } from "./inventory-core";
import { codesEqual } from "./location";
import { trimHoldsToQty } from "./reservations";
import type {
  CountLine,
  CountSession,
  CountSessionKind,
  Slot,
  WmsSnapshot,
} from "./types";

export type CycleCountTask = {
  id: string;
  slotId: string;
  palletId: string;
  skuId: string;
  siteId: string;
  reason: "caducidad" | "abc_a" | "antiguo" | "frio";
  expectedQty: number;
  lastCountedAt: string | null;
  score: number;
};

export type CycleCountError = "task_missing" | "wrong_slot" | "wrong_sscc" | "invalid_qty";

export type CountSessionError =
  | CycleCountError
  | "session_missing"
  | "line_missing"
  | "line_done"
  | "filter_required"
  | "no_lines"
  | "session_closed"
  | "site_missing";

export type CycleCountResult =
  | { ok: true; snap: WmsSnapshot; variance: number }
  | { ok: false; error: CycleCountError };

export type CountSessionResult =
  | { ok: true; snap: WmsSnapshot; sessionId: string; variance?: number }
  | { ok: false; error: CountSessionError };

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function planCycleCounts(
  snap: WmsSnapshot,
  opts: { siteId?: string; now?: Date; limit?: number } = {},
): CycleCountTask[] {
  const now = opts.now ?? new Date(WMS_DEMO_NOW);
  const nowMs = now.getTime();
  const skuMap = new Map(snap.skus.map((s) => [s.id, s]));
  const palletMap = new Map(snap.pallets.map((p) => [p.id, p]));
  const tasks: CycleCountTask[] = [];

  for (const slot of snap.slots) {
    if (opts.siteId && slot.siteId !== opts.siteId) continue;
    if (!slot.palletId || slot.status === "bloqueado") continue;
    const pallet = palletMap.get(slot.palletId);
    if (!pallet || pallet.status === "expedido") continue;
    const sku = skuMap.get(pallet.skuId);
    let score = 0;
    let reason: CycleCountTask["reason"] = "antiguo";
    if (pallet.expiry && new Date(pallet.expiry).getTime() - nowMs <= STALE_MS) {
      score += 100;
      reason = "caducidad";
    }
    if (sku?.abc === "A") {
      score += 50;
      if (reason === "antiguo") reason = "abc_a";
    }
    if (slot.zone === "fresco" || slot.zone === "congelado") {
      score += 20;
      if (reason === "antiguo") reason = "frio";
    }
    const last = slot.lastCountedAt ? new Date(slot.lastCountedAt).getTime() : 0;
    if (!last || nowMs - last >= STALE_MS) {
      score += 30;
    }
    if (score < 30) continue;
    tasks.push({
      id: `cc-${slot.id}`,
      slotId: slot.id,
      palletId: pallet.id,
      skuId: pallet.skuId,
      siteId: slot.siteId,
      reason,
      expectedQty: pallet.qty,
      lastCountedAt: slot.lastCountedAt,
      score,
    });
  }

  return tasks.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 12);
}

function occupiedCountTasks(
  snap: WmsSnapshot,
  siteId: string,
  match: (slot: Slot, pallet: NonNullable<WmsSnapshot["pallets"][number]>) => boolean,
): CycleCountTask[] {
  const ranked = planCycleCounts(snap, { siteId, limit: 200 });
  const bySlot = new Map(ranked.map((t) => [t.slotId, t]));
  const extra: CycleCountTask[] = [];
  for (const slot of snap.slots) {
    if (slot.siteId !== siteId || !slot.palletId || slot.status === "bloqueado") continue;
    const pallet = snap.pallets.find((p) => p.id === slot.palletId);
    if (!pallet || pallet.status === "expedido") continue;
    if (!match(slot, pallet)) continue;
    const known = bySlot.get(slot.id);
    extra.push(
      known ?? {
        id: `cc-${slot.id}`,
        slotId: slot.id,
        palletId: pallet.id,
        skuId: pallet.skuId,
        siteId: slot.siteId,
        reason: "antiguo",
        expectedQty: pallet.qty,
        lastCountedAt: slot.lastCountedAt,
        score: 0,
      },
    );
  }
  return extra;
}

export function confirmCycleCount(
  snap: WmsSnapshot,
  task: CycleCountTask,
  input: { slotCode: string; sscc: string; qty: number; operatorId?: string | null },
  at = WMS_DEMO_NOW,
): CycleCountResult {
  const slot = snap.slots.find((s) => s.id === task.slotId) as Slot | undefined;
  const pallet = snap.pallets.find((p) => p.id === task.palletId);
  if (!slot || !pallet) return { ok: false, error: "task_missing" };
  if (!codesEqual(slot.code, input.slotCode)) return { ok: false, error: "wrong_slot" };
  if (input.sscc.trim() !== pallet.sscc) return { ok: false, error: "wrong_sscc" };
  if (!Number.isFinite(input.qty) || input.qty < 0) return { ok: false, error: "invalid_qty" };

  const variance = input.qty - pallet.qty;
  let working = input.qty < pallet.qty ? trimHoldsToQty(snap, pallet.id, input.qty) : snap;
  const nextSlots = working.slots.map((s) =>
    s.id === slot.id ? { ...s, lastCountedAt: at, status: s.status === "inventario" ? "ocupado" : s.status } : s,
  );
  const nextPallets = working.pallets.map((p) => (p.id === pallet.id ? { ...p, qty: input.qty } : p));
  let physical: WmsSnapshot = {
    ...working,
    slots: nextSlots,
    pallets: nextPallets,
    movements: [
      {
        id: `mv-cc-${slot.id}-${at}`,
        at,
        type: variance === 0 ? "inventario" : "ajuste",
        skuId: pallet.skuId,
        palletId: pallet.id,
        fromSlotId: slot.id,
        toSlotId: slot.id,
        qty: variance,
        operatorId: input.operatorId ?? null,
        fleetId: null,
        note: variance === 0 ? `Conteo OK ${slot.code}` : `Merma/ajuste ${variance} · ${slot.code}`,
      },
      ...working.movements,
    ],
  };
  if (variance !== 0) {
    physical = appendAuditLog(physical, {
      actorId: input.operatorId ?? null,
      warehouseId: slot.siteId,
      action: "cycle_count_adjust",
      entity: "pallet",
      entityId: pallet.id,
      beforeData: { qty: pallet.qty },
      afterData: { qty: input.qty, variance },
      reason: `conteo ${slot.code}`,
      deviceId: null,
      correlationId: task.id,
      timestamp: at,
    });
  }
  const led = applyTxToSnapshot(physical, {
    type: "COUNT",
    skuId: pallet.skuId,
    lot: pallet.lot || null,
    fromLocationId: locationOfPallet(pallet),
    qty: 0,
    countedQty: input.qty,
    reason: variance === 0 ? `Conteo OK ${slot.code}` : `Conteo ${variance} · ${slot.code}`,
    refType: "cycle_count",
    refId: task.id,
    palletId: pallet.id,
    actorId: input.operatorId ?? null,
    at,
    id: `itx-COUNT-${slot.id}-${at}`,
  });
  if (!led.ok) return { ok: false, error: "invalid_qty" };
  return { ok: true, variance, snap: led.snap };
}

function tasksForKind(
  snap: WmsSnapshot,
  input: {
    warehouseId: string;
    kind: CountSessionKind;
    skuId?: string | null;
    lot?: string | null;
    slotId?: string | null;
    abc?: "A" | "B" | "C" | null;
    full?: boolean;
    limit?: number;
  },
): CycleCountTask[] | { error: CountSessionError } {
  const site = snap.sites.find((s) => s.id === input.warehouseId);
  if (!site) return { error: "site_missing" };

  if (input.kind === "slot") {
    if (!input.slotId) return { error: "filter_required" };
    const rows = occupiedCountTasks(snap, input.warehouseId, (slot) => slot.id === input.slotId);
    return rows.length ? rows : { error: "no_lines" };
  }
  if (input.kind === "sku") {
    if (!input.skuId) return { error: "filter_required" };
    const rows = occupiedCountTasks(snap, input.warehouseId, (_s, p) => p.skuId === input.skuId);
    return rows.length ? rows : { error: "no_lines" };
  }
  if (input.kind === "lot") {
    const lot = input.lot?.trim();
    if (!lot) return { error: "filter_required" };
    const rows = occupiedCountTasks(snap, input.warehouseId, (_s, p) => p.lot === lot);
    return rows.length ? rows : { error: "no_lines" };
  }
  if (input.kind === "abc") {
    const abc = input.abc ?? "A";
    const rows = occupiedCountTasks(snap, input.warehouseId, (_s, p) => snap.skus.find((k) => k.id === p.skuId)?.abc === abc);
    return rows.length ? rows.slice(0, input.limit ?? 12) : { error: "no_lines" };
  }
  if (input.full) {
    const rows = occupiedCountTasks(snap, input.warehouseId, () => true);
    return rows.length ? rows : { error: "no_lines" };
  }
  const planned = planCycleCounts(snap, { siteId: input.warehouseId, limit: input.limit ?? 12 });
  return planned.length ? planned : { error: "no_lines" };
}

export function openCountSession(
  snap: WmsSnapshot,
  input: {
    warehouseId: string;
    kind: CountSessionKind;
    operatorId?: string | null;
    skuId?: string | null;
    lot?: string | null;
    slotId?: string | null;
    abc?: "A" | "B" | "C" | null;
    full?: boolean;
    limit?: number;
    at?: string;
  },
): CountSessionResult {
  const existing = (snap.countSessions ?? []).find(
    (s) => s.status === "open" && s.warehouseId === input.warehouseId,
  );
  if (existing) return { ok: true, snap, sessionId: existing.id };

  const tasks = tasksForKind(snap, input);
  if ("error" in tasks) return { ok: false, error: tasks.error };

  const at = input.at ?? WMS_DEMO_NOW;
  const sessionId = uid("cnt");
  const session: CountSession = {
    id: sessionId,
    orgId: snap.org.id,
    warehouseId: input.warehouseId,
    kind: input.kind,
    status: "open",
    openedAt: at,
    closedAt: null,
    operatorId: input.operatorId ?? null,
    skuId: input.skuId ?? null,
    lot: input.lot ?? null,
    slotId: input.slotId ?? null,
    abc: input.kind === "abc" ? (input.abc ?? "A") : null,
    full: input.full === true,
  };
  const lines: CountLine[] = tasks.map((t, i) => ({
    id: `${sessionId}-l${i + 1}`,
    sessionId,
    slotId: t.slotId,
    palletId: t.palletId,
    skuId: t.skuId,
    expectedQty: t.expectedQty,
    countedQty: null,
    variance: null,
    status: "pending",
    taskReason: t.reason,
  }));

  return {
    ok: true,
    sessionId,
    snap: {
      ...snap,
      countSessions: [session, ...(snap.countSessions ?? [])],
      countLines: [...lines, ...(snap.countLines ?? [])],
    },
  };
}

function lineTask(snap: WmsSnapshot, session: CountSession, line: CountLine): CycleCountTask {
  const slot = snap.slots.find((s) => s.id === line.slotId);
  return {
    id: line.id,
    slotId: line.slotId,
    palletId: line.palletId,
    skuId: line.skuId,
    siteId: session.warehouseId,
    reason: line.taskReason,
    expectedQty: line.expectedQty,
    lastCountedAt: slot?.lastCountedAt ?? null,
    score: 0,
  };
}

export function confirmCountSessionLine(
  snap: WmsSnapshot,
  sessionId: string,
  lineId: string,
  input: { slotCode: string; sscc: string; qty: number; operatorId?: string | null },
  at = WMS_DEMO_NOW,
): CountSessionResult {
  const session = (snap.countSessions ?? []).find((s) => s.id === sessionId);
  if (!session) return { ok: false, error: "session_missing" };
  if (session.status !== "open") return { ok: false, error: "session_closed" };
  const line = (snap.countLines ?? []).find((l) => l.id === lineId && l.sessionId === sessionId);
  if (!line) return { ok: false, error: "line_missing" };
  if (line.status !== "pending") return { ok: false, error: "line_done" };

  const counted = confirmCycleCount(snap, lineTask(snap, session, line), input, at);
  if (!counted.ok) return counted;
  return {
    ok: true,
    sessionId,
    variance: counted.variance,
    snap: {
      ...counted.snap,
      countLines: (counted.snap.countLines ?? []).map((l) =>
        l.id === line.id
          ? { ...l, status: "counted" as const, countedQty: input.qty, variance: counted.variance }
          : l,
      ),
    },
  };
}

export function skipCountSessionLine(snap: WmsSnapshot, sessionId: string, lineId: string): CountSessionResult {
  const session = (snap.countSessions ?? []).find((s) => s.id === sessionId);
  if (!session) return { ok: false, error: "session_missing" };
  if (session.status !== "open") return { ok: false, error: "session_closed" };
  const line = (snap.countLines ?? []).find((l) => l.id === lineId && l.sessionId === sessionId);
  if (!line) return { ok: false, error: "line_missing" };
  if (line.status !== "pending") return { ok: false, error: "line_done" };
  return {
    ok: true,
    sessionId,
    snap: {
      ...snap,
      countLines: (snap.countLines ?? []).map((l) => (l.id === line.id ? { ...l, status: "skipped" as const } : l)),
    },
  };
}

export function closeCountSession(snap: WmsSnapshot, sessionId: string, at = WMS_DEMO_NOW): CountSessionResult {
  const session = (snap.countSessions ?? []).find((s) => s.id === sessionId);
  if (!session) return { ok: false, error: "session_missing" };
  if (session.status !== "open") return { ok: true, snap, sessionId };
  const pending = (snap.countLines ?? []).filter((l) => l.sessionId === sessionId && l.status === "pending");
  let next = snap;
  for (const line of pending) {
    const skipped = skipCountSessionLine(next, sessionId, line.id);
    if (skipped.ok) next = skipped.snap;
  }
  return {
    ok: true,
    sessionId,
    snap: {
      ...next,
      countSessions: (next.countSessions ?? []).map((s) =>
        s.id === sessionId ? { ...s, status: "closed" as const, closedAt: at } : s,
      ),
    },
  };
}

export function openCountSessionForSite(snap: WmsSnapshot, warehouseId: string): CountSession | undefined {
  return (snap.countSessions ?? []).find((s) => s.status === "open" && s.warehouseId === warehouseId);
}

export function linesForSession(snap: WmsSnapshot, sessionId: string): CountLine[] {
  return (snap.countLines ?? []).filter((l) => l.sessionId === sessionId);
}
