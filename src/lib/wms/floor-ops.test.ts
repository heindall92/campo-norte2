import { describe, expect, it } from "vitest";
import {
  assertCanPick,
  buildRfQueue,
  buildWmsSeed,
  clockManual,
  closeAsnIfLocated,
  confirmCycleCount,
  createAsn,
  planCycleCounts,
  putawayReceivedPallet,
  receiveAsnPallet,
  suggestPutawaySlot,
  zoneForCategory,
} from "@/lib/wms";

describe("fase 11 · putaway y conteo", () => {
  it("sugiere hueco de la zona del SKU, no el primer libre del muelle", () => {
    expect(zoneForCategory("frescos")).toBe("fresco");
    expect(zoneForCategory("congelados")).toBe("congelado");
    expect(zoneForCategory("alimentacion_seca")).toBe("seco");
    expect(zoneForCategory("categoria_usuario")).toBe("seco");

    const snap = buildWmsSeed();
    const rec = receiveAsnPallet(
      snap,
      snap.inbound.find((a) => a.siteId === "site-sev" && a.status !== "cerrado")!.id,
      { skuId: "sku-leche", qty: 60, lot: "L26F1" },
    );
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    const pal = rec.snap.pallets[0]!;
    const dest = suggestPutawaySlot(rec.snap, pal);
    expect(dest).toBeTruthy();
    expect(dest?.zone).toBe("fresco");
    expect(dest?.status).toBe("libre");
    expect(dest?.palletId).toBeNull();
  });

  it("ubica el palet recepcionado y cierra el ASN cuando no queda ninguno en muelle", () => {
    const snap = buildWmsSeed();
    const created = createAsn(snap, {
      supplier: "Aceites del Sur",
      eta: "2026-08-16T09:00:00.000Z",
      dock: "M-01",
      siteId: "site-sev",
      lines: 1,
      palletsExpected: 1,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const asn = created.snap.inbound[0]!;
    const rec = receiveAsnPallet(created.snap, asn.id, {
      skuId: "sku-aceite",
      qty: 48,
      lot: "L26P0",
    });
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    expect(rec.snap.inbound.find((a) => a.id === asn.id)?.status).toBe("ubicando");
    const pal = rec.snap.pallets.find((p) => p.asnId === asn.id)!;
    const dest = suggestPutawaySlot(rec.snap, pal);
    expect(dest?.zone).toBe("seco");
    const moved = putawayReceivedPallet(rec.snap, pal.id, dest!.code, "op-04");
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.snap.inbound.find((a) => a.id === asn.id)?.status).toBe("cerrado");
    expect(moved.snap.pallets.find((p) => p.id === pal.id)?.status).toBe("en_ubicacion");
    expect(closeAsnIfLocated(moved.snap, asn.id).ok).toBe(true);
  });

  it("el conteo cíclico guarda el operario y la pistola RF propone putaway por zona", () => {
    const snap = buildWmsSeed();
    const task = planCycleCounts(snap, { siteId: "site-sev", limit: 1 })[0]!;
    const slot = snap.slots.find((s) => s.id === task.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === task.palletId)!;
    const counted = confirmCycleCount(snap, task, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: pallet.qty,
      operatorId: "op-08",
    });
    expect(counted.ok).toBe(true);
    if (!counted.ok) return;
    expect(counted.variance).toBe(0);
    expect(counted.snap.movements[0]?.operatorId).toBe("op-08");
    expect(counted.snap.movements[0]?.type).toBe("inventario");

    const rec = receiveAsnPallet(
      counted.snap,
      counted.snap.inbound.find((a) => a.siteId === "site-sev" && a.status !== "cerrado")!.id,
      { skuId: "sku-helado", qty: 40, lot: "L26C1" },
    );
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    const put = buildRfQueue(rec.snap, "site-sev").find((t) => t.kind === "putaway" && t.sscc === rec.snap.pallets[0]?.sscc);
    expect(put).toBeTruthy();
    const dest = rec.snap.slots.find((s) => s.code === put?.toCode);
    expect(dest?.zone).toBe("congelado");
  });

  it("planta no confirma putaway si no ha fichado", () => {
    const snap = buildWmsSeed();
    expect(assertCanPick(snap, "op-08", null, true).ok).toBe(false);
    const inPunch = clockManual(snap, "op-08", "entrada", "2026-08-15T14:05:00.000Z");
    expect(inPunch.ok).toBe(true);
    if (!inPunch.ok) return;
    expect(assertCanPick(inPunch.snap, "op-08", null, true).ok).toBe(true);
  });
});
