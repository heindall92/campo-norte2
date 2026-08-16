import { wmsUid } from "./ids";
import type { DockAppointment, WmsSnapshot } from "./types";
import { appendAudit } from "./audit";

export type DockError = "overlap" | "invalid_window" | "dock_missing" | "site_missing";

function appointmentsOf(snap: WmsSnapshot): DockAppointment[] {
  return snap.dockAppointments ?? [];
}

export function dockCalendar(snap: WmsSnapshot, siteId: string, dayIso: string): DockAppointment[] {
  const day = dayIso.slice(0, 10);
  return appointmentsOf(snap)
    .filter((a) => a.siteId === siteId && a.start.slice(0, 10) === day)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function bookDockAppointment(
  snap: WmsSnapshot,
  input: {
    siteId: string;
    dockCode: string;
    kind: DockAppointment["kind"];
    start: string;
    end: string;
    orderId?: string | null;
    asnId?: string | null;
  },
): { ok: true; snap: WmsSnapshot; id: string } | { ok: false; error: DockError } {
  if (!snap.sites.some((s) => s.id === input.siteId)) return { ok: false, error: "site_missing" };
  const start = new Date(input.start).getTime();
  const end = new Date(input.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { ok: false, error: "invalid_window" };
  }
  const dockExists = snap.slots.some(
    (s) => s.siteId === input.siteId && s.zone === "muelle" && s.code.startsWith(input.dockCode.split("-")[0] ?? input.dockCode),
  );
  if (!dockExists && !input.dockCode.trim()) return { ok: false, error: "dock_missing" };

  const overlap = appointmentsOf(snap).some((a) => {
    if (a.siteId !== input.siteId || a.dockCode !== input.dockCode) return false;
    if (a.status === "done" || a.status === "no_show") return false;
    const aStart = new Date(a.start).getTime();
    const aEnd = new Date(a.end).getTime();
    return start < aEnd && end > aStart;
  });
  if (overlap) return { ok: false, error: "overlap" };

  const row: DockAppointment = {
    id: wmsUid("dock"),
    siteId: input.siteId,
    dockCode: input.dockCode.trim(),
    kind: input.kind,
    orderId: input.orderId ?? null,
    asnId: input.asnId ?? null,
    start: new Date(input.start).toISOString(),
    end: new Date(input.end).toISOString(),
    status: "booked",
  };
  const next = { ...snap, dockAppointments: [row, ...appointmentsOf(snap)] };
  return {
    ok: true,
    id: row.id,
    snap: appendAudit(next, {
      actorId: null,
      action: "dock.book",
      entityType: "dock_appointment",
      entityId: row.id,
      after: row.dockCode,
    }),
  };
}
