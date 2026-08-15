import { describe, expect, it } from "vitest";

import { buildAttentionQueue, summarizeAttention } from "@/lib/attention";
import type { Lead } from "@/lib/demo-data";
import type { Invoice, Reservation } from "@/lib/ops-data";

const NOW = new Date("2026-08-08T12:00:00Z");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

function daysAhead(n: number): string {
  return new Date(NOW.getTime() + n * 86_400_000).toISOString();
}

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: "L1",
    name: "Ana Ruiz",
    email: "ana@example.com",
    origin: "web_form",
    campaign: null,
    status: "nuevo",
    score: 80,
    scoreReasons: [],
    interestRoute: null,
    vehicle: null,
    createdAt: daysAgo(20),
    lastTouchAt: daysAgo(12),
    owner: "Laura",
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
    bookedAt: daysAgo(60),
    departureAt: daysAhead(10),
    pax: 2,
    totalAmount: 8000,
    depositPaid: 8000,
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
    amountCollected: 1210,
    collectedAt: daysAgo(3),
    paymentRef: null,
    verifactuHash: "abc",
    aeatStatus: "aceptado",
    rectifies: null,
    ...over,
  };
}

describe("buildAttentionQueue", () => {
  it("no devuelve nada cuando todo está al día", () => {
    const items = buildAttentionQueue({
      leads: [lead({ lastTouchAt: daysAgo(1) })],
      reservations: [reservation()],
      invoices: [invoice()],
      now: NOW,
    });
    expect(items).toEqual([]);
  });

  it("ignora leads ya cerrados aunque lleven meses sin tocar", () => {
    const items = buildAttentionQueue({
      leads: [
        lead({ id: "won", status: "reservado", lastTouchAt: daysAgo(90) }),
        lead({ id: "lost", status: "descartado", lastTouchAt: daysAgo(90) }),
      ],
      now: NOW,
    });
    expect(items).toEqual([]);
  });

  it("ignora leads de score bajo: enfriarse solo importa si valían la pena", () => {
    const items = buildAttentionQueue({
      leads: [lead({ score: 30, lastTouchAt: daysAgo(40) })],
      now: NOW,
    });
    expect(items).toEqual([]);
  });

  it("señala un lead caliente que lleva días sin contacto", () => {
    const items = buildAttentionQueue({
      leads: [lead({ score: 80, lastTouchAt: daysAgo(12) })],
      now: NOW,
      avgTicket: 5000,
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.source).toBe("lead");
    expect(items[0]!.severity).toBe("vencido");
    expect(items[0]!.reason).toContain("12 d sin contacto");
    expect(items[0]!.reason).toMatch(/se enfría el/i);
  });

  it("señala saldo pendiente cuando la salida está cerca", () => {
    const items = buildAttentionQueue({
      reservations: [reservation({ depositPaid: 2000, totalAmount: 8000 })],
      now: NOW,
    });
    const saldo = items.find((i) => i.id.startsWith("reserva-saldo"));
    expect(saldo).toBeDefined();
    expect(saldo!.amount).toBe(6000);
    expect(saldo!.actionLabel).toBe("Cobrar");
  });

  it("no reclama saldo si la salida está lejos", () => {
    const items = buildAttentionQueue({
      reservations: [reservation({ depositPaid: 0, departureAt: daysAhead(200) })],
      now: NOW,
    });
    expect(items).toEqual([]);
  });

  it("pone el rechazo de la AEAT como vencido sin importar la fecha", () => {
    const items = buildAttentionQueue({
      invoices: [invoice({ aeatStatus: "rechazado", issueDate: daysAgo(1) })],
      now: NOW,
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.severity).toBe("vencido");
    expect(items[0]!.actionLabel).toBe("Corregir");
  });

  it("reclama una factura emitida y sin cobrar pasado el plazo", () => {
    const items = buildAttentionQueue({
      invoices: [invoice({ amountCollected: 0, issueDate: daysAgo(45) })],
      now: NOW,
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.amount).toBe(1210);
    expect(items[0]!.severity).toBe("vencido");
  });

  it("ordena por severidad y, a igualdad, por importe", () => {
    const items = buildAttentionQueue({
      reservations: [
        reservation({ id: "chico", depositPaid: 7000, departureAt: daysAhead(3) }),
        reservation({ id: "grande", depositPaid: 1000, departureAt: daysAhead(3) }),
      ],
      invoices: [invoice({ id: "vencida", amountCollected: 0, issueDate: daysAgo(60) })],
      now: NOW,
    });

    expect(items[0]!.severity).toBe("vencido");
    const proximos = items.filter((i) => i.severity === "proximo");
    expect(proximos[0]!.amount).toBeGreaterThan(proximos[1]!.amount!);
  });
});

describe("summarizeAttention", () => {
  it("cuenta por fuente y suma el importe en juego", () => {
    const items = buildAttentionQueue({
      leads: [lead({ lastTouchAt: daysAgo(20) })],
      reservations: [reservation({ depositPaid: 3000 })],
      invoices: [invoice({ amountCollected: 0, issueDate: daysAgo(60) })],
      now: NOW,
      avgTicket: 4000,
    });

    const s = summarizeAttention(items);
    expect(s.total).toBe(items.length);
    expect(s.bySource.lead).toBe(1);
    expect(s.bySource.reserva).toBe(1);
    expect(s.bySource.factura).toBe(1);
    expect(s.amountAtStake).toBe(4000 + 5000 + 1210);
  });
});

describe("umbrales configurables", () => {
  it("por defecto señala a los 2 días, alineado con «responder en el día»", () => {
    const dos = buildAttentionQueue({ leads: [lead({ lastTouchAt: daysAgo(2) })], now: NOW });
    const uno = buildAttentionQueue({ leads: [lead({ lastTouchAt: daysAgo(1) })], now: NOW });
    expect(dos).toHaveLength(1);
    expect(uno).toHaveLength(0);
  });

  it("se puede relajar el umbral sin tocar el módulo", () => {
    const items = buildAttentionQueue({
      leads: [lead({ lastTouchAt: daysAgo(3) })],
      now: NOW,
      thresholds: { leadStaleDays: 10 },
    });
    expect(items).toEqual([]);
  });

  it("un override no arrastra al resto de umbrales", () => {
    const items = buildAttentionQueue({
      invoices: [invoice({ amountCollected: 0, issueDate: daysAgo(45) })],
      now: NOW,
      thresholds: { leadStaleDays: 30 },
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.source).toBe("factura");
  });

  it("permite endurecer el plazo de cobro", () => {
    const laxo = buildAttentionQueue({
      invoices: [invoice({ amountCollected: 0, issueDate: daysAgo(20) })],
      now: NOW,
    });
    const estricto = buildAttentionQueue({
      invoices: [invoice({ amountCollected: 0, issueDate: daysAgo(20) })],
      now: NOW,
      thresholds: { invoiceDueDays: 15 },
    });
    expect(laxo).toHaveLength(0);
    expect(estricto).toHaveLength(1);
  });
});
