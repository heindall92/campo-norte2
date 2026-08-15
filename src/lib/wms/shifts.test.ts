import { describe, expect, it } from "vitest";
import { computeShiftCoverage } from "./economics";
import { applyShiftMoves, assignOperatorShift, proposeShiftFills } from "./shifts";
import { buildWmsSeed } from "./seed";

describe("wms shift assignment", () => {
  it("does not invent people: no surplus means no auto-fill", () => {
    const snap = buildWmsSeed();
    const before = computeShiftCoverage(snap, "site-sev");
    const nightPicker = before.gaps.find((g) => g.shift === "noche" && g.role === "picker");
    expect(nightPicker?.gap).toBeLessThan(0);
    expect(proposeShiftFills(snap, "site-sev")).toEqual([]);
  });

  it("does not move anyone when there is no surplus", () => {
    const snap = buildWmsSeed();
    const next = applyShiftMoves(snap, proposeShiftFills(snap, "site-sev"));
    expect(next.operators.map((o) => o.shift)).toEqual(snap.operators.map((o) => o.shift));
  });

  it("assigns an existing operator to another shift", () => {
    const snap = buildWmsSeed();
    const result = assignOperatorShift(snap, "op-08", "noche");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snap.operators.find((o) => o.id === "op-08")?.shift).toBe("noche");
    expect(snap.operators.find((o) => o.id === "op-08")?.shift).toBe("tarde");
  });

  it("rejects missing operators", () => {
    const result = assignOperatorShift(buildWmsSeed(), "op-missing", "tarde");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("operator_missing");
  });
});
