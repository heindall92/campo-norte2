import { describe, expect, it } from "vitest";
import {
  assignSuperToOperator,
  blockedSlotIds,
  buildWmsSeed,
  confirmPick,
  confirmVoicePick,
  fixSlotCount,
  nextFloorTicket,
  parseVoiceCommand,
  reportSlotMismatch,
} from "@/lib/wms";

describe("fase 19 · faltante de hueco y «N ok»", () => {
  it("si el hueco no coincide, el operario avisa y el jefe escribe la cuenta", () => {
    const snap = buildWmsSeed();
    const order = snap.outbound.find((o) => o.code === "OUT-SEV-8841")!;
    const assigned = assignSuperToOperator(snap, order.id, "OP-1903", "Luis");
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    const ticket = nextFloorTicket(assigned.snap, "op-08")!;
    const pallet = assigned.snap.pallets.find((p) => p.id === ticket.line.palletId)!;
    const short = {
      ...assigned.snap,
      pallets: assigned.snap.pallets.map((p) => (p.id === pallet.id ? { ...p, qty: 1 } : p)),
    };
    const shortTicket = nextFloorTicket(short, "op-08")!;
    expect(shortTicket.stockInSlot).toBe(1);
    expect(shortTicket.qty).toBeGreaterThan(1);

    const reported = reportSlotMismatch(short, {
      slotCode: shortTicket.slotCode,
      takeQty: shortTicket.qty,
      operatorId: "op-08",
    });
    expect(reported.ok).toBe(true);
    if (!reported.ok) return;
    expect(blockedSlotIds(reported.snap).has(shortTicket.line.slotId)).toBe(true);
    expect(nextFloorTicket(reported.snap, "op-08")?.slotCode).not.toBe(shortTicket.slotCode);

    const blockedPick = confirmPick(reported.snap, shortTicket.waveId, shortTicket.line.id, {
      slotCode: shortTicket.slotCode,
      sscc: pallet.sscc,
      qty: 1,
    });
    expect(blockedPick.ok).toBe(false);
    if (!blockedPick.ok) expect(blockedPick.error).toBe("slot_blocked");

    const fixed = fixSlotCount(reported.snap, {
      slotCode: shortTicket.slotCode,
      countedQty: shortTicket.qty + 2,
      reason: "pico_mal",
      note: "Había cajas detrás",
      fixedBy: "Luis",
    });
    expect(fixed.ok).toBe(true);
    if (!fixed.ok) return;
    const after = nextFloorTicket(fixed.snap, "op-08");
    expect(after?.slotCode).toBe(shortTicket.slotCode);
    expect(after?.stockInSlot).toBe(shortTicket.qty + 2);
    const voice = confirmVoicePick(fixed.snap, "op-08", shortTicket.qty);
    expect(voice.ok).toBe(true);
  });

  it("«5 ok» solo pica si coincide con el ticket y hay stock en el hueco", () => {
    const snap = buildWmsSeed();
    const order = snap.outbound.find((o) => o.code === "OUT-SEV-8841")!;
    const assigned = assignSuperToOperator(snap, order.id, "OP-1903", "Luis");
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    const ticket = nextFloorTicket(assigned.snap, "op-08")!;
    expect(confirmVoicePick(assigned.snap, "op-08", ticket.qty + 1).ok).toBe(false);
    const short = {
      ...assigned.snap,
      pallets: assigned.snap.pallets.map((p) => (p.id === ticket.line.palletId ? { ...p, qty: 0 } : p)),
    };
    const denied = confirmVoicePick(short, "op-08", ticket.qty);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error).toBe("slot_short");
    const ok = confirmVoicePick(assigned.snap, "op-08", ticket.qty);
    expect(ok.ok).toBe(true);
  });

  it("entiende sube, baja, acelera, atrás, artículo y «5 ok»", () => {
    expect(parseVoiceCommand("sube").kind).toBe("volume_up");
    expect(parseVoiceCommand("baja").kind).toBe("volume_down");
    expect(parseVoiceCommand("acelera").kind).toBe("faster");
    expect(parseVoiceCommand("atrás").kind).toBe("repeat_slot");
    expect(parseVoiceCommand("artículo").kind).toBe("article");
    expect(parseVoiceCommand("5 ok")).toEqual({ kind: "confirm", qty: 5 });
    expect(parseVoiceCommand("cinco vale")).toEqual({ kind: "confirm", qty: 5 });
    expect(parseVoiceCommand("no entiendo").kind).toBe("unknown");
  });
});
