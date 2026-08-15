import { dockWindowFor } from "./carriers";
import { recommendedFleetKind } from "./picking";
import type { OutboundOrder, Pallet, PickWave, Sku, Slot, WmsSnapshot } from "./types";

export type WaveError =
  | "order_missing"
  | "order_done"
  | "no_free_pallets"
  | "invalid_input"
  | "wave_missing"
  | "operator_missing";

export type WaveResult =
  | { ok: true; snap: WmsSnapshot; waveId: string }
  | { ok: false; error: WaveError };

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function palletsInOpenWaves(snap: WmsSnapshot): Set<string> {
  const used = new Set<string>();
  for (const w of snap.pickWaves) {
    if (w.status === "cerrada") continue;
    for (const l of w.lines) {
      if (l.palletId) used.add(l.palletId);
    }
  }
  return used;
}

function pickCandidates(snap: WmsSnapshot, siteId: string): Array<{ slot: Slot; pallet: Pallet; sku: Sku }> {
  const used = palletsInOpenWaves(snap);
  const rows: Array<{ slot: Slot; pallet: Pallet; sku: Sku }> = [];
  for (const slot of snap.slots) {
    if (slot.siteId !== siteId || !slot.pickFace || !slot.palletId) continue;
    if (used.has(slot.palletId)) continue;
    const pallet = snap.pallets.find((p) => p.id === slot.palletId && p.status !== "expedido");
    if (!pallet || pallet.qty < 1) continue;
    const sku = snap.skus.find((s) => s.id === pallet.skuId);
    if (!sku) continue;
    rows.push({ slot, pallet, sku });
  }
  return rows;
}

/**
 * Abre una ola a partir de un pedido de expedición.
 * Las líneas salen de palets reales en cara de picking, no se inventan.
 */
export function openWaveFromOrder(
  snap: WmsSnapshot,
  orderId: string,
  operatorId: string | null = null,
): WaveResult {
  const order = snap.outbound.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "order_missing" };
  if (order.status === "expedido") return { ok: false, error: "order_done" };

  const existing = snap.pickWaves.find(
    (w) => w.status !== "cerrada" && w.lines.some((l) => l.orderCode === order.code),
  );
  if (existing) return { ok: true, snap, waveId: existing.id };

  const need = Math.max(1, Math.min(order.pallets || order.lines || 4, 12));
  const candidates = pickCandidates(snap, order.siteId).slice(0, need);
  if (!candidates.length) return { ok: false, error: "no_free_pallets" };

  const aisle = candidates[0]!.slot.aisle;
  const stamp = order.cutOff.slice(5, 10).replace("-", "");
  const waveId = uid("wave");
  const fleetKind = recommendedFleetKind("picking");
  const busyFleet = new Set(
    snap.pickWaves.filter((w) => w.status !== "cerrada" && w.fleetId).map((w) => w.fleetId),
  );
  const fleet = snap.fleet.find(
    (f) =>
      f.siteId === order.siteId &&
      f.kind === fleetKind &&
      f.status === "operativa" &&
      !busyFleet.has(f.id),
  );

  const wave: PickWave = {
    id: waveId,
    code: `WAVE-${aisle}-${stamp}-${String(snap.pickWaves.length + 1).padStart(2, "0")}`,
    aisle,
    siteId: order.siteId,
    kind: "picking",
    status: "abierta",
    operatorId,
    fleetId: fleet?.id ?? null,
    printedAt: new Date().toISOString(),
    lines: candidates.map((row, i) => ({
      id: `${waveId}-l${i + 1}`,
      waveId,
      orderCode: order.code,
      skuId: row.sku.id,
      qty: row.pallet.qty,
      qtyPicked: 0,
      qtyPacked: 0,
      cartonSscc: null,
      slotId: row.slot.id,
      palletId: row.pallet.id,
      status: i === 0 ? ("en_curso" as const) : ("pendiente" as const),
      sequence: i + 1,
    })),
  };

  return {
    ok: true,
    waveId,
    snap: {
      ...snap,
      pickWaves: [...snap.pickWaves, wave],
      outbound: snap.outbound.map((o) =>
        o.id === order.id && o.status === "pendiente" ? { ...o, status: "picking" as const } : o,
      ),
    },
  };
}

export function createOutboundOrder(
  snap: WmsSnapshot,
  input: {
    customer: string;
    cutOff: string;
    dock: string;
    siteId: string;
    lines: number;
    pallets: number;
    priority: OutboundOrder["priority"];
    carrierId?: string | null;
  },
): { ok: true; snap: WmsSnapshot; orderId: string } | { ok: false; error: WaveError } {
  if (!input.customer.trim() || !input.cutOff || !input.dock.trim()) {
    return { ok: false, error: "invalid_input" };
  }
  const window = dockWindowFor(input.cutOff);
  const id = uid("out");
  const day = input.cutOff.slice(2, 10).replace(/-/g, "");
  const order: OutboundOrder = {
    id,
    code: `OUT-${day}-${String(snap.outbound.length + 1).padStart(2, "0")}`,
    customer: input.customer.trim(),
    cutOff: input.cutOff,
    dock: input.dock.trim(),
    status: "pendiente",
    lines: Math.max(1, Math.floor(input.lines) || 1),
    pallets: Math.max(1, Math.floor(input.pallets) || 1),
    priority: input.priority,
    siteId: input.siteId,
    carrierId: input.carrierId ?? snap.carriers.find((c) => c.active)?.id ?? null,
    tracking: null,
    dockWindowStart: window.start,
    dockWindowEnd: window.end,
  };
  return { ok: true, orderId: id, snap: { ...snap, outbound: [order, ...snap.outbound] } };
}

export function assignWaveOperator(
  snap: WmsSnapshot,
  waveId: string,
  operatorId: string | null,
): WaveResult {
  const wave = snap.pickWaves.find((w) => w.id === waveId);
  if (!wave) return { ok: false, error: "wave_missing" };
  if (operatorId) {
    const op = snap.operators.find((o) => o.id === operatorId);
    if (!op || op.vacant) return { ok: false, error: "operator_missing" };
  }
  return {
    ok: true,
    waveId,
    snap: {
      ...snap,
      pickWaves: snap.pickWaves.map((w) => (w.id === waveId ? { ...w, operatorId } : w)),
    },
  };
}

export function waveOrderCodes(wave: PickWave): string[] {
  return [...new Set(wave.lines.map((l) => l.orderCode))];
}

/**
 * Separa una ola mezclada en una ola por pedido.
 * No inventa líneas: solo reparte las que ya existen.
 */
export function splitWaveByOrder(snap: WmsSnapshot, waveId: string): WaveResult {
  const wave = snap.pickWaves.find((w) => w.id === waveId);
  if (!wave) return { ok: false, error: "wave_missing" };
  const codes = waveOrderCodes(wave);
  if (codes.length < 2) return { ok: true, snap, waveId };

  const created: PickWave[] = codes.map((orderCode) => {
    const lines = wave.lines
      .filter((l) => l.orderCode === orderCode)
      .map((l, i) => ({
        ...l,
        id: `${wave.id}-${orderCode}-l${i + 1}`,
        waveId: `${wave.id}-${orderCode}`,
        sequence: i + 1,
      }));
    return {
      ...wave,
      id: `${wave.id}-${orderCode}`,
      code: `${wave.code}-${orderCode.replace(/[^A-Z0-9]/gi, "").slice(-4)}`,
      lines,
    };
  });

  return {
    ok: true,
    waveId: created[0]!.id,
    snap: {
      ...snap,
      pickWaves: snap.pickWaves.flatMap((w) => (w.id === waveId ? created : [w])),
    },
  };
}

export function outboundItinerary(snap: WmsSnapshot, siteId?: string) {
  const open = snap.outbound.filter(
    (o) => o.status !== "expedido" && (!siteId || o.siteId === siteId),
  );
  return open
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.dockWindowStart ?? a.cutOff).getTime();
      const tb = new Date(b.dockWindowStart ?? b.cutOff).getTime();
      if (ta !== tb) return ta - tb;
      const rank = { express: 0, urgente: 1, normal: 2 };
      return rank[a.priority] - rank[b.priority];
    })
    .map((order, index) => ({
      seq: index + 1,
      order,
      windowStart: order.dockWindowStart,
      windowEnd: order.dockWindowEnd,
    }));
}
