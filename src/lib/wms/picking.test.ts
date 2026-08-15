import { describe, expect, it } from "vitest";
import { confirmPick, nextOpenLine, recommendedFleetKind } from "./picking";
import { buildWmsSeed } from "./seed";

describe("wms picking flow", () => {
  it("walks ticket → slot scan → SSCC → qty → next line", () => {
    const snap = buildWmsSeed();
    const wave = snap.pickWaves.find((w) => w.id === "wave-01");
    expect(wave).toBeDefined();
    const line = nextOpenLine(wave!);
    expect(line).not.toBeNull();
    const slot = snap.slots.find((s) => s.id === line!.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === line!.palletId)!;

    const wrongSlot = confirmPick(snap, wave!.id, line!.id, {
      slotCode: "Z-99-01-1",
      sscc: pallet.sscc,
      qty: line!.qty,
    });
    expect(wrongSlot.ok).toBe(false);
    if (!wrongSlot.ok) expect(wrongSlot.error).toBe("wrong_slot");

    const wrongSscc = confirmPick(snap, wave!.id, line!.id, {
      slotCode: slot.code,
      sscc: "000000000000000000",
      qty: line!.qty,
    });
    expect(wrongSscc.ok).toBe(false);
    if (!wrongSscc.ok) expect(wrongSscc.error).toBe("wrong_sscc");

    const ok = confirmPick(snap, wave!.id, line!.id, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: line!.qty,
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const nextWave = ok.snap.pickWaves.find((w) => w.id === wave!.id)!;
    expect(nextWave.lines[0]?.status).toBe("picada");
    expect(nextWave.lines[1]?.status).toBe("en_curso");
    expect(nextWave.status).toBe("en_curso");
    expect(ok.snap.movements[0]?.type).toBe("salida");
  });

  it("assigns stand-up double reach to replenishment waves", () => {
    expect(recommendedFleetKind("reposicion")).toBe("retractil_doble");
    expect(recommendedFleetKind("picking")).toBe("recogepedidos");
    const snap = buildWmsSeed();
    const repo = snap.pickWaves.find((w) => w.kind === "reposicion");
    expect(repo).toBeDefined();
    const fleet = snap.fleet.find((f) => f.id === repo!.fleetId);
    expect(fleet?.kind).toBe("retractil_doble");
  });
});
