import { describe, expect, it } from "vitest";
import {
  computeProductivity,
  estimateSlotDistanceM,
  listOperatorPii,
  productivityHasPii,
} from "./productivity";
import { buildWmsSeed } from "./seed";

describe("wms productivity", () => {
  it("estima distancia por hueco, no por GPS", () => {
    expect(estimateSlotDistanceM("A-01-01-1", "A-03-01-1")).toBe(6);
    expect(estimateSlotDistanceM("A-01-01-1", "B-01-01-1")).toBe(20);
  });

  it("rollup por código/rol/turno/zona, sin nombre ni PIN", () => {
    const snap = buildWmsSeed();
    const rows = computeProductivity(snap, "site-sev");
    expect(rows.some((r) => r.subject === "picker")).toBe(true);
    expect(rows.some((r) => r.subject === "warehouse")).toBe(true);
    expect(rows.some((r) => r.subject === "shift" && r.subjectId === "manana")).toBe(true);
    for (const row of rows) {
      expect(productivityHasPii(row)).toBe(false);
      expect(row.subjectId).not.toMatch(/Navarro|Peña|hash/);
    }
    const pii = listOperatorPii(snap);
    expect(pii.some((p) => p.name.includes(" "))).toBe(true);
    expect(rows.every((r) => !pii.some((p) => p.name === r.subjectId))).toBe(true);
  });
});
