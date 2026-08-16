import { describe, expect, it } from "vitest";
import { applyRfScan, buildRfQueue, classifyScan, confirmRfTask, operatorForAppUser, startRfSession } from "./rf";
import { nextOpenLine } from "./picking";
import { buildWmsSeed } from "./seed";

describe("wms RF gun", () => {
  it("classifies slot codes vs SSCC vs qty without guessing", () => {
    expect(classifyScan("A-03-02-1").kind).toBe("slot");
    expect(classifyScan("003841009900000001").kind).toBe("sscc");
    expect(classifyScan("(00)003841009900000001").kind).toBe("sscc");
    expect(classifyScan("12").kind).toBe("qty");
    expect(classifyScan("hola").kind).toBe("unknown");
  });

  it("builds the queue only from live snapshot rows", () => {
    const snap = buildWmsSeed();
    const queue = buildRfQueue(snap, "site-sev");
    expect(queue.some((t) => t.kind === "pick")).toBe(true);
    expect(queue.some((t) => t.kind === "putaway")).toBe(true);
    for (const task of queue) {
      expect(snap.pallets.some((p) => p.sscc === task.sscc)).toBe(true);
      expect(snap.slots.some((s) => s.code === task.fromCode && s.siteId === task.siteId)).toBe(true);
    }
  });

  it("confirms a pick only after matching the real slot and SSCC", () => {
    const snap = buildWmsSeed();
    const wave = snap.pickWaves.find((w) => w.id === "wave-01")!;
    const line = nextOpenLine(wave)!;
    const task = buildRfQueue(snap, "site-sev").find((t) => t.lineId === line.id)!;
    let session = startRfSession(task);

    const bad = applyRfScan(session, "Z-99-01-1");
    expect(bad.ok).toBe(false);

    const a = applyRfScan(session, task.fromCode);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    session = a.session;
    const b = applyRfScan(session, task.sscc);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    session = b.session;
    const c = applyRfScan(session, String(task.qty));
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    session = c.session;
    expect(session.step).toBe("ready");

    const done = confirmRfTask(snap, session, "op-03");
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    const nextWave = done.snap.pickWaves.find((w) => w.id === "wave-01")!;
    expect(nextWave.lines.find((l) => l.id === line.id)?.status).toBe("picada");
  });

  it("maps the logged-in user to an operator only by exact name", () => {
    const snap = buildWmsSeed();
    expect(operatorForAppUser(snap, { name: "Jorge Peña" })?.id).toBe("op-08");
    expect(operatorForAppUser(snap, { name: "Nadie Inventado" })).toBeNull();
  });
});
