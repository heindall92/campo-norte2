import { describe, expect, it } from "vitest";
import { createAsn } from "./catalog";
import { putawayReceivedPallet, suggestPutawaySlot } from "./movements";
import { confirmPick, nextOpenLine } from "./picking";
import {
  addAsnLine,
  closeAsnLine,
  decideQc,
  incidentsForAsn,
  linesForAsn,
  receiveAgainstLine,
} from "./receiving";
import { buildWmsSeed } from "./seed";

function asnWithLine(skuId = "sku-aceite", expectedQty = 48, expectedLot: string | null = "L26R1") {
  const seed = buildWmsSeed();
  const created = createAsn(seed, {
    supplier: "Aceites del Sur",
    eta: "2026-08-16T09:00:00.000Z",
    dock: "M-01",
    siteId: "site-sev",
    lines: 1,
    palletsExpected: 4,
  });
  if (!created.ok) throw new Error("asn");
  const asn = created.snap.inbound[0]!;
  const lined = addAsnLine(created.snap, asn.id, {
    skuId,
    expectedQty,
    expectedLot,
  });
  if (!lined.ok) throw new Error("line");
  return { snap: lined.snap, asnId: asn.id, lineId: linesForAsn(lined.snap, asn.id)[0]!.id };
}

describe("oleada 5 · ASN lines + QC", () => {
  it("semilla no inventa líneas ni incidencias a partir del número del ASN", () => {
    const snap = buildWmsSeed();
    expect(snap.asnLines).toEqual([]);
    expect(snap.asnIncidents).toEqual([]);
    expect(snap.inbound.some((a) => a.lines > 0)).toBe(true);
  });

  it("recepción exacta no crea incidencia; el palet queda PENDING hasta QC", () => {
    const { snap, asnId, lineId } = asnWithLine();
    const rec = receiveAgainstLine(snap, asnId, lineId, { qty: 48, lot: "L26R1" });
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    expect(rec.incidentIds).toEqual([]);
    const line = linesForAsn(rec.snap, asnId)[0]!;
    expect(line.receivedQty).toBe(48);
    expect(line.status).toBe("received");
    const pal = rec.snap.pallets.find((p) => p.id === rec.palletId)!;
    expect(pal.qcStatus).toBe("PENDING");
    const dest = suggestPutawaySlot(rec.snap, pal);
    const blocked = putawayReceivedPallet(rec.snap, pal.id, dest!.code, "op-04");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe("qc_pending");
  });

  it("QC aprobado permite ubicar; cuarentena no pica", () => {
    const { snap, asnId, lineId } = asnWithLine();
    const rec = receiveAgainstLine(snap, asnId, lineId, { qty: 48, lot: "L26R1" });
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    const approved = decideQc(rec.snap, rec.palletId!, "APPROVED", "op-04");
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    const pal = approved.snap.pallets.find((p) => p.id === rec.palletId)!;
    const dest = suggestPutawaySlot(approved.snap, pal)!;
    const put = putawayReceivedPallet(approved.snap, pal.id, dest.code, "op-04");
    expect(put.ok).toBe(true);

    const seed = buildWmsSeed();
    const wave = seed.pickWaves.find((w) => w.id === "wave-01")!;
    const line = nextOpenLine(wave)!;
    const slot = seed.slots.find((s) => s.id === line.slotId)!;
    const held = seed.pallets.find((p) => p.id === line.palletId)!;
    const quarantined = decideQc(seed, held.id, "QUARANTINED", "op-04");
    expect(quarantined.ok).toBe(true);
    if (!quarantined.ok) return;
    expect(quarantined.snap.pallets.find((p) => p.id === held.id)?.status).toBe("cuarentena");
    const pick = confirmPick(quarantined.snap, wave.id, line.id, {
      slotCode: slot.code,
      sscc: held.sscc,
      qty: line.qty,
    });
    expect(pick.ok).toBe(false);
    if (!pick.ok) expect(pick.error).toBe("pallet_quarantined");
  });

  it("parcial, exceso, faltante, dañado y lote incorrecto llevan qty real", () => {
    const { snap, asnId, lineId } = asnWithLine("sku-aceite", 48, "L26R1");
    const partial = receiveAgainstLine(snap, asnId, lineId, { qty: 20, lot: "L26R1" });
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    const partInc = incidentsForAsn(partial.snap, asnId).find((i) => i.kind === "partial");
    expect(partInc?.qty).toBe(20);

    const over = receiveAgainstLine(partial.snap, asnId, lineId, { qty: 40, lot: "L99X" });
    expect(over.ok).toBe(true);
    if (!over.ok) return;
    const overInc = incidentsForAsn(over.snap, asnId).find((i) => i.kind === "overage");
    expect(overInc?.qty).toBe(12);
    const lotInc = incidentsForAsn(over.snap, asnId).find((i) => i.kind === "wrong_lot");
    expect(lotInc?.qty).toBe(40);

    const closed = closeAsnLine(over.snap, lineId);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(incidentsForAsn(closed.snap, asnId).some((i) => i.kind === "shortage")).toBe(false);

    const dmgAsn = asnWithLine("sku-leche", 60, "L26F1");
    const dmg = receiveAgainstLine(dmgAsn.snap, dmgAsn.asnId, dmgAsn.lineId, {
      qty: 60,
      lot: "L26F1",
      damagedQty: 8,
    });
    expect(dmg.ok).toBe(true);
    if (!dmg.ok) return;
    expect(incidentsForAsn(dmg.snap, dmgAsn.asnId).find((i) => i.kind === "damaged")?.qty).toBe(8);
    expect(dmg.snap.pallets.find((p) => p.id === dmg.palletId)?.qcStatus).toBe("PENDING");

    const other = asnWithLine("sku-agua", 72, "L26W1");
    const wrecked = receiveAgainstLine(other.snap, other.asnId, other.lineId, {
      qty: 72,
      lot: "L26W1",
      damagedQty: 72,
    });
    expect(wrecked.ok).toBe(true);
    if (!wrecked.ok) return;
    expect(incidentsForAsn(wrecked.snap, other.asnId).find((i) => i.kind === "damaged")?.qty).toBe(72);
    expect(wrecked.snap.pallets.find((p) => p.id === wrecked.palletId)?.status).toBe("cuarentena");

    const shortAsn = asnWithLine("sku-arroz", 80, null);
    const shortRec = receiveAgainstLine(shortAsn.snap, shortAsn.asnId, shortAsn.lineId, {
      qty: 50,
      lot: "L26D9",
    });
    expect(shortRec.ok).toBe(true);
    if (!shortRec.ok) return;
    const shortClose = closeAsnLine(shortRec.snap, shortAsn.lineId);
    expect(shortClose.ok).toBe(true);
    if (!shortClose.ok) return;
    const shortage = incidentsForAsn(shortClose.snap, shortAsn.asnId).find((i) => i.kind === "shortage");
    expect(shortage?.qty).toBe(30);
  });

  it("no añade línea de un SKU que no existe ni recibe ASN cerrado", () => {
    const seed = buildWmsSeed();
    const closed = seed.inbound.find((a) => a.status === "cerrado")!;
    const badSku = addAsnLine(seed, closed.id, { skuId: "sku-inventado", expectedQty: 10 });
    expect(badSku.ok).toBe(false);
    const onClosed = addAsnLine(seed, closed.id, { skuId: "sku-aceite", expectedQty: 10 });
    expect(onClosed.ok).toBe(false);
    if (!onClosed.ok) expect(onClosed.error).toBe("asn_closed");
  });
});
