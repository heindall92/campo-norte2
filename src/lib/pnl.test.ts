import { describe, expect, it } from "vitest";

import { buildPnL } from "@/lib/pnl";
import type { Invoice, Reservation } from "@/lib/ops-data";

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
    expedition: "Mongolia 2026",
    taxBase: 1000,
    vatRate: 21,
    vatAmount: 210,
    total: 5000,
    regime: "reav",
    regimeKey: "05",
    operationClass: "S1",
    reavMention: true,
    status: "cobrada",
    paymentChannel: "transferencia",
    amountCollected: 5000,
    collectedAt: "2026-07-05",
    paymentRef: "x",
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
    itinerary: [
      { day: "1", place: "A", lodging: "a", meals: "b" },
      { day: "2", place: "B", lodging: "a", meals: "b" },
    ],
    prep: [],
    internalNotes: "",
    ...over,
  };
}

describe("buildPnL", () => {
  it("usa solo cobrado real como ingreso y deja nómina en null", () => {
    const snap = buildPnL({
      invoices: [invoice(), invoice({ id: "I2", amountCollected: 0, status: "emitida", total: 1000 })],
      reservations: [reservation()],
    });
    expect(snap.revenue).toBe(5000);
    expect(snap.teamCost).toBeGreaterThan(0);
    expect(snap.rows.some((r) => r.label.includes("nómina") && r.amount === null)).toBe(true);
    expect(snap.operatingResult).toBe(snap.grossMargin - snap.teamCost);
  });
});
