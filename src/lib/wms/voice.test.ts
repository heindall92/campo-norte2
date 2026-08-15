import { describe, expect, it } from "vitest";
import {
  AISLE_GUIDE,
  assignSuperToOperator,
  buildClosePrompt,
  buildVoicePrompt,
  buildWmsSeed,
  confirmPick,
  familyForSku,
  nextFloorTicket,
  pickPackForSku,
  remainderLabel,
  remainingOnPallet,
  voiceCueAfterMark,
} from "@/lib/wms";

describe("fase 17 · voz de auriculares y guía de pasillos", () => {
  it("la guía 8–37 es el relato de planta; no inventa SKU de cerveza ni vino", () => {
    expect(AISLE_GUIDE.find((f) => f.id === "drogueria")?.aisleFrom).toBe(8);
    expect(AISLE_GUIDE.find((f) => f.id === "leche")?.aisleFrom).toBe(28);
    expect(AISLE_GUIDE.find((f) => f.id === "agua")?.aisleTo).toBe(32);
    expect(familyForSku("sku-leche")?.id).toBe("leche");
    expect(familyForSku("sku-detergente")?.id).toBe("drogueria");
    expect(familyForSku("sku-agua")?.id).toBe("agua");
    expect(AISLE_GUIDE.find((f) => f.id === "cerveza")?.skuIds).toEqual([]);
    expect(AISLE_GUIDE.find((f) => f.id === "especias")?.skuIds).toEqual([]);
  });

  it("los auriculares dicen pasillo, hueco y si son cajas o unidades del contenedor", () => {
    const snap = buildWmsSeed();
    const order = snap.outbound.find((o) => o.code === "OUT-SEV-8841")!;
    const assigned = assignSuperToOperator(snap, order.id, "OP-1903", "Luis");
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    const ticket = nextFloorTicket(assigned.snap, "op-08");
    expect(ticket).toBeTruthy();
    if (!ticket) return;
    expect(ticket.pickPack).toBe("caja");
    const voice = buildVoicePrompt(ticket, "es");
    expect(voice.text).toContain(ticket.slotCode);
    expect(voice.text).toMatch(/Tomar \d+ cajas/);
    expect(voice.text).toContain(`Pasillo ${ticket.aisle}`);
    expect(voice.text).toContain(order.customer);

    const inner = buildVoicePrompt({ ...ticket, pickPack: "contenedor", qty: 4 }, "es");
    expect(inner.text).toContain("Del contenedor, tomar 4");
    expect(inner.pickPack).toBe("contenedor");
  });

  it("un SKU a unidad se pica del contenedor; el resto en caja", () => {
    const snap = buildWmsSeed();
    expect(pickPackForSku(snap.skus.find((s) => s.id === "sku-leche"))).toBe("caja");
    expect(pickPackForSku({ ...snap.skus[0]!, uom: "ud" })).toBe("contenedor");
  });
});

describe("fase 18 · ciclo de voz tras marcar", () => {
  it("al terminar el súper el aparato dice fleje, etiqueta y pasillo de muelle", () => {
    const close = buildClosePrompt(
      { storeName: "Tienda CN · Dos Hermanas", orderCode: "OUT-SEV-8841", dockAisle: "M-05" },
      "es",
    );
    expect(close.text).toContain("Súper Tienda CN · Dos Hermanas completo");
    expect(close.text).toContain("Fleja");
    expect(close.text).toContain("Escribe la etiqueta y pégala");
    expect(close.text).toContain("Deja en el pasillo de muelle M-05");
    expect(close.dockAisle).toBe("M-05");
  });

  it("tras marcar dicta el siguiente ticket; si no queda línea, el cierre", () => {
    const snap = buildWmsSeed();
    const order = snap.outbound.find((o) => o.code === "OUT-SEV-8841")!;
    const assigned = assignSuperToOperator(snap, order.id, "OP-1903", "Luis");
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    const first = nextFloorTicket(assigned.snap, "op-08");
    expect(first).toBeTruthy();
    if (!first) return;
    const pallet = assigned.snap.pallets.find((p) => p.id === first.line.palletId)!;
    const picked = confirmPick(assigned.snap, first.waveId, first.line.id, {
      slotCode: first.slotCode,
      sscc: pallet.sscc,
      qty: first.qty,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;

    const cue = voiceCueAfterMark(picked.snap, "op-08", {
      storeName: first.storeName,
      orderCode: first.orderCode,
      dockAisle: first.dockAisle,
      palletId: first.line.palletId,
      pickPack: first.pickPack,
    });
    const next = nextFloorTicket(picked.snap, "op-08");
    if (next) {
      expect(cue.kind).toBe("ticket");
      if (cue.kind !== "ticket") return;
      expect(cue.prompt.text).toContain(next.slotCode);
      expect(cue.ticket.line.id).toBe(next.line.id);
    } else {
      expect(cue.kind).toBe("close");
      if (cue.kind !== "close") return;
      expect(cue.prompt.text).toContain("Fleja");
      expect(cue.prompt.text).toContain(first.dockAisle);
    }
    expect(remainingOnPallet(picked.snap, first.line.palletId)).toBe(pallet.qty - first.qty);
  });

  it("el resto en hueco sale del palet; no inventa cajas pequeñas dentro", () => {
    expect(remainderLabel(6, "caja", "es")).toBe("Quedan 6 cajas en el hueco");
    expect(remainderLabel(4, "contenedor", "es")).toBe("Quedan 4 en el contenedor");
    expect(remainderLabel(0, "caja", "es")).toBe("Hueco vacío");
    expect(remainderLabel(null)).toBeNull();
  });
});
