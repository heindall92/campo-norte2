import { wmsUid } from "./ids";
import type { YardVisit, WmsSnapshot } from "./types";
import { appendAudit } from "./audit";

export type YardError = "invalid_plate" | "visit_missing" | "already_out";

export function checkInVehicle(
  snap: WmsSnapshot,
  input: { siteId: string; plate: string; dockCode?: string | null },
  at = "2026-08-15T08:00:00.000Z",
): { ok: true; snap: WmsSnapshot; id: string } | { ok: false; error: YardError } {
  const plate = input.plate.trim().toUpperCase();
  if (plate.length < 3) return { ok: false, error: "invalid_plate" };
  const row: YardVisit = {
    id: wmsUid("yard"),
    siteId: input.siteId,
    plate,
    dockCode: input.dockCode ?? null,
    status: input.dockCode ? "at_dock" : "in_yard",
    checkedInAt: at,
    checkedOutAt: null,
  };
  const next = { ...snap, yardVisits: [row, ...(snap.yardVisits ?? [])] };
  return {
    ok: true,
    id: row.id,
    snap: appendAudit(next, {
      at,
      actorId: null,
      action: "yard.checkin",
      entityType: "yard_visit",
      entityId: row.id,
      after: plate,
    }),
  };
}

export function checkOutVehicle(
  snap: WmsSnapshot,
  visitId: string,
  at = "2026-08-15T18:00:00.000Z",
): { ok: true; snap: WmsSnapshot } | { ok: false; error: YardError } {
  const visit = (snap.yardVisits ?? []).find((v) => v.id === visitId);
  if (!visit) return { ok: false, error: "visit_missing" };
  if (visit.status === "departed") return { ok: false, error: "already_out" };
  return {
    ok: true,
    snap: {
      ...snap,
      yardVisits: (snap.yardVisits ?? []).map((v) =>
        v.id === visitId ? { ...v, status: "departed" as const, checkedOutAt: at } : v,
      ),
    },
  };
}
