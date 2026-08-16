import { wmsUid } from "./ids";
import { recordPhysicalTx } from "./inventory";
import { nextUniqueSscc } from "./sscc";
import type { AsnLine, ReceiptIncident, ReceiptIncidentKind, WmsSnapshot } from "./types";
import { appendAudit } from "./audit";
import { createPallet, updateAsn } from "./catalog";

export type ReceivingError = "asn_missing" | "line_missing" | "closed" | "invalid_qty" | "sku_missing";

function linesOf(snap: WmsSnapshot, asnId: string): AsnLine[] {
  return (snap.asnLines ?? []).filter((l) => l.asnId === asnId);
}

export function addAsnLine(
  snap: WmsSnapshot,
  input: { asnId: string; skuId: string; qtyExpected: number; lotExpected?: string | null },
): { ok: true; snap: WmsSnapshot; lineId: string } | { ok: false; error: ReceivingError } {
  if (!snap.inbound.some((a) => a.id === input.asnId)) return { ok: false, error: "asn_missing" };
  if (!snap.skus.some((s) => s.id === input.skuId)) return { ok: false, error: "sku_missing" };
  if (!Number.isFinite(input.qtyExpected) || input.qtyExpected < 1) return { ok: false, error: "invalid_qty" };
  const line: AsnLine = {
    id: wmsUid("asnl"),
    asnId: input.asnId,
    skuId: input.skuId,
    qtyExpected: input.qtyExpected,
    qtyReceived: 0,
    lotExpected: input.lotExpected ?? null,
  };
  return { ok: true, lineId: line.id, snap: { ...snap, asnLines: [line, ...(snap.asnLines ?? [])] } };
}

function incident(
  asnId: string,
  line: AsnLine | null,
  kind: ReceiptIncidentKind,
  skuId: string,
  expected: number,
  actual: number,
  at: string,
): ReceiptIncident {
  return {
    id: wmsUid("inc"),
    asnId,
    asnLineId: line?.id ?? null,
    kind,
    skuId,
    expectedQty: expected,
    actualQty: actual,
    note: `${kind} · esperado ${expected} · recibido ${actual}`,
    at,
  };
}

/**
 * Recibe contra línea ASN si existe. Detecta parcial / exceso / faltante / lote.
 * Si no hay líneas, se comporta como receiveAsnPallet histórico.
 */
export function receiveAgainstAsn(
  snap: WmsSnapshot,
  asnId: string,
  input: { skuId: string; qty: number; lot: string; lineId?: string },
  at = "2026-08-15T09:00:00.000Z",
): { ok: true; snap: WmsSnapshot; incidents: ReceiptIncident[] } | { ok: false; error: ReceivingError } {
  const asn = snap.inbound.find((a) => a.id === asnId);
  if (!asn) return { ok: false, error: "asn_missing" };
  if (asn.status === "cerrado") return { ok: false, error: "closed" };
  if (!Number.isFinite(input.qty) || input.qty < 1) return { ok: false, error: "invalid_qty" };

  const line =
    (input.lineId ? linesOf(snap, asnId).find((l) => l.id === input.lineId) : null) ??
    linesOf(snap, asnId).find((l) => l.skuId === input.skuId) ??
    null;

  const incidents: ReceiptIncident[] = [];
  if (line) {
    const remaining = line.qtyExpected - line.qtyReceived;
    if (input.qty < remaining) incidents.push(incident(asnId, line, "parcial", input.skuId, remaining, input.qty, at));
    if (input.qty > remaining) incidents.push(incident(asnId, line, "exceso", input.skuId, remaining, input.qty, at));
    if (line.lotExpected && line.lotExpected !== input.lot) {
      incidents.push(incident(asnId, line, "lote", input.skuId, line.qtyExpected, input.qty, at));
    }
  }

  const dock = snap.slots.find(
    (s) => s.siteId === asn.siteId && s.zone === "muelle" && s.status === "libre" && !s.palletId,
  );
  if (!dock) return { ok: false, error: "asn_missing" };

  const created = createPallet(snap, {
    skuId: input.skuId,
    qty: input.qty,
    lot: input.lot,
    expiry: null,
    siteId: asn.siteId,
    slotId: dock.id,
    supplier: asn.supplier,
    asnId: asn.id,
    sscc: nextUniqueSscc(snap.pallets.map((p) => p.sscc)),
  });
  if (!created.ok) return { ok: false, error: "sku_missing" };

  const pallet = created.snap.pallets[0]!;
  let next = recordPhysicalTx(created.snap, {
    at,
    type: "RECEIPT",
    skuId: input.skuId,
    palletId: pallet.id,
    lot: input.lot,
    fromSlotId: null,
    toSlotId: dock.id,
    qty: input.qty,
    operatorId: null,
    note: `RECEIPT ${asn.code}`,
    idempotencyKey: `receipt-${asn.id}-${pallet.id}`,
  });

  if (line) {
    next = {
      ...next,
      asnLines: (next.asnLines ?? []).map((l) =>
        l.id === line.id ? { ...l, qtyReceived: l.qtyReceived + input.qty } : l,
      ),
    };
    const updatedLine = (next.asnLines ?? []).find((l) => l.id === line.id);
    if (updatedLine && next.inbound.find((a) => a.id === asnId)?.status === "ubicando") {
      /* keep */
    }
    if (updatedLine && updatedLine.qtyReceived < updatedLine.qtyExpected && input.qty === 0) {
      incidents.push(incident(asnId, line, "faltante", input.skuId, updatedLine.qtyExpected, updatedLine.qtyReceived, at));
    }
  }

  const done = asn.palletsDone + 1;
  const statused = updateAsn(next, asnId, {
    palletsDone: done,
    status: done >= asn.palletsExpected ? "ubicando" : "descargando",
  });
  if (!statused.ok) return { ok: false, error: "asn_missing" };

  next = {
    ...statused.snap,
    receiptIncidents: [...incidents, ...(statused.snap.receiptIncidents ?? [])],
  };
  return {
    ok: true,
    incidents,
    snap: appendAudit(next, {
      at,
      actorId: null,
      action: "asn.receive",
      entityType: "asn",
      entityId: asnId,
      before: String(asn.palletsDone),
      after: String(done),
    }),
  };
}

export function closeAsnWithShortages(
  snap: WmsSnapshot,
  asnId: string,
  at = "2026-08-15T18:00:00.000Z",
): { ok: true; snap: WmsSnapshot } | { ok: false; error: ReceivingError } {
  const asn = snap.inbound.find((a) => a.id === asnId);
  if (!asn) return { ok: false, error: "asn_missing" };
  const shortages = linesOf(snap, asnId)
    .filter((l) => l.qtyReceived < l.qtyExpected)
    .map((l) => incident(asnId, l, "faltante", l.skuId, l.qtyExpected, l.qtyReceived, at));
  return {
    ok: true,
    snap: {
      ...snap,
      inbound: snap.inbound.map((a) => (a.id === asnId ? { ...a, status: "cerrado" as const } : a)),
      receiptIncidents: [...shortages, ...(snap.receiptIncidents ?? [])],
    },
  };
}
