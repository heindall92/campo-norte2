import { describe, expect, it } from "vitest";
import {
  assignFleetCharger,
  buildWmsSeed,
  clockWithPin,
  createAsn,
  createCategory,
  createOperator,
  createPallet,
  createSku,
  deleteCategory,
  enrollOperatorPin,
  ingestAdapterPunch,
  markShortage,
  rankDayPriorities,
  reportFleetBattery,
  rosterCounts,
  skipPickLine,
  updateAsn,
} from "@/lib/wms";
import { nextOpenLine } from "./picking";

describe("fase 8 · operación diaria", () => {
  it("cubre 25 plazas por turno en Sevilla sin inventar identidades", () => {
    const snap = buildWmsSeed();
    const counts = rosterCounts(snap.operators, "site-sev");
    expect(counts.manana.total).toBeGreaterThanOrEqual(25);
    expect(counts.tarde.total).toBeGreaterThanOrEqual(25);
    expect(counts.noche.total).toBeGreaterThanOrEqual(25);
    const vacant = snap.operators.filter((o) => o.vacant);
    expect(vacant.length).toBeGreaterThan(50);
    expect(vacant.every((o) => o.name === "Alta pendiente" && !o.active && o.hoursToday === 0)).toBe(
      true,
    );
    expect(snap.operators.some((o) => o.name === "Carmen Ruiz" && !o.vacant)).toBe(true);
  });

  it("crea categoría y SKU; no borra categoría de sistema ni en uso", () => {
    const snap = buildWmsSeed();
    const cat = createCategory(snap, { code: "horeca", labelEs: "HORECA", labelEn: "HORECA" });
    expect(cat.ok).toBe(true);
    if (!cat.ok) return;
    const sku = createSku(cat.snap, {
      sku: "HOR-NAP-01",
      name: "Servilleta hostelería",
      category: "horeca",
      uom: "caja",
      unitsPerPallet: 40,
      weightKg: 120,
      abc: "C",
      minStock: 10,
      maxStock: 80,
    });
    expect(sku.ok).toBe(true);
    if (!sku.ok) return;
    const blocked = deleteCategory(sku.snap, "horeca");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe("category_in_use");
    const sys = deleteCategory(snap, "frescos");
    expect(sys.ok).toBe(false);
    if (!sys.ok) expect(sys.error).toBe("system_category");
  });

  it("da de alta palet y ASN editables", () => {
    const snap = buildWmsSeed();
    const free = snap.slots.find((s) => s.siteId === "site-sev" && s.status === "libre" && s.aisle !== "M");
    expect(free).toBeDefined();
    const pal = createPallet(snap, {
      skuId: "sku-aceite",
      qty: 48,
      lot: "L26X1",
      expiry: null,
      siteId: "site-sev",
      slotId: free!.id,
      supplier: "Aceites del Sur",
    });
    expect(pal.ok).toBe(true);
    if (!pal.ok) return;
    expect(pal.snap.pallets[0]?.lot).toBe("L26X1");
    expect(pal.snap.slots.find((s) => s.id === free!.id)?.status).toBe("ocupado");

    const asn = createAsn(snap, {
      supplier: "Nuevo proveedor",
      eta: "2026-08-16T09:00:00.000Z",
      dock: "M-02",
      siteId: "site-sev",
      lines: 4,
      palletsExpected: 8,
    });
    expect(asn.ok).toBe(true);
    if (!asn.ok) return;
    const upd = updateAsn(asn.snap, asn.snap.inbound[0]!.id, { status: "en_muelle" });
    expect(upd.ok).toBe(true);
    if (upd.ok) expect(upd.snap.inbound[0]?.status).toBe("en_muelle");
  });

  it("contrata una plaza vacante y no fabrica huella biométrica", () => {
    const snap = buildWmsSeed();
    const vacant = snap.operators.find((o) => o.vacant && o.shift === "noche" && o.siteId === "site-sev");
    expect(vacant).toBeDefined();
    const hired = createOperator(snap, {
      vacantId: vacant!.id,
      name: "Plaza cubierta test",
      code: "OP-TEST-01",
      role: "picker",
      shift: "noche",
      siteId: "site-sev",
      costPerHour: 13,
      certifications: ["picking"],
    });
    expect(hired.ok).toBe(true);
    if (!hired.ok) return;
    const op = hired.snap.operators.find((o) => o.id === vacant!.id);
    expect(op?.vacant).toBe(false);
    expect(op?.active).toBe(true);
    expect(op?.fingerprintEnrolled).toBe(false);

    const pin = enrollOperatorPin(hired.snap, vacant!.id, "2580");
    expect(pin.ok).toBe(true);
    if (!pin.ok) return;
    const inPunch = clockWithPin(pin.snap, vacant!.id, "2580", "entrada", "2026-08-15T06:00:00.000Z");
    expect(inPunch.ok).toBe(true);
    const bad = clockWithPin(pin.snap, vacant!.id, "0000", "entrada");
    expect(bad.ok).toBe(false);
    const adapter = ingestAdapterPunch(pin.snap, {
      operatorId: vacant!.id,
      kind: "entrada",
      at: "2026-08-15T06:05:00.000Z",
      deviceId: "ZK-SEV-01",
    });
    expect(adapter.ok).toBe(true);
    if (adapter.ok) expect(adapter.snap.clockPunches[0]?.method).toBe("adapter");
  });

  it("omite o marca faltante en picking y avanza la línea", () => {
    const snap = buildWmsSeed();
    const wave = snap.pickWaves.find((w) => w.id === "wave-01")!;
    const line = nextOpenLine(wave)!;
    const skipped = skipPickLine(snap, wave.id, line.id);
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    const nextWave = skipped.snap.pickWaves.find((w) => w.id === wave.id)!;
    expect(nextWave.lines[0]?.status).toBe("omitida");
    expect(nextWave.lines[1]?.status).toBe("en_curso");

    const open = nextOpenLine(nextWave)!;
    const short = markShortage(skipped.snap, wave.id, open.id, 1);
    expect(short.ok).toBe(true);
    if (short.ok) {
      const w = short.snap.pickWaves.find((x) => x.id === wave.id)!;
      expect(w.lines.find((l) => l.id === open.id)?.status).toBe("faltante");
    }
  });

  it("ordena prioridades del día y las enlaza a olas por pedido", () => {
    const snap = buildWmsSeed();
    const ranked = rankDayPriorities(snap, "site-sev");
    expect(ranked.length).toBeGreaterThan(0);
    const firstOpen = ranked.find((r) => !r.done);
    expect(firstOpen).toBeDefined();
    expect(firstOpen!.score).toBeGreaterThan(0);
    const withWave = ranked.find((r) => r.order.code === "OUT-SEV-8841");
    expect(withWave?.waveCodes.length).toBeGreaterThan(0);
    expect(ranked.some((r) => r.reasonEs.includes("cut-off"))).toBe(true);
  });

  it("la batería solo cambia con reporte manual; el cargador no inventa %", () => {
    const snap = buildWmsSeed();
    const unit = snap.fleet.find((f) => f.id === "fl-01")!;
    expect(unit.batterySource).toBe("seed");
    const assigned = assignFleetCharger(snap, "fl-01", "chg-03");
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    const afterAssign = assigned.snap.fleet.find((f) => f.id === "fl-01")!;
    expect(afterAssign.batteryPct).toBe(unit.batteryPct);
    expect(afterAssign.batterySource).toBe("seed");
    const reported = reportFleetBattery(assigned.snap, "fl-01", 41, "2026-08-15T12:00:00.000Z");
    expect(reported.ok).toBe(true);
    if (!reported.ok) return;
    const after = reported.snap.fleet.find((f) => f.id === "fl-01")!;
    expect(after.batteryPct).toBe(41);
    expect(after.batterySource).toBe("manual");
    expect(snap.fleet.some((f) => f.kind === "toro")).toBe(true);
    expect(snap.fleet.some((f) => f.kind === "montacargas")).toBe(true);
    expect(snap.chargers.every((c) => c.telemetry === "none")).toBe(true);
  });
});
