import { parseSlotCode, formatSlotCode, codesEqual } from "./location";
import { confirmPick, nextOpenLine } from "./picking";
import {
  applyReplenishment,
  confirmPutaway,
  proposeReplenishments,
  type LiveMoveError,
} from "./movements";
import { confirmCycleCount, planCycleCounts, type CycleCountError, type CycleCountTask } from "./cycle-count";
import type { ConfirmPickError } from "./picking";
import type { Operator, WmsSnapshot } from "./types";

export type RfTaskKind = "pick" | "putaway" | "replenish" | "count";
export type RfStep = "from" | "sscc" | "to" | "qty" | "ready";
export type ScanKind = "slot" | "sscc" | "qty" | "unknown";

export interface RfTask {
  id: string;
  kind: RfTaskKind;
  siteId: string;
  fromCode: string;
  toCode: string | null;
  sscc: string;
  skuId: string;
  qty: number;
  waveId?: string;
  lineId?: string;
  countTask?: CycleCountTask;
  replenishId?: string;
  labelEs: string;
  labelEn: string;
}

export interface RfSession {
  task: RfTask;
  fromCode: string;
  sscc: string;
  toCode: string;
  qty: number | null;
  step: RfStep;
}

export type RfScanError = "unknown_scan" | "wrong_slot" | "wrong_sscc" | "wrong_dest" | "invalid_qty";
export type RfConfirmError = ConfirmPickError | LiveMoveError | CycleCountError | "scan_incomplete" | "task_stale";

export function classifyScan(raw: string): { kind: ScanKind; value: string } {
  const v = raw.trim();
  if (!v) return { kind: "unknown", value: v };
  const slot = parseSlotCode(v);
  if (slot) return { kind: "slot", value: formatSlotCode(slot) };
  const digits = v.replace(/\s/g, "");
  if (/^\d{10,}$/.test(digits)) return { kind: "sscc", value: digits };
  if (/^\d+$/.test(v)) return { kind: "qty", value: v };
  return { kind: "unknown", value: v };
}

export function stepsFor(kind: RfTaskKind): RfStep[] {
  if (kind === "putaway" || kind === "replenish") return ["from", "sscc", "to"];
  return ["from", "sscc", "qty"];
}

export function operatorForAppUser(
  snap: WmsSnapshot,
  user?: { name?: string | null } | null,
): Operator | null {
  const name = user?.name?.trim();
  if (!name) return null;
  return snap.operators.find((o) => o.active && o.name === name) ?? null;
}

/** Cola derivada del snapshot: no se inventan palets, huecos ni cantidades. */
export function buildRfQueue(snap: WmsSnapshot, siteId?: string, operatorId?: string | null): RfTask[] {
  const tasks: RfTask[] = [];
  const skuName = (id: string) => snap.skus.find((s) => s.id === id)?.name ?? id;

  for (const wave of snap.pickWaves) {
    if (siteId && wave.siteId !== siteId) continue;
    if (wave.status === "cerrada") continue;
    if (operatorId && wave.operatorId && wave.operatorId !== operatorId) continue;
    const line = nextOpenLine(wave);
    if (!line) continue;
    const slot = snap.slots.find((s) => s.id === line.slotId);
    const pallet = line.palletId ? snap.pallets.find((p) => p.id === line.palletId) : null;
    if (!slot || !pallet) continue;
    tasks.push({
      id: `pick-${wave.id}-${line.id}`,
      kind: "pick",
      siteId: wave.siteId,
      fromCode: slot.code,
      toCode: null,
      sscc: pallet.sscc,
      skuId: line.skuId,
      qty: line.qty,
      waveId: wave.id,
      lineId: line.id,
      labelEs: `Picar ${skuName(line.skuId)} · ${slot.code}`,
      labelEn: `Pick ${skuName(line.skuId)} · ${slot.code}`,
    });
  }

  for (const pallet of snap.pallets) {
    if (pallet.status !== "muelle") continue;
    if (siteId && pallet.siteId !== siteId) continue;
    const from = pallet.slotId ? snap.slots.find((s) => s.id === pallet.slotId) : null;
    const to = snap.slots.find(
      (s) => s.siteId === pallet.siteId && s.status === "libre" && s.zone !== "muelle" && !s.palletId,
    );
    if (!from || !to) continue;
    tasks.push({
      id: `put-${pallet.id}`,
      kind: "putaway",
      siteId: pallet.siteId,
      fromCode: from.code,
      toCode: to.code,
      sscc: pallet.sscc,
      skuId: pallet.skuId,
      qty: pallet.qty,
      labelEs: `Putaway ${skuName(pallet.skuId)} · ${from.code} → ${to.code}`,
      labelEn: `Putaway ${skuName(pallet.skuId)} · ${from.code} → ${to.code}`,
    });
  }

  const fleet = snap.fleet.find((f) => f.kind === "retractil_doble" && f.status === "operativa");
  for (const proposal of proposeReplenishments(snap)) {
    if (siteId && proposal.siteId !== siteId) continue;
    const from = snap.slots.find((s) => s.id === proposal.fromSlotId);
    const to = snap.slots.find((s) => s.id === proposal.toSlotId);
    const pallet = snap.pallets.find((p) => p.id === proposal.palletId);
    if (!from || !to || !pallet) continue;
    tasks.push({
      id: proposal.id,
      kind: "replenish",
      siteId: proposal.siteId,
      fromCode: from.code,
      toCode: to.code,
      sscc: pallet.sscc,
      skuId: proposal.skuId,
      qty: pallet.qty,
      replenishId: proposal.id,
      labelEs: `Reponer pick face ${to.code}${fleet ? ` · ${fleet.code}` : ""}`,
      labelEn: `Replenish pick face ${to.code}${fleet ? ` · ${fleet.code}` : ""}`,
    });
  }

  for (const count of planCycleCounts(snap, { siteId, limit: 4 })) {
    const slot = snap.slots.find((s) => s.id === count.slotId);
    const pallet = snap.pallets.find((p) => p.id === count.palletId);
    if (!slot || !pallet) continue;
    tasks.push({
      id: count.id,
      kind: "count",
      siteId: count.siteId,
      fromCode: slot.code,
      toCode: null,
      sscc: pallet.sscc,
      skuId: count.skuId,
      qty: count.expectedQty,
      countTask: count,
      labelEs: `Conteo ${slot.code} · esperado ${count.expectedQty}`,
      labelEn: `Count ${slot.code} · expected ${count.expectedQty}`,
    });
  }

  return tasks;
}

export function startRfSession(task: RfTask): RfSession {
  return {
    task,
    fromCode: "",
    sscc: "",
    toCode: "",
    qty: null,
    step: "from",
  };
}

function nextStep(task: RfTask, session: Omit<RfSession, "step">): RfStep {
  const order = stepsFor(task.kind);
  for (const step of order) {
    if (step === "from" && !session.fromCode) return "from";
    if (step === "sscc" && !session.sscc) return "sscc";
    if (step === "to" && !session.toCode) return "to";
    if (step === "qty" && session.qty == null) return "qty";
  }
  return "ready";
}

export function applyRfScan(
  session: RfSession,
  raw: string,
): { ok: true; session: RfSession } | { ok: false; error: RfScanError; session: RfSession } {
  if (session.step === "ready") return { ok: true, session };
  const scan = classifyScan(raw);
  if (scan.kind === "unknown") return { ok: false, error: "unknown_scan", session };

  const next = { ...session };

  if (session.step === "from") {
    if (scan.kind !== "slot") return { ok: false, error: "wrong_slot", session };
    if (!codesEqual(scan.value, session.task.fromCode)) return { ok: false, error: "wrong_slot", session };
    next.fromCode = scan.value;
  } else if (session.step === "sscc") {
    if (scan.kind !== "sscc") return { ok: false, error: "wrong_sscc", session };
    if (scan.value !== session.task.sscc) return { ok: false, error: "wrong_sscc", session };
    next.sscc = scan.value;
  } else if (session.step === "to") {
    if (scan.kind !== "slot") return { ok: false, error: "wrong_dest", session };
    if (!session.task.toCode || !codesEqual(scan.value, session.task.toCode)) {
      return { ok: false, error: "wrong_dest", session };
    }
    next.toCode = scan.value;
  } else if (session.step === "qty") {
    if (scan.kind !== "qty") return { ok: false, error: "invalid_qty", session };
    const qty = Number(scan.value);
    if (!Number.isFinite(qty) || qty < 0) return { ok: false, error: "invalid_qty", session };
    if (session.task.kind === "pick" && (qty < 1 || qty > session.task.qty)) {
      return { ok: false, error: "invalid_qty", session };
    }
    next.qty = qty;
  }

  next.step = nextStep(session.task, next);
  return { ok: true, session: next };
}

export function confirmRfTask(
  snap: WmsSnapshot,
  session: RfSession,
  operatorId: string | null,
): { ok: true; snap: WmsSnapshot } | { ok: false; error: RfConfirmError } {
  if (session.step !== "ready") return { ok: false, error: "scan_incomplete" };
  const task = session.task;
  const fleet = snap.fleet.find((f) => f.kind === "retractil_doble" && f.status === "operativa");

  if (task.kind === "pick") {
    if (!task.waveId || !task.lineId || session.qty == null) return { ok: false, error: "scan_incomplete" };
    return confirmPick(snap, task.waveId, task.lineId, {
      slotCode: session.fromCode,
      sscc: session.sscc,
      qty: session.qty,
    });
  }

  if (task.kind === "putaway") {
    return confirmPutaway(snap, {
      sscc: session.sscc,
      fromSlotCode: session.fromCode,
      toSlotCode: session.toCode,
      operatorId,
      fleetId: fleet?.id ?? null,
    });
  }

  if (task.kind === "replenish") {
    const proposal = proposeReplenishments(snap).find((p) => p.id === task.replenishId);
    if (!proposal) return { ok: false, error: "task_stale" };
    return applyReplenishment(snap, proposal, fleet?.id ?? null, operatorId);
  }

  if (task.kind === "count") {
    if (!task.countTask || session.qty == null) return { ok: false, error: "scan_incomplete" };
    const result = confirmCycleCount(snap, task.countTask, {
      slotCode: session.fromCode,
      sscc: session.sscc,
      qty: session.qty,
    });
    if (!result.ok) return result;
    return { ok: true, snap: result.snap };
  }

  return { ok: false, error: "task_stale" };
}
