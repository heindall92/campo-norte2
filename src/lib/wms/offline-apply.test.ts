import { describe, expect, it } from "vitest";
import { applyOfflineRfEvent } from "./offline-apply";
import type { OfflineRfEvent } from "./offline-queue";
import { nextOpenLine } from "./picking";
import { buildRfQueue } from "./rf";
import { buildWmsSeed } from "./seed";

function eventForOpenPick(): { snap: ReturnType<typeof buildWmsSeed>; event: OfflineRfEvent } {
  const snap = buildWmsSeed();
  const wave = snap.pickWaves.find((w) => w.id === "wave-01")!;
  const line = nextOpenLine(wave)!;
  const task = buildRfQueue(snap, "site-sev").find((t) => t.lineId === line.id)!;
  return {
    snap,
    event: {
      id: "off-1",
      at: "2026-08-15T10:05:00.000Z",
      kind: "confirm_pick",
      entity: "pick",
      entityId: line.id,
      payload: {
        qty: task.qty,
        sscc: task.sscc,
        from: task.fromCode,
        siteId: task.siteId,
        taskId: task.id,
        deviceId: "dev-test",
      },
      correlationId: "corr-off-1",
      status: "queued",
      conflictReason: null,
    },
  };
}

describe("apply offline RF event", () => {
  it("confirma el pick real al volver y no inventa stock", () => {
    const { snap, event } = eventForOpenPick();
    const applied = applyOfflineRfEvent(snap, event, "op-03");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const line = applied.snap.pickWaves
      .find((w) => w.id === "wave-01")!
      .lines.find((l) => l.id === event.entityId);
    expect(line?.status).toBe("picada");
    expect(applied.snap.auditLogs[0]?.action).toBe("rf.confirm.sync");
  });

  it("marca conflicto si la línea ya no está abierta", () => {
    const { snap, event } = eventForOpenPick();
    const first = applyOfflineRfEvent(snap, event, "op-03");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyOfflineRfEvent(first.snap, event, "op-03");
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toMatch(/task_stale|line_not_open/);
  });
});
