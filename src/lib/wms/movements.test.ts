import { describe, expect, it } from "vitest";
import { applyReplenishment, confirmPutaway, confirmTransfer, proposeReplenishments } from "./movements";
import { buildWmsSeed } from "./seed";

describe("wms live movements", () => {
  it("putaway: dock SSCC → empty slot", () => {
    const snap = buildWmsSeed();
    const dockPal = snap.pallets.find((p) => p.status === "muelle");
    const dock = dockPal?.slotId ? snap.slots.find((s) => s.id === dockPal.slotId) : null;
    const dest = snap.slots.find(
      (s) => s.siteId === dockPal?.siteId && s.aisle === "A" && s.status === "libre" && !s.pickFace,
    );
    expect(dockPal && dock && dest).toBeTruthy();
    const ok = confirmPutaway(snap, {
      sscc: dockPal!.sscc,
      fromSlotCode: dock!.code,
      toSlotCode: dest!.code,
      operatorId: "op-02",
      fleetId: "fl-07",
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const moved = ok.snap.pallets.find((p) => p.id === dockPal!.id);
    expect(moved?.slotId).toBe(dest!.id);
    expect(moved?.status).toBe("en_ubicacion");
    expect(ok.snap.movements[0]?.type).toBe("entrada");
  });

  it("rejects transfer to occupied or blocked slot", () => {
    const snap = buildWmsSeed();
    const from = snap.slots.find((s) => s.palletId && s.aisle === "B" && s.siteId === "site-sev")!;
    const pallet = snap.pallets.find((p) => p.id === from.palletId)!;
    const occupied = snap.slots.find(
      (s) => s.palletId && s.id !== from.id && s.siteId === from.siteId,
    )!;
    const blocked = snap.slots.find((s) => s.status === "bloqueado" && s.siteId === from.siteId)!;
    const badOcc = confirmTransfer(snap, {
      sscc: pallet.sscc,
      fromSlotCode: from.code,
      toSlotCode: occupied.code,
    });
    expect(badOcc.ok).toBe(false);
    if (!badOcc.ok) expect(badOcc.error).toBe("slot_occupied");
    if (blocked) {
      const badBlk = confirmTransfer(snap, {
        sscc: pallet.sscc,
        fromSlotCode: from.code,
        toSlotCode: blocked.code,
      });
      expect(badBlk.ok).toBe(false);
    }
  });

  it("proposes double-reach replenishment when pick face is empty", () => {
    const snap = buildWmsSeed();
    const proposals = proposeReplenishments(snap);
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals[0]?.recommendedFleetKind).toBe("retractil_doble");
    const applied = applyReplenishment(snap, proposals[0]!, "fl-07", "op-02");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const to = applied.snap.slots.find((s) => s.id === proposals[0]!.toSlotId);
    expect(to?.pickFace).toBe(true);
    expect(to?.palletId).toBe(proposals[0]!.palletId);
  });
});
