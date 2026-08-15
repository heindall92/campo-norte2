/**
 * Alertas proactivas de facturas (duplicados, rectificativas, errores de cobro).
 * Patrón de banners de la demo de referencia — sin OCR.
 */

import type { Invoice } from "@/lib/ops-data";

export type InvoiceAlertKind = "duplicada" | "rectificativa" | "vencida_grave" | "sin_cobro";

export interface InvoiceAlert {
  id: string;
  kind: InvoiceAlertKind;
  title: string;
  body: string;
  amount?: number;
  invoiceId: string;
  tone: "warning" | "negative" | "info";
}

export function buildInvoiceAlerts(invoices: Invoice[], now = new Date()): InvoiceAlert[] {
  const alerts: InvoiceAlert[] = [];
  const byClientTotal = new Map<string, Invoice[]>();

  for (const inv of invoices) {
    if (inv.status === "anulada" || inv.status === "borrador") continue;
    const key = `${inv.clientId}|${inv.total}|${inv.issueDate.slice(0, 7)}`;
    const list = byClientTotal.get(key) ?? [];
    list.push(inv);
    byClientTotal.set(key, list);

    if (inv.rectifies) {
      const original = invoices.find((i) => i.id === inv.rectifies || i.number === inv.rectifies);
      if (!original) {
        alerts.push({
          id: `rect:${inv.id}`,
          kind: "rectificativa",
          title: `Rectificativa sin original · ${inv.number}`,
          body: `${inv.clientName} · revisa a qué factura corrige.`,
          amount: inv.total,
          invoiceId: inv.id,
          tone: "warning",
        });
      }
    }

    const outstanding = inv.total - inv.amountCollected;
    if (outstanding > 0) {
      const age = Math.floor(
        (now.getTime() - new Date(inv.issueDate).getTime()) / 86_400_000,
      );
      if (age > 45) {
        alerts.push({
          id: `over:${inv.id}`,
          kind: "vencida_grave",
          title: `Cobro muy atrasado · ${inv.number}`,
          body: `${inv.clientName} · ${age} días desde emisión · pend. sin resolver.`,
          amount: outstanding,
          invoiceId: inv.id,
          tone: "negative",
        });
      } else if (inv.amountCollected === 0 && age > 14) {
        alerts.push({
          id: `nocob:${inv.id}`,
          kind: "sin_cobro",
          title: `Sin cobro registrado · ${inv.number}`,
          body: `${inv.clientName} · emitida hace ${age} días.`,
          amount: outstanding,
          invoiceId: inv.id,
          tone: "info",
        });
      }
    }
  }

  for (const [, list] of byClientTotal) {
    if (list.length < 2) continue;
    const [a, b] = list;
    alerts.push({
      id: `dup:${a.id}:${b.id}`,
      kind: "duplicada",
      title: `Posible duplicada · ${a.number} / ${b.number}`,
      body: `${a.clientName} · mismo importe y mes · coincidencia probable.`,
      amount: a.total,
      invoiceId: a.id,
      tone: "warning",
    });
  }

  const weight = { negative: 0, warning: 1, info: 2 } as const;
  return alerts.sort((x, y) => weight[x.tone] - weight[y.tone]).slice(0, 6);
}
