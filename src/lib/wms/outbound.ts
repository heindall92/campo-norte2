import { applyTxToSnapshot, findBalance, ledgerLocationForPallet, locationOfPallet } from "./inventory-core";
import { isSsccTaken } from "./packing";
import { markShipmentPacked, markShipmentShipped, markShipmentStaged } from "./shipping";
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
  | "line_missing"
  | "sscc_taken";

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
      sscc: line.cartonSscc,
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

  let next: WmsSnapshot = {
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
  };
  for (const line of fill.unpackedCases) {
    const delta = line.qtyPicked - (line.qtyPacked ?? 0);
    const pallet = palletOf(snap, line.palletId);
    if (delta < 1 || !pallet) continue;
    const led = applyTxToSnapshot(next, {
      type: "PACK",
      skuId: line.skuId,
      lot: pallet.lot || null,
      fromLocationId: locationOfPallet(pallet),
      qty: delta,
      reason: `pack ${fill.order.code}`,
      refType: "pick_line",
      refId: line.id,
      palletId: pallet.id,
      actorId: operatorId,
      at,
      id: `itx-PACK-${line.id}-${at}`,
    });
    if (!led.ok) return { ok: false, error: "invalid_qty" };
    next = led.snap;
  }
  const packed = markShipmentPacked(next, orderId, at);
  return { ok: true, snap: packed.ok ? packed.snap : next };
}

function cleanCartonSscc(value: string | null | undefined): string | null {
  const t = value?.trim() ?? "";
  return t.length ? t : null;
}

export function packPickLine(
  snap: WmsSnapshot,
  waveId: string,
  lineId: string,
  qty: number,
  cartonSscc?: string | null,
): OutboundOpResult {
  const wave = snap.pickWaves.find((w) => w.id === waveId);
  const line = wave?.lines.find((l) => l.id === lineId);
  if (!wave || !line) return { ok: false, error: "line_missing" };
  if (line.status !== "picada") return { ok: false, error: "nothing_picked" };
  if (!Number.isFinite(qty) || qty < 0 || qty > line.qtyPicked) {
    return { ok: false, error: "invalid_qty" };
  }
  const sscc = qty < 1 ? null : cartonSscc === undefined ? line.cartonSscc : cleanCartonSscc(cartonSscc);
  if (sscc && isSsccTaken(snap, sscc, { lineId: line.id })) return { ok: false, error: "sscc_taken" };
  const physical: WmsSnapshot = {
    ...snap,
    pickWaves: snap.pickWaves.map((w) =>
      w.id === waveId
        ? {
            ...w,
            lines: w.lines.map((l) =>
              l.id === lineId ? { ...l, qtyPacked: qty, cartonSscc: sscc } : l,
            ),
          }
        : w,
    ),
  };
  const delta = qty - (line.qtyPacked ?? 0);
  const pallet = palletOf(snap, line.palletId);
  const withPacked = (nextSnap: WmsSnapshot): OutboundOpResult => {
    const order = snap.outbound.find((o) => o.code === line.orderCode);
    if (!order) return { ok: true, snap: nextSnap };
    const packed = markShipmentPacked(nextSnap, order.id);
    return { ok: true, snap: packed.ok ? packed.snap : nextSnap };
  };
  if (delta < 1 || !pallet) return { ok: true, snap: physical };
  const led = applyTxToSnapshot(physical, {
    type: "PACK",
    skuId: line.skuId,
    lot: pallet.lot || null,
    fromLocationId: locationOfPallet(pallet),
    qty: delta,
    reason: `pack line ${line.id}`,
    refType: "pick_line",
    refId: line.id,
    palletId: pallet.id,
    at: new Date().toISOString(),
    id: `itx-PACK-${line.id}`,
  });
  if (!led.ok) return { ok: false, error: "invalid_qty" };
  return withPacked(led.snap);
}

/** HTML del manifiesto para imprimir. No inventa SSCC ni tracking. */
export function loadManifestPrintHtml(
  snap: WmsSnapshot,
  manifest: LoadManifest,
  lang: "es" | "en" = "es",
): string {
  const site = snap.sites.find((s) => s.id === manifest.order.siteId);
  const skuName = (id: string) => snap.skus.find((s) => s.id === id)?.name ?? id;
  const esc = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rows = manifest.rows
    .map((r) => {
      const kind = r.kind === "pallet" ? (lang === "es" ? "Palet" : "Pallet") : lang === "es" ? "Caja" : "Case";
      return `<tr>
        <td>${esc(kind)}</td>
        <td>${esc(skuName(r.skuId))}</td>
        <td>${esc(r.sscc ?? (lang === "es" ? "sin SSCC" : "no SSCC"))}</td>
        <td>${esc(r.slotCode ?? "—")}</td>
        <td style="text-align:right">${r.qty}</td>
      </tr>`;
    })
    .join("");
  const title = lang === "es" ? "Manifiesto de muelle" : "Dock manifest";
  const tracking = manifest.tracking ?? (lang === "es" ? "sin tracking" : "no tracking");
  const carrier = manifest.carrierName ?? (lang === "es" ? "sin carrier" : "no carrier");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/><title>${esc(title)} ${esc(manifest.order.code)}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;margin:24px}
  h1{font-size:20px;margin:0 0 4px}
  p,td,th{font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{border-bottom:1px solid #cbd5e1;padding:6px 4px;text-align:left}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#475569}
  .meta{color:#475569}
  @media print{body{margin:12mm}}
</style></head><body>
  <h1>${esc(title)}</h1>
  <p class="meta">${esc(snap.org.legalName)} · ${esc(site?.name ?? site?.city ?? "")}</p>
  <p><strong>${esc(manifest.order.code)}</strong> · ${esc(manifest.order.customer)} · ${esc(manifest.dock)}</p>
  <p class="meta">${esc(carrier)} · ${esc(tracking)}
    · ${manifest.palletCount} ${lang === "es" ? "palets" : "pallets"}
    · ${manifest.caseCount} ${lang === "es" ? "cajas" : "cases"}</p>
  <table>
    <thead><tr>
      <th>${lang === "es" ? "Tipo" : "Kind"}</th>
      <th>SKU</th>
      <th>SSCC</th>
      <th>${lang === "es" ? "Hueco" : "Slot"}</th>
      <th style="text-align:right">${lang === "es" ? "Cant." : "Qty"}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="meta">${lang === "es"
    ? "Solo figura lo picado y embalado o cargado. El SSCC y el tracking vacíos no se rellenan solos."
    : "Only picked and packed or staged goods. Empty SSCC and tracking are not filled in."}</p>
</body></html>`;
}

export function openLoadManifestPrint(
  snap: WmsSnapshot,
  orderId: string,
  lang: "es" | "en" = "es",
): boolean {
  if (typeof window === "undefined") return false;
  const manifest = buildLoadManifest(snap, orderId);
  if (!manifest || !manifest.rows.length) return false;
  const popup = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
  if (!popup) return false;
  popup.document.write(loadManifestPrintHtml(snap, manifest, lang));
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
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

  let next: WmsSnapshot = {
    ...snap,
    slots,
    pallets,
    movements,
    outbound: snap.outbound.map((o) =>
      o.id === order.id && o.status !== "expedido" ? { ...o, status: "muelle" as const } : o,
    ),
  };
  for (const pallet of take) {
    const loc = ledgerLocationForPallet(next, pallet);
    const bal = findBalance(next, pallet.skuId, pallet.lot || null, loc);
    const qty = bal ? bal.picked + bal.packed : 0;
    if (qty < 1) continue;
    const led = applyTxToSnapshot(next, {
      type: "STAGE",
      skuId: pallet.skuId,
      lot: pallet.lot || null,
      fromLocationId: loc,
      qty,
      reason: `stage ${order.code}`,
      refType: "order",
      refId: order.id,
      palletId: pallet.id,
      actorId: operatorId,
      at,
      id: `itx-STAGE-${pallet.id}-${at}`,
    });
    if (!led.ok) return { ok: false, error: "invalid_qty" };
    next = led.snap;
  }
  const staged = markShipmentStaged(next, order.id, at);
  return { ok: true, snap: staged.ok ? staged.snap : next };
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

  let next: WmsSnapshot = {
    ...snap,
    slots,
    pallets,
    movements,
    outbound: snap.outbound.map((o) =>
      o.id === orderId ? { ...o, status: "expedido" as const } : o,
    ),
  };
  const shipQty = new Map<string, { pallet: Pallet; qty: number }>();
  for (const line of fulfillment.lines) {
    if (line.status !== "picada" || line.qtyPicked < 1 || !line.palletId) continue;
    const pallet = palletOf(snap, line.palletId);
    if (!pallet) continue;
    const prev = shipQty.get(pallet.id);
    shipQty.set(pallet.id, { pallet, qty: (prev?.qty ?? 0) + line.qtyPicked });
  }
  for (const { pallet, qty } of shipQty.values()) {
    const loc = ledgerLocationForPallet(next, pallet);
    const led = applyTxToSnapshot(next, {
      type: "SHIP",
      skuId: pallet.skuId,
      lot: pallet.lot || null,
      fromLocationId: loc,
      qty,
      reason: `ship ${fulfillment.order.code}`,
      refType: "order",
      refId: orderId,
      palletId: pallet.id,
      actorId: operatorId,
      at,
      id: `itx-SHIP-${pallet.id}-${at}`,
    });
    if (!led.ok) return { ok: false, error: "invalid_qty" };
    next = led.snap;
  }
  const shipped = markShipmentShipped(next, orderId, at);
  return { ok: true, snap: shipped.ok ? shipped.snap : next };
}
