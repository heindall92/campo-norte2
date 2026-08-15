import { describe, expect, it } from "vitest";
import {
  AISLE_GUIDE,
  assignSuperToOperator,
  buildVoicePrompt,
  buildWmsSeed,
  familyForSku,
  nextFloorTicket,
  pickPackForSku,
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
