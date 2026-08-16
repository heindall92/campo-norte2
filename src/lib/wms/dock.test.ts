import { describe, expect, it } from "vitest";
import {
  addDock,
  dockAcceptsOverlap,
  dockCalendarDay,
  eventsForAppointment,
  openDockAppointment,
  overlappingAppointments,
  recordDockEvent,
  recordDockEventForOrder,
  windowsOverlap,
} from "./dock";
import { buildWmsSeed } from "./seed";

describe("oleada 10 · dock calendar", () => {
  it("semilla no inventa muelles, citas ni eventos", () => {
    const snap = buildWmsSeed();
    expect(snap.docks).toEqual([]);
    expect(snap.dockAppointments).toEqual([]);
    expect(snap.dockEvents).toEqual([]);
  });

  it("sin capacidad escrita dos pedidos pueden coincidir; con cupo 1 no", () => {
    const seed = buildWmsSeed();
    const a = seed.outbound.find((o) => o.id === "out-01")!;
    const b = seed.outbound.find((o) => o.id === "out-02")!;
    expect(windowsOverlap(a.dockWindowStart!, a.dockWindowEnd!, a.dockWindowStart!, a.dockWindowEnd!)).toBe(true);

    const open = addDock(seed, { warehouseId: "site-sev", code: "M-05", name: "Muelle 5" });
    expect(open.ok).toBe(true);
    if (!open.ok) return;
    expect(open.snap.docks[0]?.capacity).toBeNull();
    expect(dockAcceptsOverlap(open.snap.docks[0]!, 4)).toBe(true);

    const first = openDockAppointment(open.snap, {
      dockId: open.dockId!,
      orderId: a.id,
      windowStart: "2026-08-15T10:30:00.000Z",
      windowEnd: "2026-08-15T12:00:00.000Z",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = openDockAppointment(first.snap, {
      dockId: open.dockId!,
      orderId: b.id,
      windowStart: "2026-08-15T11:00:00.000Z",
      windowEnd: "2026-08-15T12:30:00.000Z",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(overlappingAppointments(second.snap, open.dockId!, "2026-08-15T10:30:00.000Z", "2026-08-15T12:30:00.000Z")).toHaveLength(2);

    const capped = addDock(seed, { warehouseId: "site-sev", code: "M-09", name: "Muelle 9", capacity: 1 });
    expect(capped.ok).toBe(true);
    if (!capped.ok) return;
    const one = openDockAppointment(capped.snap, {
      dockId: capped.dockId!,
      orderId: a.id,
      windowStart: "2026-08-15T10:30:00.000Z",
      windowEnd: "2026-08-15T12:00:00.000Z",
    });
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    const blocked = openDockAppointment(one.snap, {
      dockId: capped.dockId!,
      orderId: b.id,
      windowStart: "2026-08-15T11:00:00.000Z",
      windowEnd: "2026-08-15T12:30:00.000Z",
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe("dock_busy");
  });

  it("el calendario lista citas del día y no fabrica muelles", () => {
    const seed = buildWmsSeed();
    const empty = dockCalendarDay(seed, "2026-08-15", "site-sev");
    expect(empty).toEqual([]);
    const added = addDock(seed, { warehouseId: "site-sev", code: "M-05", name: "Muelle 5", capacity: 2 });
    if (!added.ok) return;
    const booked = openDockAppointment(added.snap, {
      dockId: added.dockId!,
      orderId: "out-01",
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;
    const day = dockCalendarDay(booked.snap, "2026-08-15", "site-sev");
    expect(day).toHaveLength(1);
    expect(day[0]!.appointments).toHaveLength(1);
    expect(day[0]!.dock.code).toBe("M-05");
    expect(dockCalendarDay(booked.snap, "2026-08-16", "site-sev")[0]?.appointments).toEqual([]);
  });

  it("los eventos no avanzan solos; sin cita no se inventa load", () => {
    const seed = buildWmsSeed();
    const added = addDock(seed, { warehouseId: "site-sev", code: "M-05", name: "Muelle 5" });
    if (!added.ok) return;
    const booked = openDockAppointment(added.snap, { dockId: added.dockId!, orderId: "out-01" });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;
    expect(eventsForAppointment(booked.snap, booked.appointmentId!).map((e) => e.kind)).toEqual(["assignment"]);
    const loaded = recordDockEvent(booked.snap, booked.appointmentId!, "load");
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(eventsForAppointment(loaded.snap, booked.appointmentId!).map((e) => e.kind)).toEqual(["load", "assignment"]);
    const ghost = recordDockEventForOrder(seed, "out-01", "load");
    expect(ghost.dockEvents).toEqual([]);
    expect(ghost.dockAppointments).toEqual([]);
  });
});
