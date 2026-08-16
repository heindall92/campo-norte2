import { WMS_DEMO_NOW } from "./alerts";
import { appendAuditLog } from "./audit";
import { receiveAsnPallet } from "./catalog";
import { applyTxToSnapshot, locationOfPallet } from "./inventory-core";
import type {
  AsnIncident,
  AsnIncidentKind,
  AsnLine,
  Pallet,
  QcStatus,
  WmsSnapshot,
} from "./types";

export type ReceiveError =
  | "asn_missing"
  | "asn_closed"
  | "sku_missing"
  | "slot_missing"
  | "invalid_input"
  | "line_missing"
  | "line_closed"
  | "sku_mismatch"
  | "invalid_qty"
  | "qc_invalid"
  | "pallet_missing";

export type ReceiveResult =
  | { ok: true; snap: WmsSnapshot; palletId?: string; incidentIds: string[] }
  | { ok: false; error: ReceiveError };

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function palletQcStatus(pallet: Pallet): QcStatus {
  return pallet.qcStatus ?? "APPROVED";
}

/** Palet en cuarentena o QC no aprobado no entra en picking. */
export function palletCanPick(pallet: Pallet): boolean {
  if (pallet.status === "cuarentena" || pallet.status === "expedido") return false;
  return palletQcStatus(pallet) === "APPROVED";
}

/** Putaway a hueco de almacén solo con QC aprobado. */
export function palletCanPutaway(pallet: Pallet): boolean {
  if (pallet.status !== "muelle") return false;
  return palletQcStatus(pallet) === "APPROVED";
}

export function linesForAsn(snap: WmsSnapshot, asnId: string): AsnLine[] {
  return (snap.asnLines ?? []).filter((l) => l.asnId === asnId);
}

export function incidentsForAsn(snap: WmsSnapshot, asnId: string): AsnIncident[] {
  return (snap.asnIncidents ?? []).filter((i) => i.asnId === asnId);
}

function lineStatus(expectedQty: number, receivedQty: number, closed: boolean): AsnLine["status"] {
  if (closed) return "closed";
  if (receivedQty <= 0) return "open";
  if (receivedQty >= expectedQty) return "received";
  return "partial";
}

function pushIncident(
  snap: WmsSnapshot,
  input: {
    asnId: string;
    lineId: string | null;
    palletId: string | null;
    kind: AsnIncidentKind;
    qty: number;
    note: string;
    at: string;
  },
): { snap: WmsSnapshot; id: string } {
  const id = uid("inc");
  const row: AsnIncident = { id, ...input };
  return { snap: { ...snap, asnIncidents: [row, ...(snap.asnIncidents ?? [])] }, id };
}

export function addAsnLine(
  snap: WmsSnapshot,
  asnId: string,
  input: { skuId: string; expectedQty: number; expectedLot?: string | null },
): ReceiveResult {
  const asn = snap.inbound.find((a) => a.id === asnId);
  if (!asn) return { ok: false, error: "asn_missing" };
  if (asn.status === "cerrado") return { ok: false, error: "asn_closed" };
  if (!snap.skus.some((s) => s.id === input.skuId)) return { ok: false, error: "sku_missing" };
  if (!Number.isFinite(input.expectedQty) || input.expectedQty < 1) {
    return { ok: false, error: "invalid_qty" };
  }
  const lot = input.expectedLot?.trim() || null;
  const line: AsnLine = {
    id: uid("aln"),
    asnId,
    skuId: input.skuId,
    expectedQty: Math.floor(input.expectedQty),
    receivedQty: 0,
    expectedLot: lot,
    status: "open",
  };
  return {
    ok: true,
    snap: { ...snap, asnLines: [...(snap.asnLines ?? []), line] },
    incidentIds: [],
  };
}

/**
 * Recibe contra una línea ASN. El palet queda PENDING hasta QC.
 * Parcial / exceso / dañado / lote incorrecto → incidencia con qty real.
 */
export function receiveAgainstLine(
  snap: WmsSnapshot,
  asnId: string,
  lineId: string,
  input: { qty: number; lot: string; skuId?: string; damagedQty?: number },
  at = WMS_DEMO_NOW,
): ReceiveResult {
  const asn = snap.inbound.find((a) => a.id === asnId);
  if (!asn) return { ok: false, error: "asn_missing" };
  if (asn.status === "cerrado") return { ok: false, error: "asn_closed" };
  const line = (snap.asnLines ?? []).find((l) => l.id === lineId && l.asnId === asnId);
  if (!line) return { ok: false, error: "line_missing" };
  if (line.status === "closed") return { ok: false, error: "line_closed" };
  const skuId = input.skuId ?? line.skuId;
  if (skuId !== line.skuId) return { ok: false, error: "sku_mismatch" };
  if (!Number.isFinite(input.qty) || input.qty < 1) return { ok: false, error: "invalid_qty" };
  const damagedQty = input.damagedQty ?? 0;
  if (!Number.isFinite(damagedQty) || damagedQty < 0 || damagedQty > input.qty) {
    return { ok: false, error: "invalid_qty" };
  }

  const knownIds = new Set(snap.pallets.map((p) => p.id));
  const rec = receiveAsnPallet(snap, asnId, { skuId, qty: input.qty, lot: input.lot });
  if (!rec.ok) {
    if (rec.error === "asn_missing") return { ok: false, error: "asn_missing" };
    if (rec.error === "sku_missing") return { ok: false, error: "sku_missing" };
    if (rec.error === "slot_missing") return { ok: false, error: "slot_missing" };
    return { ok: false, error: "invalid_input" };
  }

  const pallet = rec.snap.pallets.find((p) => !knownIds.has(p.id));
  if (!pallet) return { ok: false, error: "pallet_missing" };

  const remaining = Math.max(0, line.expectedQty - line.receivedQty);
  const excess = Math.max(0, input.qty - remaining);
  const receivedQty = line.receivedQty + input.qty;
  const nextLine: AsnLine = {
    ...line,
    receivedQty,
    status: lineStatus(line.expectedQty, receivedQty, false),
  };

  let next: WmsSnapshot = {
    ...rec.snap,
    pallets: rec.snap.pallets.map((p) => (p.id === pallet.id ? { ...p, qcStatus: "PENDING" as const } : p)),
    asnLines: (rec.snap.asnLines ?? snap.asnLines ?? []).map((l) => (l.id === line.id ? nextLine : l)),
  };
  if (!(next.asnLines ?? []).some((l) => l.id === line.id)) {
    next = { ...next, asnLines: [...(next.asnLines ?? []), nextLine] };
  }

  const incidentIds: string[] = [];
  const lot = input.lot.trim() || "SIN-LOTE";

  if (excess > 0) {
    const row = pushIncident(next, {
      asnId,
      lineId: line.id,
      palletId: pallet.id,
      kind: "overage",
      qty: excess,
      note: `exceso ${excess} ud. sobre esperado ${line.expectedQty}`,
      at,
    });
    next = row.snap;
    incidentIds.push(row.id);
  } else if (input.qty < remaining) {
    const row = pushIncident(next, {
      asnId,
      lineId: line.id,
      palletId: pallet.id,
      kind: "partial",
      qty: input.qty,
      note: `parcial ${input.qty} de ${remaining} pendientes`,
      at,
    });
    next = row.snap;
    incidentIds.push(row.id);
  }

  if (line.expectedLot && lot !== line.expectedLot) {
    const row = pushIncident(next, {
      asnId,
      lineId: line.id,
      palletId: pallet.id,
      kind: "wrong_lot",
      qty: input.qty,
      note: `lote ${lot} ≠ esperado ${line.expectedLot}`,
      at,
    });
    next = row.snap;
    incidentIds.push(row.id);
  }

  if (damagedQty > 0) {
    const row = pushIncident(next, {
      asnId,
      lineId: line.id,
      palletId: pallet.id,
      kind: "damaged",
      qty: damagedQty,
      note: `${damagedQty} ud. dañadas`,
      at,
    });
    next = row.snap;
    incidentIds.push(row.id);
  }

  if (damagedQty === input.qty) {
    const qc = decideQc(next, pallet.id, "QUARANTINED", null, at);
    if (!qc.ok) return qc;
    next = qc.snap;
  }

  return { ok: true, snap: next, palletId: pallet.id, incidentIds };
}

/** Cierra la línea. Si falta qty, incidencia `shortage` con el faltante real. */
export function closeAsnLine(snap: WmsSnapshot, lineId: string, at = WMS_DEMO_NOW): ReceiveResult {
  const line = (snap.asnLines ?? []).find((l) => l.id === lineId);
  if (!line) return { ok: false, error: "line_missing" };
  if (line.status === "closed") return { ok: false, error: "line_closed" };
  const missing = Math.max(0, line.expectedQty - line.receivedQty);
  let next: WmsSnapshot = {
    ...snap,
    asnLines: (snap.asnLines ?? []).map((l) =>
      l.id === lineId ? { ...l, status: "closed" as const } : l,
    ),
  };
  const incidentIds: string[] = [];
  if (missing > 0) {
    const row = pushIncident(next, {
      asnId: line.asnId,
      lineId: line.id,
      palletId: null,
      kind: "shortage",
      qty: missing,
      note: `faltante ${missing} ud. (recibido ${line.receivedQty} de ${line.expectedQty})`,
      at,
    });
    next = row.snap;
    incidentIds.push(row.id);
  }
  return { ok: true, snap: next, incidentIds };
}

export function decideQc(
  snap: WmsSnapshot,
  palletId: string,
  status: QcStatus,
  operatorId: string | null = null,
  at = WMS_DEMO_NOW,
): ReceiveResult {
  const pallet = snap.pallets.find((p) => p.id === palletId);
  if (!pallet) return { ok: false, error: "pallet_missing" };
  if (status !== "PENDING" && status !== "APPROVED" && status !== "REJECTED" && status !== "QUARANTINED") {
    return { ok: false, error: "qc_invalid" };
  }

  const prev = palletQcStatus(pallet);
  const loc = locationOfPallet(pallet);
  let nextPallets = snap.pallets;
  let next: WmsSnapshot = snap;

  const hold = status === "QUARANTINED" || status === "REJECTED";
  const wasHold = pallet.status === "cuarentena" || prev === "QUARANTINED" || prev === "REJECTED";

  if (hold && !wasHold && pallet.qty > 0) {
    const q = applyTxToSnapshot(snap, {
      type: "QUARANTINE",
      skuId: pallet.skuId,
      lot: pallet.lot || null,
      fromLocationId: loc,
      qty: pallet.qty,
      reason: `qc-${status}`,
      refType: "pallet",
      refId: pallet.id,
      palletId: pallet.id,
      actorId: operatorId,
      at,
      id: `itx-QUAR-qc-${pallet.id}`,
    });
    if (!q.ok) return { ok: false, error: "invalid_input" };
    next = q.snap;
    nextPallets = next.pallets.map((p) =>
      p.id === pallet.id ? { ...p, status: "cuarentena" as const, qcStatus: status } : p,
    );
  } else if (!hold && wasHold && pallet.qty > 0 && status === "APPROVED") {
    const rel = applyTxToSnapshot(snap, {
      type: "RELEASE",
      skuId: pallet.skuId,
      lot: pallet.lot || null,
      fromLocationId: loc,
      qty: pallet.qty,
      reason: "qc-APPROVED",
      refType: "pallet",
      refId: pallet.id,
      palletId: pallet.id,
      actorId: operatorId,
      at,
      id: `itx-REL-qc-${pallet.id}`,
    });
    if (!rel.ok) return { ok: false, error: "invalid_input" };
    next = rel.snap;
    const slot = pallet.slotId ? next.slots.find((s) => s.id === pallet.slotId) : null;
    const restored = slot?.zone === "muelle" ? ("muelle" as const) : ("en_ubicacion" as const);
    nextPallets = next.pallets.map((p) =>
      p.id === pallet.id ? { ...p, status: restored, qcStatus: "APPROVED" } : p,
    );
  } else {
    nextPallets = snap.pallets.map((p) => (p.id === pallet.id ? { ...p, qcStatus: status } : p));
    if (hold) {
      nextPallets = nextPallets.map((p) =>
        p.id === pallet.id ? { ...p, status: "cuarentena" as const } : p,
      );
    }
  }

  next = { ...next, pallets: nextPallets };
  next = appendAuditLog(next, {
    actorId: operatorId,
    warehouseId: pallet.siteId,
    action: "asn_qc",
    entity: "pallet",
    entityId: pallet.id,
    beforeData: { qcStatus: prev, status: pallet.status },
    afterData: { qcStatus: status },
    reason: `QC ${status}`,
    deviceId: null,
    correlationId: `qc-${pallet.id}`,
    timestamp: at,
  });
  return { ok: true, snap: next, palletId, incidentIds: [] };
}
