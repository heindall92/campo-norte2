import { describe, expect, it } from "vitest";

import { buildFiscalCalendar, quarterDueDate, quarterOf } from "@/lib/fiscal-calendar";
import type { Invoice } from "@/lib/ops-data";

const NOW = new Date("2026-08-08T12:00:00Z");

function invoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: "I1",
    number: "F2026/001",
    reservationId: "R1",
    clientId: "C1",
    clientName: "Luis Paz",
    clientNif: "12345678Z",
    clientAddress: "Madrid",
    issueDate: "2026-05-10T00:00:00Z",
    operationDate: "2026-05-10T00:00:00Z",
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
    collectedAt: "2026-05-12T00:00:00Z",
    paymentRef: null,
    verifactuHash: "abc",
    aeatStatus: "aceptado",
    rectifies: null,
    ...over,
  };
}

describe("quarterOf", () => {
  it("asigna cada mes a su trimestre natural", () => {
    expect(quarterOf(new Date("2026-01-15"))).toBe(1);
    expect(quarterOf(new Date("2026-03-31"))).toBe(1);
    expect(quarterOf(new Date("2026-04-01"))).toBe(2);
    expect(quarterOf(new Date("2026-08-08"))).toBe(3);
    expect(quarterOf(new Date("2026-12-31"))).toBe(4);
  });
});

describe("quarterDueDate", () => {
  it("vence el día 20 del mes siguiente al cierre", () => {
    expect(quarterDueDate(2026, 1).toISOString().slice(0, 10)).toBe("2026-04-20");
    expect(quarterDueDate(2026, 2).toISOString().slice(0, 10)).toBe("2026-07-20");
    expect(quarterDueDate(2026, 3).toISOString().slice(0, 10)).toBe("2026-10-20");
  });

  it("el T4 vence el 30 de enero del año siguiente", () => {
    expect(quarterDueDate(2026, 4).toISOString().slice(0, 10)).toBe("2027-01-30");
  });
});

describe("buildFiscalCalendar", () => {
  it("ordena por urgencia: lo más vencido primero", () => {
    const cal = buildFiscalCalendar({ now: NOW });
    const days = cal.map((d) => d.daysToDue);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it("estima el 303 sumando el IVA de las facturas del trimestre", () => {
    const cal = buildFiscalCalendar({
      invoices: [invoice({ vatAmount: 210 }), invoice({ id: "I2", vatAmount: 90 })],
      now: NOW,
    });
    const t2 = cal.find((d) => d.id === "303-2026-T2");
    expect(t2?.estimated).toBe(300);
    expect(t2?.basis).toContain("facturas emitidas");
  });

  it("no cuenta borradores ni anuladas en la estimación de IVA", () => {
    const cal = buildFiscalCalendar({
      invoices: [
        invoice({ vatAmount: 210, status: "borrador" }),
        invoice({ id: "I2", vatAmount: 90, status: "anulada" }),
      ],
      now: NOW,
    });
    expect(cal.find((d) => d.id === "303-2026-T2")?.estimated).toBe(0);
  });

  it("no asigna una factura al trimestre equivocado", () => {
    const cal = buildFiscalCalendar({
      invoices: [invoice({ operationDate: "2026-07-05T00:00:00Z", vatAmount: 500 })],
      now: NOW,
    });
    expect(cal.find((d) => d.id === "303-2026-T2")?.estimated).toBe(0);
    expect(cal.find((d) => d.id === "303-2026-T3")?.estimated).toBe(500);
  });

  it("deja sin importe los modelos que el Hub no puede estimar", () => {
    const cal = buildFiscalCalendar({ invoices: [invoice()], now: NOW });
    expect(cal.find((d) => d.model === "111")?.estimated).toBeNull();
    expect(cal.find((d) => d.model === "200")?.estimated).toBeNull();
  });

  it("el resumen anual suma los cuatro trimestres", () => {
    const cal = buildFiscalCalendar({
      invoices: [
        invoice({ operationDate: "2026-02-01T00:00:00Z", vatAmount: 100 }),
        invoice({ id: "b", operationDate: "2026-05-01T00:00:00Z", vatAmount: 200 }),
        invoice({ id: "c", operationDate: "2026-11-01T00:00:00Z", vatAmount: 300 }),
      ],
      now: NOW,
    });
    expect(cal.find((d) => d.id === "390-2026")?.estimated).toBe(600);
  });

  it("cruza bien el cambio de año al mirar trimestres atrás", () => {
    const cal = buildFiscalCalendar({ now: new Date("2026-02-10T00:00:00Z"), quartersBack: 2 });
    expect(cal.some((d) => d.period.includes("2025"))).toBe(true);
  });
});
