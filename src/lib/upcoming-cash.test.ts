import { describe, expect, it } from "vitest";

import { buildUpcomingMovements } from "@/lib/upcoming-cash";
import type { Invoice, Reservation } from "@/lib/ops-data";

const NOW = new Date("2026-08-08T12:00:00Z");

function invoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: "I1",
    number: "F2026/001",
    reservationId: "R1",
    clientId: "C1",
    clientName: "Luis",
    clientNif: "1",
    clientAddress: "Madrid",
    issueDate: "2026-07-01",
    operationDate: "2026-07-01",
    expedition: "Mongolia",
    taxBase: 1000,
    vatRate: 21,
    vatAmount: 210,
    total: 2000,
    regime: "reav",
    regimeKey: "05",
    operationClass: "S1",
    reavMention: true,
    status: "emitida",
    paymentChannel: "transferencia",
    amountCollected: 500,
    collectedAt: null,
    paymentRef: null,
    verifactuHash: "h",
    aeatStatus: "aceptado",
    rectifies: null,
    ...over,
  };
}

function reservation(over: Partial<Reservation> = {}): Reservation {
  return {
    id: "R1",
    clientId: "C1",
    clientName: "Luis",
    clientPhone: "+34",
    expeditionId: "E1",
    route: "MONGOLIA",
    tripName: "Mongolia 2026",
    vehicle: "moto",
    status: "reservado",
    bookedAt: "2026-06-01",
    departureAt: "2026-09-10",
    pax: 2,
    totalAmount: 8000,
    depositPaid: 2000,
    paymentChannel: "transferencia",
    paymentRefs: [],
    tourLeader: "Jorge Peña",
    logisticsContacts: [],
    itinerary: [{ day: "1", place: "A", lodging: "a", meals: "b" }],
    prep: [],
    internalNotes: "",
    ...over,
  };
}

describe("buildUpcomingMovements", () => {
  it("mezcla cobros, saldos y dietas de equipo ordenados por fecha", () => {
    const rows = buildUpcomingMovements({
      invoices: [invoice()],
      reservations: [reservation()],
      now: NOW,
      limit: 10,
    });
    expect(rows.some((r) => r.kind === "cobro")).toBe(true);
    expect(rows.some((r) => r.kind === "saldo_reserva")).toBe(true);
    expect(rows.some((r) => r.kind === "pago_equipo")).toBe(true);
    expect(rows[0]?.date <= rows.at(-1)!.date).toBe(true);
  });
});
