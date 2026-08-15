import { describe, expect, it } from "vitest";
import {
  codesEqual,
  formatSlotCode,
  isPickFaceLevel,
  parseSlotCode,
  slotRecordId,
} from "./location";

describe("wms location model", () => {
  it("formats Pasillo-Bahía-Nivel-Posición", () => {
    expect(
      formatSlotCode({ aisle: "a", bay: 3, level: 2, position: 1 }),
    ).toBe("A-03-02-1");
  });

  it("parses a valid slot code", () => {
    expect(parseSlotCode("A-03-02-1")).toEqual({
      aisle: "A",
      bay: 3,
      level: 2,
      position: 1,
    });
  });

  it("rejects malformed codes", () => {
    expect(parseSlotCode("A-03-02")).toBeNull();
    expect(parseSlotCode("A-3-2-1")).toBeNull();
    expect(parseSlotCode("A-03-02-3")).toBeNull();
  });

  it("treats level 1 as pick face and upper as reserve", () => {
    expect(isPickFaceLevel(1, "seco")).toBe(true);
    expect(isPickFaceLevel(2, "seco")).toBe(false);
    expect(isPickFaceLevel(1, "muelle")).toBe(false);
  });

  it("namespaces slot ids by site to avoid Sevilla/Huelva collisions", () => {
    expect(slotRecordId("site-sev", "M-01-01-1")).not.toBe(
      slotRecordId("site-hue", "M-01-01-1"),
    );
  });

  it("compares scan codes case-insensitively", () => {
    expect(codesEqual("a-03-02-1", "A-03-02-1")).toBe(true);
  });
});
