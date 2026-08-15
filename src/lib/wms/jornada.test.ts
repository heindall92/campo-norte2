import { describe, expect, it } from "vitest";
import {
  assertCanPick,
  buildWmsSeed,
  clockManual,
  createOutboundOrder,
  enrollOperatorPin,
  openWaveFromOrder,
  operatorJornada,
  outboundItinerary,
  SHIFT_WINDOW,
} from "@/lib/wms";

describe("fase 9 · jornada y olas", () => {
  it("calcula horas vs ventana de turno sin inventar fichajes", () => {
    const snap = buildWmsSeed();
    const before = operatorJornada(snap, "op-08");
    expect(before?.clockedIn).toBe(false);
    expect(before?.hoursWorked).toBe(0);
    expect(before?.plannedHours).toBe(SHIFT_WINDOW.tarde.plannedHours);
    expect(before?.windowLabel).toBe("14:00–22:00");

    const inPunch = clockManual(snap, "op-08", "entrada", "2026-08-15T14:00:00.000Z");
    expect(inPunch.ok).toBe(true);
    if (!inPunch.ok) return;
    const mid = operatorJornada(inPunch.snap, "op-08", new Date("2026-08-15T16:30:00.000Z"));
    expect(mid?.clockedIn).toBe(true);
    expect(mid?.hoursWorked).toBe(2.5);
    expect(mid?.withinWindow).toBe(true);
  });

  it("bloquea el picking de planta si no ha fichado o el PIN no coincide", () => {
    const snap = buildWmsSeed();
    const gated = assertCanPick(snap, "op-08", null, true);
    expect(gated.ok).toBe(false);
    if (!gated.ok) expect(gated.error).toBe("not_clocked");

    const inPunch = clockManual(snap, "op-08", "entrada", "2026-08-15T14:05:00.000Z");
    expect(inPunch.ok).toBe(true);
    if (!inPunch.ok) return;
    expect(assertCanPick(inPunch.snap, "op-08", null, true).ok).toBe(true);

    const enrolled = enrollOperatorPin(inPunch.snap, "op-08", "1470");
    expect(enrolled.ok).toBe(true);
    if (!enrolled.ok) return;
    const needPin = assertCanPick(enrolled.snap, "op-08", null, true);
    expect(needPin.ok).toBe(false);
    if (!needPin.ok) expect(needPin.error).toBe("pin_required");
    expect(assertCanPick(enrolled.snap, "op-08", "1470", true).ok).toBe(true);
  });

  it("abre una ola desde un pedido nuevo con palets reales del pasillo", () => {
    const snap = buildWmsSeed();
    const created = createOutboundOrder(snap, {
      customer: "Tienda CN · Mairena",
      cutOff: "2026-08-15T17:00:00.000Z",
      dock: "M-06",
      siteId: "site-sev",
      lines: 8,
      pallets: 3,
      priority: "urgente",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const opened = openWaveFromOrder(created.snap, created.orderId, "op-08");
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const wave = opened.snap.pickWaves.find((w) => w.id === opened.waveId);
    expect(wave?.operatorId).toBe("op-08");
    expect(wave?.lines.length).toBeGreaterThan(0);
    expect(wave?.lines.every((l) => l.orderCode.startsWith("OUT-"))).toBe(true);
    for (const line of wave!.lines) {
      const pallet = opened.snap.pallets.find((p) => p.id === line.palletId);
      expect(pallet?.qty).toBe(line.qty);
    }
    const again = openWaveFromOrder(opened.snap, created.orderId, "op-08");
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.waveId).toBe(opened.waveId);
  });

  it("ordena el itinerario de muelle por ventana y prioridad", () => {
    const itin = outboundItinerary(buildWmsSeed(), "site-sev");
    expect(itin.length).toBeGreaterThan(1);
    expect(itin[0]?.seq).toBe(1);
    const times = itin.map((r) => new Date(r.windowStart ?? r.order.cutOff).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
