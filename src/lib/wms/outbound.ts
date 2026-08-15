import type { OutboundOrder, Pallet, PickLine, Slot, WmsSnapshot } from "./types";

export type OutboundOpError =
  | "order_missing"
  | "order_done"
  | "wave_open"
  | "nothing_picked"
  | "pallets_not_staged"
  | "dock_full"
  | "not_packed"
  | "invalid_qty"
  | "line_missing";

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
  qtyPacked: number;
  unpackedCases: PickLine[];
  canStage: boolean;
  canPack: boolean;
  canShip: boolean;
}

export type ManifestKind = "pallet" | "caja";

export interface LoadManifestRow {
  kind: ManifestKind;
  skuId: string;
  qty: number;
  sscc: string | null;
  slotCode: string | null;
  lineId: string | null;
}

export interface LoadManifest {
  order: OutboundOrder;
  carrierName: string | null;
  tracking: string | null;
  dock: string;
  windowStart: string | null;
  windowEnd: string | null;
  rows: LoadManifestRow[];
  qtyPicked: number;
  qtyPacked: number;
  palletCount: number;
  caseCount: number;
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

function isFullPalletLine(snap: WmsSnapshot, line: PickLine): boolean {
  const pallet = palletOf(snap, line.palletId);
  if (!pallet) return false;
  return pallet.qty === 0 && (pallet.status === "picking" || pallet.status === "muelle" || pallet.status === "expedido");
}

/** Cajas sueltas picadas que aún no se han embalado. El palet entero no se vuelve a embalar. */
export function unpackedCaseLines(snap: WmsSnapshot, orderCode: string): PickLine[] {
  return linesForOrder(snap, orderCode).filter((l) => {
    if (l.status !== "picada" || l.qtyPicked < 1) return false;
    if (isFullPalletLine(snap, l)) return false;
    return (l.qtyPacked ?? 0) < l.qtyPicked;
  });
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
  const unpacked = unpackedCaseLines(snap, order.code);
  const qtyPacked = lines.reduce((s, l) => s + (l.qtyPacked ?? 0), 0);
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
    qtyPacked,
    unpackedCases: unpacked,
    canStage: order.status !== "expedido" && toStage.length > 0,
    canPack: order.status !== "expedido" && wavesClosed && unpacked.length > 0,
    canShip:
      order.status !== "expedido" &&
      wavesClosed &&
      qtyPicked > 0 &&
      toStage.length === 0 &&
      unpacked.length === 0,
  };
}

/**
 * Manifiesto de muelle: solo palets cargados y cajas ya embaladas.
 * No inventa SSCC, tracking ni cantidades.
 */
export function buildLoadManifest(snap: WmsSnapshot, orderId: string): LoadManifest | null {
  const fill = orderFulfillment(snap, orderId);
  if (!fill) return null;
  const carrier = fill.order.carrierId
    ? snap.carriers.find((c) => c.id === fill.order.carrierId)
    : null;
  const stagedIds = new Set(fill.stagedPallets.map((p) => p.id));
  const rows: LoadManifestRow[] = [];

  for (const pallet of fill.stagedPallets) {
    const line = fill.lines.find((l) => l.palletId === pallet.id && l.status === "picada");
    const slot = pallet.slotId ? snap.slots.find((s) => s.id === pallet.slotId) : null;
    rows.push({
      kind: "pallet",
      skuId: pallet.skuId,
      qty: line?.qtyPicked ?? 0,
      sscc: pallet.sscc,
      slotCode: slot?.code ?? null,
      lineId: line?.id ?? null,
    });
  }

  for (const line of fill.lines) {
    if (line.status !== "picada" || (line.qtyPacked ?? 0) < 1) continue;
    if (line.palletId && stagedIds.has(line.palletId)) continue;
    if (isFullPalletLine(snap, line)) continue;
    const slot = snap.slots.find((s) => s.id === line.slotId);
    rows.push({
      kind: "caja",
      skuId: line.skuId,
      qty: line.qtyPacked,
      sscc: null,
      slotCode: slot?.code ?? null,
      lineId: line.id,
    });
  }

  return {
    order: fill.order,
    carrierName: carrier?.name ?? null,
    tracking: fill.order.tracking,
    dock: fill.order.dock,
    windowStart: fill.order.dockWindowStart,
    windowEnd: fill.order.dockWindowEnd,
    rows,
    qtyPicked: fill.qtyPicked,
    qtyPacked: fill.qtyPacked,
    palletCount: rows.filter((r) => r.kind === "pallet").length,
    caseCount: rows.filter((r) => r.kind === "caja").reduce((s, r) => s + r.qty, 0),
  };
}

/** Embala lo picado en cajas sueltas. No puede superar qtyPicked. */
export function packPickedLines(
  snap: WmsSnapshot,
  orderId: string,
  operatorId: string | null = null,
  at = new Date().toISOString(),
): OutboundOpResult {
  const fill = orderFulfillment(snap, orderId);
  if (!fill) return { ok: false, error: "order_missing" };
  if (fill.order.status === "expedido") return { ok: false, error: "order_done" };
  if (!fill.wavesClosed) return { ok: false, error: "wave_open" };
  if (!fill.unpackedCases.length) return { ok: false, error: "nothing_picked" };

  const packIds = new Set(fill.unpackedCases.map((l) => l.id));
  const pickWaves = snap.pickWaves.map((w) => ({
    ...w,
    lines: w.lines.map((l) =>
      packIds.has(l.id) ? { ...l, qtyPacked: l.qtyPicked } : l,
    ),
  }));
  const packedQty = fill.unpackedCases.reduce((s, l) => s + l.qtyPicked, 0);
  const nextStatus =
    fill.order.status === "muelle" || fill.fullPalletsToStage.length ? fill.order.status : "embalaje";

  return {
    ok: true,
    snap: {
      ...snap,
      pickWaves,
      movements: [
        {
          id: `mv-pack-${orderId}-${at}`,
          at,
          type: "salida",
          skuId: fill.unpackedCases[0]!.skuId,
          palletId: null,
          fromSlotId: null,
          toSlotId: null,
          qty: packedQty,
          operatorId,
          fleetId: null,
          note: `Embalaje ${fill.order.code} · ${packedQty} ud. picadas`,
        },
        ...snap.movements,
      ],
      outbound: snap.outbound.map((o) =>
        o.id === orderId ? { ...o, status: nextStatus as OutboundOrder["status"] } : o,
      ),
    },
  };
}

export function packPickLine(
  snap: WmsSnapshot,
  waveId: string,
  lineId: string,
  qty: number,
): OutboundOpResult {
  const wave = snap.pickWaves.find((w) => w.id === waveId);
  const line = wave?.lines.find((l) => l.id === lineId);
  if (!wave || !line) return { ok: false, error: "line_missing" };
  if (line.status !== "picada") return { ok: false, error: "nothing_picked" };
  if (!Number.isFinite(qty) || qty < 0 || qty > line.qtyPicked) {
    return { ok: false, error: "invalid_qty" };
  }
  return {
    ok: true,
    snap: {
      ...snap,
      pickWaves: snap.pickWaves.map((w) =>
        w.id === waveId
          ? { ...w, lines: w.lines.map((l) => (l.id === lineId ? { ...l, qtyPacked: qty } : l)) }
          : w,
      ),
    },
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
  if (fulfillment.unpackedCases.length) return { ok: false, error: "not_packed" };

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
