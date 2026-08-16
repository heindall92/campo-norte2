import { WMS_DEMO_NOW } from "./alerts";
import { dockWindowFor } from "./carriers";
import type { Dock, DockAppointment, DockEvent, DockEventKind, WmsSnapshot } from "./types";
import { DOCK_EVENT_KINDS } from "./types";

export type DockError =
  | "site_missing"
  | "code_required"
  | "name_required"
  | "dock_dup"
  | "dock_missing"
  | "invalid_capacity"
  | "invalid_window"
  | "order_missing"
  | "order_done"
  | "asn_missing"
  | "ref_required"
  | "dock_busy"
  | "appointment_missing"
  | "appointment_cancelled"
  | "event_invalid";

export type DockResult =
  | { ok: true; snap: WmsSnapshot; dockId?: string; appointmentId?: string; eventId?: string }
  | { ok: false; error: DockError };

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const DOCK_EVENT_LABEL: Record<DockEventKind, { es: string; en: string }> = {
  arrival: { es: "Llegada", en: "Arrival" },
  check_in: { es: "Check-in", en: "Check-in" },
  assignment: { es: "Asignación", en: "Assignment" },
  load: { es: "Carga", en: "Load" },
  unload: { es: "Descarga", en: "Unload" },
  departure: { es: "Salida", en: "Departure" },
};

export function windowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = Date.parse(aStart);
  const ae = Date.parse(aEnd);
  const bs = Date.parse(bStart);
  const be = Date.parse(bEnd);
  if (![as, ae, bs, be].every(Number.isFinite)) return false;
  return as < be && bs < ae;
}

export function activeAppointments(snap: WmsSnapshot, dockId?: string): DockAppointment[] {
  return (snap.dockAppointments ?? []).filter((a) => !a.cancelledAt && (!dockId || a.dockId === dockId));
}

export function overlappingAppointments(
  snap: WmsSnapshot,
  dockId: string,
  windowStart: string,
  windowEnd: string,
  exceptId?: string,
): DockAppointment[] {
  return activeAppointments(snap, dockId).filter(
    (a) => a.id !== exceptId && windowsOverlap(a.windowStart, a.windowEnd, windowStart, windowEnd),
  );
}

/** Si capacity no está escrita, no se inventa cupo 1: siempre cabe. */
export function dockAcceptsOverlap(dock: Dock, overlappingCount: number): boolean {
  if (dock.capacity == null) return true;
  return overlappingCount < dock.capacity;
}

export function addDock(
  snap: WmsSnapshot,
  input: { warehouseId: string; code: string; name: string; capacity?: number | null },
  at = WMS_DEMO_NOW,
): DockResult {
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) return { ok: false, error: "code_required" };
  if (!name) return { ok: false, error: "name_required" };
  if (!snap.sites.some((s) => s.id === input.warehouseId)) return { ok: false, error: "site_missing" };
  if ((snap.docks ?? []).some((d) => d.warehouseId === input.warehouseId && d.code.toUpperCase() === code.toUpperCase())) {
    return { ok: false, error: "dock_dup" };
  }
  let capacity: number | null = null;
  if (input.capacity != null) {
    if (!Number.isInteger(input.capacity) || input.capacity < 0) return { ok: false, error: "invalid_capacity" };
    capacity = input.capacity;
  }
  const dock: Dock = {
    id: uid("dock"),
    warehouseId: input.warehouseId,
    code,
    name,
    capacity,
    createdAt: at,
  };
  return { ok: true, dockId: dock.id, snap: { ...snap, docks: [dock, ...(snap.docks ?? [])] } };
}

function validWindow(start: string, end: string): boolean {
  const s = Date.parse(start);
  const e = Date.parse(end);
  return Number.isFinite(s) && Number.isFinite(e) && s < e;
}

export function openDockAppointment(
  snap: WmsSnapshot,
  input: {
    dockId: string;
    orderId?: string | null;
    asnId?: string | null;
    windowStart?: string | null;
    windowEnd?: string | null;
    operatorId?: string | null;
  },
  at = WMS_DEMO_NOW,
): DockResult {
  const dock = (snap.docks ?? []).find((d) => d.id === input.dockId);
  if (!dock) return { ok: false, error: "dock_missing" };
  const orderId = input.orderId?.trim() || null;
  const asnId = input.asnId?.trim() || null;
  if (!orderId && !asnId) return { ok: false, error: "ref_required" };

  let windowStart = input.windowStart?.trim() || "";
  let windowEnd = input.windowEnd?.trim() || "";
  let nextSnap = snap;

  if (orderId) {
    const order = snap.outbound.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: "order_missing" };
    if (order.status === "expedido") return { ok: false, error: "order_done" };
    if (order.siteId !== dock.warehouseId) return { ok: false, error: "site_missing" };
    if (!windowStart || !windowEnd) {
      windowStart = order.dockWindowStart ?? dockWindowFor(order.cutOff).start;
      windowEnd = order.dockWindowEnd ?? dockWindowFor(order.cutOff).end;
    }
    nextSnap = {
      ...snap,
      outbound: snap.outbound.map((o) => (o.id === orderId ? { ...o, dock: dock.code } : o)),
    };
  }
  if (asnId) {
    const asn = snap.inbound.find((a) => a.id === asnId);
    if (!asn) return { ok: false, error: "asn_missing" };
    if (asn.siteId !== dock.warehouseId) return { ok: false, error: "site_missing" };
  }
  if (!validWindow(windowStart, windowEnd)) return { ok: false, error: "invalid_window" };

  const overlapping = overlappingAppointments(nextSnap, dock.id, windowStart, windowEnd);
  if (!dockAcceptsOverlap(dock, overlapping.length)) return { ok: false, error: "dock_busy" };

  const appointment: DockAppointment = {
    id: uid("dapt"),
    dockId: dock.id,
    warehouseId: dock.warehouseId,
    orderId,
    asnId,
    windowStart,
    windowEnd,
    cancelledAt: null,
    createdAt: at,
  };
  const event: DockEvent = {
    id: uid("devt"),
    appointmentId: appointment.id,
    kind: "assignment",
    at,
    note: `Asignado a ${dock.code}`,
    operatorId: input.operatorId ?? null,
  };
  return {
    ok: true,
    appointmentId: appointment.id,
    eventId: event.id,
    snap: {
      ...nextSnap,
      dockAppointments: [appointment, ...(nextSnap.dockAppointments ?? [])],
      dockEvents: [event, ...(nextSnap.dockEvents ?? [])],
    },
  };
}

export function cancelDockAppointment(snap: WmsSnapshot, appointmentId: string, at = WMS_DEMO_NOW): DockResult {
  const appointment = (snap.dockAppointments ?? []).find((a) => a.id === appointmentId);
  if (!appointment) return { ok: false, error: "appointment_missing" };
  if (appointment.cancelledAt) return { ok: false, error: "appointment_cancelled" };
  return {
    ok: true,
    appointmentId,
    snap: {
      ...snap,
      dockAppointments: (snap.dockAppointments ?? []).map((a) =>
        a.id === appointmentId ? { ...a, cancelledAt: at } : a,
      ),
    },
  };
}

export function recordDockEvent(
  snap: WmsSnapshot,
  appointmentId: string,
  kind: DockEventKind,
  input: { at?: string; note?: string; operatorId?: string | null } = {},
): DockResult {
  if (!DOCK_EVENT_KINDS.includes(kind)) return { ok: false, error: "event_invalid" };
  const appointment = (snap.dockAppointments ?? []).find((a) => a.id === appointmentId);
  if (!appointment) return { ok: false, error: "appointment_missing" };
  if (appointment.cancelledAt) return { ok: false, error: "appointment_cancelled" };
  const event: DockEvent = {
    id: uid("devt"),
    appointmentId,
    kind,
    at: input.at ?? WMS_DEMO_NOW,
    note: input.note?.trim() ?? "",
    operatorId: input.operatorId ?? null,
  };
  return {
    ok: true,
    appointmentId,
    eventId: event.id,
    snap: { ...snap, dockEvents: [event, ...(snap.dockEvents ?? [])] },
  };
}

/** Si hay cita viva del pedido, anota el evento. Si no hay cita, no inventa una. */
export function recordDockEventForOrder(
  snap: WmsSnapshot,
  orderId: string,
  kind: DockEventKind,
  at = WMS_DEMO_NOW,
  operatorId: string | null = null,
): WmsSnapshot {
  const appointment = activeAppointments(snap).find((a) => a.orderId === orderId);
  if (!appointment) return snap;
  const recorded = recordDockEvent(snap, appointment.id, kind, { at, operatorId });
  return recorded.ok ? recorded.snap : snap;
}

export function eventsForAppointment(snap: WmsSnapshot, appointmentId: string): DockEvent[] {
  return (snap.dockEvents ?? []).filter((e) => e.appointmentId === appointmentId);
}

function dayBounds(dayIso: string): { start: string; end: string } {
  const day = dayIso.slice(0, 10);
  return { start: `${day}T00:00:00.000Z`, end: `${day}T23:59:59.999Z` };
}

export type DockCalendarSlot = {
  dock: Dock;
  appointments: DockAppointment[];
};

/** Citas del día cuyo intervalo solapa el día. No inventa muelles. */
export function dockCalendarDay(snap: WmsSnapshot, dayIso: string, warehouseId?: string): DockCalendarSlot[] {
  const { start, end } = dayBounds(dayIso);
  const docks = (snap.docks ?? []).filter((d) => !warehouseId || d.warehouseId === warehouseId);
  return docks.map((dock) => ({
    dock,
    appointments: activeAppointments(snap, dock.id).filter((a) => windowsOverlap(a.windowStart, a.windowEnd, start, end)),
  }));
}
