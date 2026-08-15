import { describe, expect, it } from "vitest";

import { buildInvoiceAlerts } from "@/lib/invoice-alerts";
import type { Invoice } from "@/lib/ops-data";

function invoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: "I1",
    number: "F2026/001",
    reservationId: "R1",
    clientId: "C1",
    clientName: "Luis",
    clientNif: "1",
    clientAddress: "Madrid",
    issueDate: "2026-06-01",
    operationDate: "2026-06-01",
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
    amountCollected: 0,
    collectedAt: null,
    paymentRef: null,
    verifactuHash: "h",
    aeatStatus: "aceptado",
    rectifies: null,
    ...over,
  };
}

describe("buildInvoiceAlerts", () => {
  it("detecta rectificativa sin original y posible duplicada", () => {
    const now = new Date("2026-08-08T12:00:00Z");
    const alerts = buildInvoiceAlerts(
      [
        invoice({ id: "A", number: "F1", total: 2000, issueDate: "2026-07-01" }),
        invoice({ id: "B", number: "F2", total: 2000, issueDate: "2026-07-15" }),
        invoice({
          id: "C",
          number: "F3",
          rectifies: "MISSING",
          total: -200,
          amountCollected: 0,
        }),
      ],
      now,
    );
    expect(alerts.some((a) => a.kind === "duplicada")).toBe(true);
    expect(alerts.some((a) => a.kind === "rectificativa")).toBe(true);
  });
});
