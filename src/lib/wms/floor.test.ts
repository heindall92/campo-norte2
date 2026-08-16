import { describe, expect, it } from "vitest";
import {
  assignSuperToOperator,
  aisleTraces,
  buildFinishAskPrompt,
  buildWmsSeed,
  confirmPick,
  declareUnitsMade,
  labelCountForUnits,
  labelLoadUnit,
  nextFloorTicket,
  nextOpenLine,
  openLoadUnit,
  operatorByCode,
  parseVoiceCommand,
  placeLoadUnitOnDock,
  strapLoadUnit,
  superLabelFaces,
  superSideLabelsHtml,
} from "@/lib/wms";

describe("fase 15 · asignación de súper y rastro de pasillo", () => {
  it("identifica al operario por el código que escribe, no por un aparato", () => {
    const snap = buildWmsSeed();
    expect(operatorByCode(snap, "op-1903")?.name).toBe("Jorge Peña");
    expect(operatorByCode(snap, "OP-1903")?.id).toBe("op-08");
    expect(operatorByCode(snap, "  OP-1410  ")?.name).toBe("Lucía Navarro");
    expect(operatorByCode(snap, "NO-EXISTE")).toBeNull();
    expect(operatorByCode(snap, "")).toBeNull();
  });

  it("el patrón asigna el súper al código y el ticket enseña pasillo, hueco y cantidad", () => {
    const snap = buildWmsSeed();
    const order = snap.outbound.find((o) => o.code === "OUT-SEV-8841")!;
    const assigned = assignSuperToOperator(snap, order.id, "OP-1903", "Sofía Ruiz");
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    expect(assigned.operatorId).toBe("op-08");
    const waves = assigned.snap.pickWaves.filter(
      (w) => w.status !== "cerrada" && w.lines.some((l) => l.orderCode === order.code),
    );
    expect(waves.every((w) => w.operatorId === "op-08")).toBe(true);
    expect(assigned.snap.superAssignments[0]?.assignedBy).toBe("Sofía Ruiz");

    const ticket = nextFloorTicket(assigned.snap, "op-08");
    expect(ticket?.storeName).toBe(order.customer);
    expect(ticket?.orderCode).toBe(order.code);
    expect(ticket?.dockAisle).toBe(order.dock);
    expect(ticket?.qty).toBeGreaterThan(0);
    expect(ticket?.slotCode).toMatch(/^[A-Z]-\d{2}-\d{2}-\d$/);
  });

  it("el rastro de pasillo solo avanza cuando marca el artículo", () => {
    const snap = buildWmsSeed();
    const order = snap.outbound.find((o) => o.code === "OUT-SEV-8841")!;
    const assigned = assignSuperToOperator(snap, order.id, "OP-1903", "Luis");
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    const before = aisleTraces(assigned.snap, "site-sev").find((t) => t.operator.id === "op-08");
    expect(before?.nextAisle).toBeTruthy();
    expect(before?.stops.filter((s) => s.orderCode === order.code)).toHaveLength(0);

    const ticket = nextFloorTicket(assigned.snap, "op-08")!;
    const pallet = assigned.snap.pallets.find((p) => p.id === ticket.line.palletId)!;
    const picked = confirmPick(assigned.snap, ticket.waveId, ticket.line.id, {
      slotCode: ticket.slotCode,
      sscc: pallet.sscc,
      qty: ticket.qty,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const after = aisleTraces(picked.snap, "site-sev").find((t) => t.operator.id === "op-08");
    expect(after?.currentAisle).toBe(ticket.aisle);
    expect(after?.stops[0]?.slotCode).toBe(ticket.slotCode);
    expect(after?.stops[0]?.qty).toBe(ticket.qty);
  });

  it("completa palet/caja/carro, fleja, pega la etiqueta escrita y la deja en muelle real", () => {
    const snap = buildWmsSeed();
    const wave = snap.pickWaves.find((w) => w.id === "wave-01")!;
    const line = nextOpenLine(wave)!;
    const slot = snap.slots.find((s) => s.id === line.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === line.palletId)!;
    const picked = confirmPick(snap, "wave-01", line.id, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: 2,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const order = picked.snap.outbound.find((o) => o.code === line.orderCode)!;
    const opened = openLoadUnit(picked.snap, order.id, "carro", "op-03");
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const unit = opened.snap.loadUnits[0]!;
    expect(unit.kind).toBe("carro");
    expect(unit.dockAisle).toBe(order.dock);
    expect(unit.qty).toBe(2);
    expect(labelLoadUnit(opened.snap, unit.id, "   ").ok).toBe(false);

    const strapped = strapLoadUnit(opened.snap, unit.id);
    expect(strapped.ok).toBe(true);
    if (!strapped.ok) return;
    const labeled = labelLoadUnit(strapped.snap, unit.id, "ETQ-MUELLE-01");
    expect(labeled.ok).toBe(true);
    if (!labeled.ok) return;
    expect(labeled.snap.loadUnits[0]?.labelCode).toBe("ETQ-MUELLE-01");

    const dock = labeled.snap.slots.find(
      (s) => s.siteId === order.siteId && s.zone === "muelle" && s.status === "libre" && !s.palletId,
    )!;
    const placed = placeLoadUnitOnDock(labeled.snap, unit.id, dock.code);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.snap.loadUnits[0]?.status).toBe("en_muelle");
    expect(placed.snap.loadUnits[0]?.dockSlotId).toBe(dock.id);
    expect(placeLoadUnitOnDock(placed.snap, unit.id, "Z-99-01-1").ok).toBe(false);
  });
});

describe("fase 20 · súper en box/palet/carro y etiquetas por lado", () => {
  it("asigna cómo tomar el súper, independiente del pedido", () => {
    const snap = buildWmsSeed();
    const order = snap.outbound.find((o) => o.code === "OUT-SEV-8841")!;
    const assigned = assignSuperToOperator(snap, order.id, "OP-1903", "Sofía", "2026-08-15T10:00:00.000Z", "palet");
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    expect(assigned.snap.superAssignments[0]?.loadKind).toBe("palet");
    const ticket = nextFloorTicket(assigned.snap, "op-08");
    expect(ticket?.loadKind).toBe("palet");
  });

  it("2 palets piden 4 etiquetas, una por cada lado", () => {
    expect(labelCountForUnits("palet", 2)).toBe(4);
    expect(labelCountForUnits("palet", 3)).toBe(6);
    expect(labelCountForUnits("caja", 4)).toBe(4);
    expect(superLabelFaces("palet", 2).map((f) => `${f.unitIndex}${f.side}`)).toEqual(["1A", "1B", "2A", "2B"]);
    expect(parseVoiceCommand("2").kind).toBe("count");
    expect(parseVoiceCommand("cuatro")).toEqual({ kind: "count", qty: 4 });
    const ask = buildFinishAskPrompt(
      { storeName: "Tienda CN · Dos Hermanas", orderCode: "OUT-SEV-8841", dockAisle: "M-05", loadKind: "palet" },
      "es",
    );
    expect(ask.text).toContain("finalizado");
    expect(ask.text).toContain("palets");
  });

  it("al decir 2 palets el sistema deja 4 etiquetas imprimibles sin inventar SSCC", () => {
    const snap = buildWmsSeed();
    const order = snap.outbound.find((o) => o.code === "OUT-SEV-8841")!;
    const assigned = assignSuperToOperator(snap, order.id, "OP-1903", "Luis", "2026-08-15T10:00:00.000Z", "palet");
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    const ticket = nextFloorTicket(assigned.snap, "op-08")!;
    const pallet = assigned.snap.pallets.find((p) => p.id === ticket.line.palletId)!;
    const picked = confirmPick(assigned.snap, ticket.waveId, ticket.line.id, {
      slotCode: ticket.slotCode,
      sscc: pallet.sscc,
      qty: ticket.qty,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const done = declareUnitsMade(picked.snap, "op-08", order.id, 2);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.labels).toBe(4);
    expect(done.snap.superAssignments[0]?.unitsMade).toBe(2);
    const html = superSideLabelsHtml(done.snap, "op-08", order.id, "es");
    expect(html).toBeTruthy();
    expect(html).toContain("Lado A");
    expect(html).toContain("Lado B");
    expect(html).toContain(order.customer);
    expect(html).toContain(order.dock);
    expect(html).not.toMatch(/00384\d{13}/);
  });
});
