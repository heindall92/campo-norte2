import { nextUniqueSscc } from "./sscc";
import { recordPhysicalTx } from "./inventory";
import type { ShippingPackage, WmsSnapshot } from "./types";
import { packPickedLines, type OutboundOpResult } from "./outbound";
import { appendAudit } from "./audit";

function existingSscc(snap: WmsSnapshot): string[] {
  return [
    ...snap.pallets.map((p) => p.sscc),
    ...(snap.packages ?? []).map((p) => p.sscc),
  ];
}

/** Embala cajas sueltas y asigna un SSCC de bulto único. No inventa tracking. */
export function packOrderWithSscc(
  snap: WmsSnapshot,
  orderId: string,
  operatorId: string | null = null,
  at = "2026-08-15T12:00:00.000Z",
): OutboundOpResult {
  const packed = packPickedLines(snap, orderId, operatorId, at);
  if (!packed.ok) return packed;
  const order = packed.snap.outbound.find((o) => o.id === orderId);
  if (!order) return packed;

  const used = existingSscc(packed.snap);
  const packages: ShippingPackage[] = [];
  const lines = packed.snap.pickWaves.flatMap((w) =>
    w.lines.filter((l) => l.orderCode === order.code && (l.qtyPacked ?? 0) > 0),
  );
  for (const line of lines) {
    if ((snap.packages ?? []).some((p) => p.lineIds.includes(line.id))) continue;
    const sscc = nextUniqueSscc([...used, ...packages.map((p) => p.sscc)]);
    used.push(sscc);
    packages.push({
      id: `pkg-${line.id}`,
      orderId,
      sscc,
      skuId: line.skuId,
      qty: line.qtyPacked,
      lineIds: [line.id],
      packedAt: at,
    });
  }

  let next: WmsSnapshot = {
    ...packed.snap,
    packages: [...packages, ...(packed.snap.packages ?? [])],
  };
  for (const pkg of packages) {
    next = recordPhysicalTx(next, {
      at,
      type: "PACK",
      skuId: pkg.skuId,
      palletId: null,
      lot: null,
      fromSlotId: null,
      toSlotId: null,
      qty: pkg.qty,
      operatorId,
      note: `PACK ${order.code} · ${pkg.sscc}`,
      idempotencyKey: `pack-${pkg.id}`,
    });
  }
  return {
    ok: true,
    snap: appendAudit(next, {
      at,
      actorId: operatorId,
      action: "order.pack",
      entityType: "order",
      entityId: orderId,
      after: String(packages.length),
    }),
  };
}
