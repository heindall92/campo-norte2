import { describe, expect, it } from "vitest";
import { parseBarcode } from "@/infrastructure/barcode";

describe("parseBarcode", () => {
  it("reconoce hueco Campo Norte", () => {
    const parsed = parseBarcode("a-03-02-1");
    expect(parsed.kind).toBe("slot");
    expect(parsed.slotCode).toBe("A-03-02-1");
  });

  it("extrae SSCC de 18 dígitos y AI 00", () => {
    expect(parseBarcode("003841009900000001").sscc).toBe("003841009900000001");
    expect(parseBarcode("(00)003841009900000001").kind).toBe("sscc");
    expect(parseBarcode("(00)003841009900000001").sscc).toBe("003841009900000001");
  });

  it("extrae GTIN, lote y caducidad GS1-128", () => {
    const parsed = parseBarcode("(01)08410000123456(17)250815(10)L26A");
    expect(parsed.gtin).toBe("08410000123456");
    expect(parsed.exp).toBe("250815");
    expect(parsed.lot).toBe("L26A");
  });

  it("no confunde cantidad corta con SSCC", () => {
    expect(parseBarcode("12").kind).toBe("qty");
    expect(parseBarcode("hola").kind).toBe("unknown");
  });
});
