import { describe, expect, it } from "vitest";
import { classifyLotAlert, selectLot, type LotCandidate } from "./lots";

const now = Date.parse("2026-08-15T11:00:00.000Z");

function lot(partial: Partial<LotCandidate> & Pick<LotCandidate, "id" | "lot">): LotCandidate {
  return {
    batchCode: partial.lot,
    qty: 10,
    receivedAt: "2026-08-01T00:00:00.000Z",
    expiry: null,
    manufacturedAt: null,
    blocked: false,
    ...partial,
  };
}

describe("lot policy", () => {
  it("FEFO elige la caducidad más cercana y no caducada", () => {
    const picked = selectLot(
      [
        lot({ id: "a", lot: "L-FAR", expiry: "2026-12-01", receivedAt: "2026-07-01T00:00:00.000Z" }),
        lot({ id: "b", lot: "L-NEAR", expiry: "2026-08-20", receivedAt: "2026-08-10T00:00:00.000Z" }),
        lot({ id: "c", lot: "L-DEAD", expiry: "2026-08-01", receivedAt: "2026-06-01T00:00:00.000Z" }),
      ],
      "FEFO",
      now,
    );
    expect(picked?.id).toBe("b");
  });

  it("FIFO / LIFO usan receivedAt; MANUAL exige el id", () => {
    const rows = [
      lot({ id: "old", lot: "1", receivedAt: "2026-01-01T00:00:00.000Z" }),
      lot({ id: "new", lot: "2", receivedAt: "2026-08-01T00:00:00.000Z" }),
    ];
    expect(selectLot(rows, "FIFO", now)?.id).toBe("old");
    expect(selectLot(rows, "LIFO", now)?.id).toBe("new");
    expect(selectLot(rows, "MANUAL", now)).toBeNull();
    expect(selectLot(rows, "MANUAL", now, "new")?.id).toBe("new");
  });

  it("clasifica EXPIRING_SOON, EXPIRED y BLOCKED", () => {
    expect(classifyLotAlert(lot({ id: "x", lot: "E", expiry: "2026-08-10" }), now)).toBe("EXPIRED");
    expect(classifyLotAlert(lot({ id: "y", lot: "S", expiry: "2026-08-18" }), now)).toBe("EXPIRING_SOON");
    expect(classifyLotAlert(lot({ id: "z", lot: "B", blocked: true }), now)).toBe("BLOCKED");
  });
});
