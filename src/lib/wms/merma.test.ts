import { describe, expect, it } from "vitest";
import {
  buildWmsSeed,
  confirmPick,
  declareMerma,
  mermaToday,
  nextOpenLine,
} from "@/lib/wms";

describe("fase 16 · merma declarada", () => {
  it("baja el stock al declarar una caída y deja ver el faltante", () => {
    const snap = buildWmsSeed();
    const wave = snap.pickWaves.find((w) => w.id === "wave-01")!;
    const line = nextOpenLine(wave)!;
    const slot = snap.slots.find((s) => s.id === line.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === line.palletId)!;
    const before = pallet.qty;

    const silent = confirmPick(snap, "wave-01", line.id, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: 1,
    });
    expect(silent.ok).toBe(true);
    if (!silent.ok) return;
    expect(silent.snap.pallets.find((p) => p.id === pallet.id)?.qty).toBe(before - 1);

    const declared = declareMerma(
      snap,
      {
        sscc: pallet.sscc,
        fromSlotCode: slot.code,
        qty: 1,
        reason: "caida",
        note: "Caja al suelo",
        operatorId: "op-08",
      },
      "2026-08-15T11:20:00.000Z",
    );
    expect(declared.ok).toBe(true);
    if (!declared.ok) return;
    expect(declared.snap.pallets.find((p) => p.id === pallet.id)?.qty).toBe(before - 1);
    expect(declared.snap.mermaEvents[0]?.reason).toBe("caida");
    expect(declared.snap.mermaEvents[0]?.qty).toBe(1);
    expect(declared.snap.movements[0]?.note).toMatch(/Merma declarada/);

    const afterPick = confirmPick(declared.snap, "wave-01", line.id, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: 1,
    });
    expect(afterPick.ok).toBe(true);
    if (!afterPick.ok) return;
    expect(afterPick.snap.pallets.find((p) => p.id === pallet.id)?.qty).toBe(before - 2);
    expect(mermaToday(afterPick.snap, "site-sev")).toHaveLength(1);
  });

  it("no deja picar más de lo que queda tras la merma", () => {
    const snap = buildWmsSeed();
    const wave = snap.pickWaves.find((w) => w.id === "wave-01")!;
    const line = nextOpenLine(wave)!;
    const slot = snap.slots.find((s) => s.id === line.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === line.palletId)!;
    const merma = declareMerma(
      snap,
      {
        sscc: pallet.sscc,
        fromSlotCode: slot.code,
        qty: pallet.qty,
        reason: "rota",
        operatorId: "op-02",
      },
      "2026-08-15T11:21:00.000Z",
    );
    expect(merma.ok).toBe(true);
    if (!merma.ok) return;
    expect(merma.snap.pallets.find((p) => p.id === pallet.id)?.qty).toBe(0);
    expect(merma.snap.slots.find((s) => s.id === slot.id)?.palletId).toBeNull();
    const pick = confirmPick(merma.snap, "wave-01", line.id, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: 1,
    });
    expect(pick.ok).toBe(false);
    if (!pick.ok) expect(pick.error).toBe("invalid_qty");
  });

  it("no inventa el área de merma: el hueco destino tiene que existir", () => {
    const snap = buildWmsSeed();
    const pallet = snap.pallets.find((p) => p.status === "en_ubicacion" && p.qty > 0 && p.slotId)!;
    const from = snap.slots.find((s) => s.id === pallet.slotId)!;
    const bad = declareMerma(snap, {
      sscc: pallet.sscc,
      fromSlotCode: from.code,
      qty: 1,
      reason: "otra",
      mermaSlotCode: "Z-99-01-1",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe("merma_slot");
  });
});
