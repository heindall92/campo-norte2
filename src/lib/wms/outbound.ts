import type { OutboundOrder, Pallet, PickLine, Slot, WmsSnapshot } from "./types";

export type OutboundOpError =
  | "order_missing"
  | "order_done"
  | "wave_open"
  | "nothing_picked"
  | "pallets_not_staged"
  | "dock_full";

export type OutboundOpResult =
  | { ok: true; snap: WmsSnapshot }
  | { ok: false; error: OutboundOpError };

export interface OrderFulfillment {
  order: OutboundOrder;
  lines: PickLine[];
  qtyPicked: number;
  qtyShort: number;
  openLines: number;
  wavesClosed: boolean;
  hasWave: boolean;
  fullPalletsToStage: Pallet[];
  stagedPallets: Pallet[];
  canStage: boolean;
  canShip: boolean;
}

function linesForOrder(snap: WmsSnapshot, orderCode: string): PickLine[] {
  return snap.pickWaves.flatMap((w) => w.lines.filter((l) => l.orderCode === orderCode));
}

function freeDockSlots(snap: WmsSnapshot, siteId: string): Slot[] {
  return snap.slots.filter(
    (s) => s.siteId === siteId && s.zone === "muelle" && s.status === "libre" && !s.palletId,
  );
}

function palletOf(snap: WmsSnapshot, id: string | null): Pallet | undefined {
  return id ? snap.pallets.find((p) => p.id === id) : undefined;
}

/** Palets vaciados en picking (qty 0) que aún no están en muelle ni expedidos. */
export function fullPalletsToStage(snap: WmsSnapshot, orderCode: string): Pallet[] {
  const seen = new Set<string>();
  const rows: Pallet[] = [];
  for (const line of linesForOrder(snap, orderCode)) {
    if (line.status !== "picada" || !line.palletId || seen.has(line.palletId)) continue;
    const pallet = palletOf(snap, line.palletId);
    if (!pallet || pallet.qty > 0) continue;
    if (pallet.status === "expedido" || pallet.status === "muelle") continue;
    seen.add(pallet.id);
    rows.push(pallet);
  }
  return rows;
}

export function stagedPalletsForOrder(snap: WmsSnapshot, orderCode: string): Pallet[] {
  const seen = new Set<string>();
  const rows: Pallet[] = [];
  for (const line of linesForOrder(snap, orderCode)) {
    if (line.status !== "picada" || !line.palletId || seen.has(line.palletId)) continue;
    const pallet = palletOf(snap, line.palletId);
    if (!pallet || pallet.status !== "muelle" || pallet.qty > 0) continue;
    seen.add(pallet.id);
    rows.push(pallet);
  }
  return rows;
}

export function orderFulfillment(snap: WmsSnapshot, orderId: string): OrderFulfillment | null {
  const order = snap.outbound.find((o) => o.id === orderId);
  if (!order) return null;
  const lines = linesForOrder(snap, order.code);
  const waves = snap.pickWaves.filter((w) => w.lines.some((l) => l.orderCode === order.code));
  const openLines = lines.filter((l) => l.status === "pendiente" || l.status === "en_curso").length;
  const qtyPicked = lines.filter((l) => l.status === "picada").reduce((s, l) => s + l.qtyPicked, 0);
  const qtyShort = lines.filter((l) => l.status === "faltante").reduce((s, l) => s + Math.max(0, l.qty - l.qtyPicked), 0);
  const toStage = fullPalletsToStage(snap, order.code);
  const staged = stagedPalletsForOrder(snap, order.code);
  const wavesClosed = waves.length > 0 && waves.every((w) => w.status === "cerrada") && openLines === 0;
  return {
    order,
    lines,
    qtyPicked,
    qtyShort,
    openLines,
    wavesClosed,
    hasWave: waves.length > 0,
    fullPalletsToStage: toStage,
    stagedPallets: staged,
    canStage: order.status !== "expedido" && toStage.length > 0,
    canShip:
      order.status !== "expedido" && wavesClosed && qtyPicked > 0 && toStage.length === 0,
  };
}

/**
 * Lleva a muelle los palets que el picking vació.
 * No fabrica mercancía: solo qty 0 ya picada.
 */
export function stageOrderToDock(
  snap: WmsSnapshot,
  orderId: string,
  operatorId: string | null = null,
  at = new Date().toISOString(),
): OutboundOpResult {
  const order = snap.outbound.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "order_missing" };
  if (order.status === "expedido") return { ok: false, error: "order_done" };
  const toStage = fullPalletsToStage(snap, order.code);
  if (!toStage.length) return { ok: false, error: "nothing_picked" };
  const docks = freeDockSlots(snap, order.siteId);
  if (!docks.length) return { ok: false, error: "dock_full" };

  const take = toStage.slice(0, docks.length);
  let slots = snap.slots;
  let pallets = snap.pallets;
  const movements = [...snap.movements];

  take.forEach((pallet, i) => {
    const dock = docks[i]!;
    const fromId = pallet.slotId;
    slots = slots.map((s) => {
      if (fromId && s.id === fromId) return { ...s, palletId: null, status: "libre" as const };
      if (s.id === dock.id) return { ...s, palletId: pallet.id, status: "ocupado" as const };
      return s;
    });
    pallets = pallets.map((p) =>
      p.id === pallet.id ? { ...p, slotId: dock.id, status: "muelle" as const } : p,
    );
    movements.unshift({
      id: `mv-stage-${pallet.id}-${at}`,
      at,
      type: "traslado",
      skuId: pallet.skuId,
      palletId: pallet.id,
      fromSlotId: fromId,
      toSlotId: dock.id,
      qty: 0,
      operatorId,
      fleetId: null,
      note: `Carga ${order.code} · ${order.dock} → ${dock.code}`,
    });
  });

  return {
    ok: true,
    snap: {
      ...snap,
      slots,
      pallets,
      movements,
      outbound: snap.outbound.map((o) =>
        o.id === order.id && o.status !== "expedido" ? { ...o, status: "muelle" as const } : o,
      ),
    },
  };
}

/**
 * Cierra el pedido con lo picado. No inventa tracking ni palets.
 * Los palets enteros tienen que estar en muelle; las cajas sueltas ya salieron en el pick.
 */
export function shipOutboundOrder(
  snap: WmsSnapshot,
  orderId: string,
  operatorId: string | null = null,
  at = new Date().toISOString(),
): OutboundOpResult {
  const fulfillment = orderFulfillment(snap, orderId);
  if (!fulfillment) return { ok: false, error: "order_missing" };
  if (fulfillment.order.status === "expedido") return { ok: false, error: "order_done" };
  if (!fulfillment.wavesClosed) return { ok: false, error: "wave_open" };
  if (fulfillment.qtyPicked < 1) return { ok: false, error: "nothing_picked" };
  if (fulfillment.fullPalletsToStage.length) return { ok: false, error: "pallets_not_staged" };

  const staged = fulfillment.stagedPallets;
  const stagedIds = new Set(staged.map((p) => p.id));
  const slots = snap.slots.map((s) =>
    s.palletId && stagedIds.has(s.palletId) ? { ...s, palletId: null, status: "libre" as const } : s,
  );
  const pallets = snap.pallets.map((p) =>
    stagedIds.has(p.id) ? { ...p, status: "expedido" as const, slotId: null } : p,
  );
  const movements = [...snap.movements];
  for (const pallet of staged) {
    movements.unshift({
      id: `mv-ship-${pallet.id}-${at}`,
      at,
      type: "salida",
      skuId: pallet.skuId,
      palletId: pallet.id,
      fromSlotId: pallet.slotId,
      toSlotId: null,
      qty: 0,
      operatorId,
      fleetId: null,
      note: `Expedido ${fulfillment.order.code}`,
    });
  }

  return {
    ok: true,
    snap: {
      ...snap,
      slots,
      pallets,
      movements,
      outbound: snap.outbound.map((o) =>
        o.id === orderId ? { ...o, status: "expedido" as const } : o,
      ),
    },
  };
}
