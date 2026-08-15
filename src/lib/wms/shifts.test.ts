import { describe, expect, it } from "vitest";
import { computeShiftCoverage } from "./economics";
import { applyShiftMoves, assignOperatorShift, proposeShiftFills } from "./shifts";
import { buildWmsSeed } from "./seed";

describe("wms shift assignment", () => {
  it("proposes filling Sevilla night picker from morning surplus", () => {
    const snap = buildWmsSeed();
    const before = computeShiftCoverage(snap, "site-sev");
    const nightPicker = before.gaps.find((g) => g.shift === "noche" && g.role === "picker");
    expect(nightPicker?.gap).toBeLessThan(0);

    const moves = proposeShiftFills(snap, "site-sev");
    expect(moves.some((m) => m.role === "picker" && m.toShift === "noche")).toBe(true);
    expect(moves.some((m) => m.role === "carretillero" && m.toShift === "tarde")).toBe(true);

    const next = applyShiftMoves(snap, moves);
    const after = computeShiftCoverage(next, "site-sev");
    expect(after.gaps.find((g) => g.shift === "noche" && g.role === "picker")?.gap).toBeGreaterThanOrEqual(0);
    expect(after.gaps.find((g) => g.shift === "tarde" && g.role === "carretillero")?.gap).toBeGreaterThanOrEqual(0);
    expect(after.gaps.find((g) => g.shift === "manana" && g.role === "picker")?.gap).toBeGreaterThanOrEqual(0);
    expect(after.gaps.find((g) => g.shift === "manana" && g.role === "carretillero")?.gap).toBeGreaterThanOrEqual(0);
  });

  it("does not steal below minimum from the donor shift", () => {
    const snap = buildWmsSeed();
    const next = applyShiftMoves(snap, proposeShiftFills(snap, "site-sev"));
    const after = computeShiftCoverage(next, "site-sev");
    const morningPickers = after.gaps.find((g) => g.shift === "manana" && g.role === "picker");
    expect(morningPickers).toBeDefined();
    expect(morningPickers!.actual).toBeGreaterThanOrEqual(morningPickers!.required);
  });

  it("assigns a single operator to another shift", () => {
    const snap = buildWmsSeed();
    const result = assignOperatorShift(snap, "op-13", "noche");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const diego = result.snap.operators.find((o) => o.id === "op-13");
    expect(diego?.shift).toBe("noche");
    expect(snap.operators.find((o) => o.id === "op-13")?.shift).toBe("manana");
  });

  it("rejects missing operators", () => {
    const result = assignOperatorShift(buildWmsSeed(), "op-missing", "tarde");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("operator_missing");
  });
});
