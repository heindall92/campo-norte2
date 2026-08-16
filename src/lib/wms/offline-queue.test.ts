import { describe, expect, it } from "vitest";
import { enqueueOfflineEvent, pendingOfflineEvents, syncOfflineQueue, type OfflineRfEvent } from "./offline-queue";

function ev(id: string): Omit<OfflineRfEvent, "status" | "conflictReason"> {
  return {
    id,
    at: "2026-08-15T10:00:00.000Z",
    kind: "confirm_pick",
    entity: "pick_line",
    entityId: "pl-1",
    payload: { qty: 6 },
    correlationId: `c-${id}`,
  };
}

describe("offline RF queue", () => {
  it("guarda en cola y no sincroniza sin red", () => {
    const queued = enqueueOfflineEvent(ev("e1"), []);
    expect(pendingOfflineEvents(queued)).toHaveLength(1);
    const still = syncOfflineQueue(queued, () => ({ ok: true }), false);
    expect(still[0]?.status).toBe("queued");
  });

  it("al volver: synced o conflict según el apply, sin inventar stock", () => {
    const store = enqueueOfflineEvent(ev("e2"), []);
    const ok = syncOfflineQueue(store, () => ({ ok: true }), true);
    expect(ok[0]?.status).toBe("synced");
    const bad = syncOfflineQueue(store, () => ({ ok: false, reason: "wrong_sscc" }), true);
    expect(bad[0]?.status).toBe("conflict");
    expect(bad[0]?.conflictReason).toBe("wrong_sscc");
  });
});
