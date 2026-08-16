import { describe, expect, it } from "vitest";
import { conversionsForSku, fromBaseQty, toBaseQty } from "./uom";

describe("UOM conversions", () => {
  const conv = conversionsForSku({ uom: "caja", unitsPerPallet: 48, unitsPerCase: 12 });

  it("1 CASE = 12 UNIT", () => {
    expect(toBaseQty(1, "CASE", conv)).toBe(12);
    expect(toBaseQty(1, "caja", conv)).toBe(12);
  });

  it("1 PALLET = 48 CASE = 576 UNIT", () => {
    expect(toBaseQty(1, "PALLET", conv)).toBe(576);
    expect(fromBaseQty(576, "CASE", conv)).toBe(48);
  });

  it("rechaza UOM desconocida", () => {
    expect(toBaseQty(1, "TON", conv)).toBeNull();
  });
});
