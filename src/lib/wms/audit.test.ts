import { describe, expect, it } from "vitest";
import { appendAuditLog, listAuditLogs } from "./audit";
import { buildWmsSeed } from "./seed";

describe("wms audit log", () => {
  it("añade un log y no exporta borrado", () => {
    const snap = buildWmsSeed();
    expect(snap.auditLogs).toEqual([]);
    const next = appendAuditLog(snap, {
      actorId: "op-08",
      warehouseId: "site-sev",
      action: "confirm_pick",
      entity: "pick_line",
      entityId: "pl-1",
      beforeData: { status: "en_curso" },
      afterData: { status: "picada", qty: 6 },
      reason: "picado en pasillo",
      deviceId: null,
      correlationId: "corr-1",
      timestamp: "2026-08-15T10:00:00.000Z",
      id: "aud-1",
    });
    expect(next.auditLogs).toHaveLength(1);
    expect(next.auditLogs[0]?.organizationId).toBe(snap.org.id);
    expect(next.auditLogs[0]?.correlationId).toBe("corr-1");
    expect(listAuditLogs(next, "site-sev")).toHaveLength(1);
  });

  it("no exporta borrado de logs", async () => {
    const mod = await import("./audit");
    expect("deleteAuditLog" in mod).toBe(false);
    expect("removeAuditLog" in mod).toBe(false);
  });
});
