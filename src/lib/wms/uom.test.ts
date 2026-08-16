import { describe, expect, it } from "vitest";
import { convertUom, EXAMPLE_CASE_PALLET, factorsFromSku, toBase } from "./uom";
import { buildWmsSeed } from "./seed";

describe("uom conversions", () => {
  it("1 CASE = 12 UNIT y 1 PALLET = 48 CASE cuando la tabla lo dice", () => {
    const caseToUnit = convertUom(1, "CASE", "UNIT", EXAMPLE_CASE_PALLET);
    expect(caseToUnit).toEqual({ ok: true, qty: 12, uom: "UNIT" });
    const palletToCase = convertUom(1, "PALLET", "CASE", EXAMPLE_CASE_PALLET);
    expect(palletToCase).toEqual({ ok: true, qty: 48, uom: "CASE" });
    const palletToUnit = toBase(1, "PALLET", "UNIT", EXAMPLE_CASE_PALLET);
    expect(palletToUnit.ok).toBe(false);
    if (!palletToUnit.ok) expect(palletToUnit.error).toBe("no_factor");
    const twoHop = convertUom(1, "PALLET", "UNIT", [
      ...EXAMPLE_CASE_PALLET,
      { skuId: null, from: "PALLET", to: "UNIT", factor: 48 * 12 },
    ]);
    expect(twoHop).toEqual({ ok: true, qty: 576, uom: "UNIT" });
  });

  it("no inventa el inner pack del aceite: solo palet → caja", () => {
    const snap = buildWmsSeed();
    const aceite = snap.skus.find((s) => s.id === "sku-aceite")!;
    const table = factorsFromSku(aceite);
    const ok = convertUom(1, "PALLET", "CASE", table, aceite.id);
    expect(ok).toEqual({ ok: true, qty: aceite.unitsPerPallet, uom: "CASE" });
    const missing = convertUom(1, "CASE", "UNIT", table, aceite.id);
    expect(missing.ok).toBe(false);
  });
});
