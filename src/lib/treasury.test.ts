import { describe, expect, it } from "vitest";

import type { Invoice, Reservation } from "@/lib/ops-data";
import { buildTreasury, deltaVsPrevious, totalsForView } from "@/lib/treasury";

const NOW = new Date("2026-08-08T12:00:00Z");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

function daysAhead(n: number): string {
  return new Date(NOW.getTime() + n * 86_400_000).toISOString();
}

function invoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: "I1",
    number: "F2026/001",
    reservationId: "R1",
    clientId: "C1",
    clientName: "Luis Paz",
    clientNif: "12345678Z",
    clientAddress: "Madrid",
    issueDate: daysAgo(5),
    operationDate: daysAgo(5),
    expedition: "Mongolia 2026",
    taxBase: 1000,
    vatRate: 21,
    vatAmount: 210,
    total: 1210,
    regime: "reav",
    regimeKey: "05",
    operationClass: "S1",
    reavMention: true,
    status: "emitida",
    paymentChannel: "transferencia",
    amountCollected: 0,
    collectedAt: null,
    paymentRef: null,
    verifactuHash: "abc",
    aeatStatus: "aceptado",
    rectifies: null,
    ...over,
  };
}

function reservation(over: Partial<Reservation> = {}): Reservation {
  return {
    id: "R1",
    clientId: "C1",
    clientName: "Luis Paz",
    clientPhone: "+34600000000",
    expeditionId: "E1",
    route: "MONGOLIA",
    tripName: "Mongolia 2026",
    vehicle: "moto",
    status: "reservado",
    bookedAt: daysAgo(30),
    departureAt: daysAhead(60),
    pax: 2,
    totalAmount: 8000,
    depositPaid: 2000,
    paymentChannel: "transferencia",
    paymentRefs: [],
    tourLeader: "David",
    logisticsContacts: [],
    itinerary: [],
    prep: [],
    internalNotes: "",
    ...over,
  };
}

describe("buildTreasury", () => {
  it("separa cobrado, pendiente y comprometido", () => {
    const t = buildTreasury({
      invoices: [invoice({ total: 1210, amountCollected: 1210, collectedAt: daysAgo(3) })],
      reservations: [reservation({ totalAmount: 8000, depositPaid: 2000 })],
      now: NOW,
    });

    // Cobrado = factura cobrada + señal de reserva
    expect(t.collected).toBe(1210 + 2000);
    // Comprometido = saldo de reserva aún no facturado
    expect(t.committed).toBe(6000);
    expect(t.receivable).toBe(0);
  });

  it("marca vencido lo facturado hace más de 30 días y sin cobrar", () => {
    const t = buildTreasury({
      invoices: [invoice({ issueDate: daysAgo(45), amountCollected: 0 })],
      now: NOW,
    });
    expect(t.receivable).toBe(1210);
    expect(t.overdue).toBe(1210);
  });

  it("no marca vencido dentro de plazo", () => {
    const t = buildTreasury({
      invoices: [invoice({ issueDate: daysAgo(10), amountCollected: 0 })],
      now: NOW,
    });
    expect(t.receivable).toBe(1210);
    expect(t.overdue).toBe(0);
  });

  it("ignora borradores y anuladas", () => {
    const t = buildTreasury({
      invoices: [invoice({ id: "b", status: "borrador" }), invoice({ id: "a", status: "anulada" })],
      now: NOW,
    });
    expect(t.movements).toEqual([]);
    expect(t.projectedClose).toBe(0);
  });

  it("la proyección de cierre suma cobrado, por cobrar y comprometido", () => {
    const t = buildTreasury({
      invoices: [invoice({ amountCollected: 0 })],
      reservations: [reservation({ totalAmount: 8000, depositPaid: 2000 })],
      now: NOW,
    });
    expect(t.projectedClose).toBe(t.collected + t.receivable + t.committed);
    expect(t.projectedClose).toBe(2000 + 1210 + 6000);
  });

  it("reparte por ruta con porcentajes que suman 100", () => {
    const t = buildTreasury({
      reservations: [
        reservation({ id: "a", route: "MONGOLIA", totalAmount: 6000, depositPaid: 6000 }),
        reservation({ id: "b", route: "NAMIBIA", totalAmount: 2000, depositPaid: 2000 }),
      ],
      now: NOW,
    });

    expect(t.byRoute).toHaveLength(2);
    expect(t.byRoute[0]!.route).toBe("MONGOLIA");
    const sum = t.byRoute.reduce((s, r) => s + r.pct, 0);
    expect(Math.round(sum)).toBe(100);
  });

  it("genera una serie de flujo con tantos meses como se pidan", () => {
    const t = buildTreasury({ invoices: [invoice()], now: NOW, months: 6 });
    expect(t.cashFlow).toHaveLength(6);
    expect(t.cashFlow.at(-1)!.month).toBe("2026-08");
  });

  it("ordena los movimientos del más reciente al más antiguo", () => {
    const t = buildTreasury({
      invoices: [
        invoice({ id: "viejo", issueDate: daysAgo(90), amountCollected: 0 }),
        invoice({ id: "nuevo", issueDate: daysAgo(1), amountCollected: 0 }),
      ],
      now: NOW,
    });
    const dates = t.movements.map((m) => new Date(m.date).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });
});

describe("totalsForView", () => {
  it("recalcula sobre las filas que recibe, no sobre el total", () => {
    const t = buildTreasury({
      invoices: [
        invoice({ id: "a", total: 1000, amountCollected: 1000, collectedAt: daysAgo(2) }),
        invoice({ id: "b", total: 500, amountCollected: 0 }),
      ],
      now: NOW,
    });

    const soloCobrados = t.movements.filter((m) => m.status === "cobrado");
    const view = totalsForView(soloCobrados);

    expect(view.count).toBe(1);
    expect(view.cobrado).toBe(1000);
    expect(view.pendiente).toBe(0);
  });
});

describe("deltaVsPrevious", () => {
  it("devuelve null si no hay base de comparación", () => {
    expect(deltaVsPrevious(100, 0)).toBeNull();
  });

  it("calcula la variación porcentual con signo", () => {
    expect(deltaVsPrevious(150, 100)).toBeCloseTo(50);
    expect(deltaVsPrevious(50, 100)).toBeCloseTo(-50);
  });
});
