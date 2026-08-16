import { describe, expect, it } from "vitest";
import { gs1CheckDigitOk, parseBarcode } from "./parse";

describe("gs1 barcode parser", () => {
  it("EAN-13 y SSCC de 18 dígitos", () => {
    const ean = parseBarcode("8412345678905");
    expect(ean.symbology).toBe("EAN-13");
    expect(ean.gtin).toBe("8412345678905");
    expect(ean.sscc).toBeNull();

    const sscc = parseBarcode("003841009900000001");
    expect(sscc.symbology).toBe("SSCC");
    expect(sscc.sscc).toBe("003841009900000001");
  });

  it("extrae GTIN LOT EXP SERIAL de GS1-128", () => {
    const parsed = parseBarcode("(01)08412345678905(17)260820(10)L26A1(21)SN99");
    expect(parsed.gtin).toBe("08412345678905");
    expect(parsed.lot).toBe("L26A1");
    expect(parsed.exp).toBe("2026-08-20");
    expect(parsed.serial).toBe("SN99");
  });

  it("no inventa campos que no vienen en el código", () => {
    const parsed = parseBarcode("(00)003841009900000001");
    expect(parsed.sscc).toBe("003841009900000001");
    expect(parsed.gtin).toBeNull();
    expect(parsed.lot).toBeNull();
    expect(parsed.exp).toBeNull();
  });

  it("valida dígito de control GS1", () => {
    expect(gs1CheckDigitOk("4006381333931")).toBe(true);
    expect(gs1CheckDigitOk("4006381333932")).toBe(false);
  });
});
