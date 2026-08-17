import { slotRecordId } from "@/lib/wms/location";
import type {
  AsnLine,
  InboundAsn,
  OrderLine,
  OutboundOrder,
  PickLine,
  PickLineStatus,
  PickWave,
  Slot,
  SlotStatus,
  WarehouseZone,
  WmsSnapshot,
} from "@/lib/wms/types";

const ORDER_STATUSES: OutboundOrder["status"][] = [
  "pendiente",
  "picking",
  "embalaje",
  "muelle",
  "expedido",
];
const ASN_STATUSES: InboundAsn["status"][] = [
  "previsto",
  "en_muelle",
  "descargando",
  "ubicando",
  "cerrado",
];
const WAVE_STATUSES: PickWave["status"][] = ["abierta", "en_curso", "cerrada"];
const PICK_STATUSES: PickLineStatus[] = ["pendiente", "en_curso", "picada", "faltante", "omitida"];
const SLOT_STATUSES: SlotStatus[] = ["libre", "ocupado", "reservado", "bloqueado", "inventario"];
const ZONES: WarehouseZone[] = ["seco", "fresco", "congelado", "picking", "muelle", "crossdock"];
const PRIORITIES: OutboundOrder["priority"][] = ["normal", "urgente", "express"];

function asStatus<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function iso(value: unknown): string {
  if (typeof value !== "string" || !value) return new Date().toISOString();
  return value;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export type FulfillmentPayload = {
  carriers: Array<{
    id: string;
    code: string;
    name: string;
    kind: string;
    cutoffDefault: string;
    active: boolean;
  }>;
  orders: Array<{
    id: string;
    code: string;
    customer: string;
    cutOff: string;
    dock: string;
    status: string;
    priority: string;
    siteId: string;
    carrierId: string | null;
    tracking: string | null;
    pallets: number;
    lines: number;
    dockWindowStart: string | null;
    dockWindowEnd: string | null;
  }>;
  orderLines: OrderLine[];
  asns: InboundAsn[];
  asnLines: AsnLine[];
  waves: Array<{
    id: string;
    code: string;
    aisle: string;
    siteId: string;
    kind: string;
    status: string;
    operatorId: string | null;
    fleetId: string | null;
    printedAt: string;
  }>;
  pickTasks: Array<{
    id: string;
    waveId: string;
    orderCode: string;
    skuId: string;
    qty: number;
    qtyPicked: number;
    qtyPacked: number;
    slotCode: string | null;
    palletId: string | null;
    status: string;
    sequence: number;
  }>;
  slots: Array<{
    code: string;
    siteId: string;
    zone: string;
    aisle: string;
    rack: number;
    level: number;
    position: number;
    pickFace: boolean;
    status: string;
    capacityPallets: number;
  }>;
};

/** Pedidos/ASN/olas/huecos para Postgres. Sin qty de palet ni ledger. */
export function fulfillmentPayload(snap: WmsSnapshot): FulfillmentPayload {
  const slotById = new Map(snap.slots.map((s) => [s.id, s]));
  return {
    carriers: snap.carriers.map((c) => ({
      id: c.id,
      code: c.code || c.id,
      name: c.name,
      kind: c.kind,
      cutoffDefault: c.cutoffDefault,
      active: c.active,
    })),
    orders: snap.outbound.map((o) => ({
      id: o.id,
      code: o.code,
      customer: o.customer,
      cutOff: o.cutOff,
      dock: o.dock,
      status: o.status,
      priority: o.priority,
      siteId: o.siteId,
      carrierId: snap.carriers.find((c) => c.id === o.carrierId)?.code ?? o.carrierId,
      tracking: o.tracking,
      pallets: o.pallets,
      lines: o.lines,
      dockWindowStart: o.dockWindowStart,
      dockWindowEnd: o.dockWindowEnd,
    })),
    orderLines: snap.orderLines ?? [],
    asns: snap.inbound,
    asnLines: snap.asnLines ?? [],
    waves: snap.pickWaves.map((w) => ({
      id: w.id,
      code: w.code,
      aisle: w.aisle,
      siteId: w.siteId,
      kind: w.kind,
      status: w.status,
      operatorId: w.operatorId,
      fleetId: w.fleetId,
      printedAt: w.printedAt,
    })),
    pickTasks: snap.pickWaves.flatMap((w) =>
      w.lines.map((l) => ({
        id: l.id,
        waveId: w.id,
        orderCode: l.orderCode,
        skuId: l.skuId,
        qty: l.qty,
        qtyPicked: l.qtyPicked,
        qtyPacked: l.qtyPacked,
        slotCode: slotById.get(l.slotId)?.code ?? null,
        palletId: l.palletId,
        status: l.status,
        sequence: l.sequence,
      })),
    ),
    slots: snap.slots.map((s) => ({
      code: s.code,
      siteId: s.siteId,
      zone: s.zone,
      aisle: s.aisle,
      rack: s.rack,
      level: s.level,
      position: s.position,
      pickFace: s.pickFace,
      status: s.status,
      capacityPallets: s.capacityPallets,
    })),
  };
}

/** El floor jsonb no transporta pedidos/ASN/olas: viven en tablas. */
export function stripFulfillmentForFloor(snap: WmsSnapshot): WmsSnapshot {
  return {
    ...snap,
    outbound: [],
    inbound: [],
    pickWaves: [],
    orderLines: [],
    asnLines: [],
  };
}

export function stripFloorForPostgres(snap: WmsSnapshot): WmsSnapshot {
  return stripFulfillmentForFloor({
    ...snap,
    ledger: [],
    balances: [],
    pallets: snap.pallets.map((p) => ({ ...p, qty: 0 })),
  });
}

function parseOrder(raw: Record<string, unknown>, carriers: WmsSnapshot["carriers"]): OutboundOrder | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const code = typeof raw.code === "string" ? raw.code : null;
  if (!id || !code) return null;
  const rawCar = typeof raw.carrierId === "string" ? raw.carrierId : null;
  const carrier = carriers.find((c) => c.id === rawCar || c.code === rawCar);
  return {
    id,
    code,
    customer: typeof raw.customer === "string" ? raw.customer : code,
    cutOff: iso(raw.cutOff),
    dock: typeof raw.dock === "string" ? raw.dock : "",
    status: asStatus(raw.status, ORDER_STATUSES, "pendiente"),
    lines: Math.max(0, Math.floor(num(raw.lines))),
    pallets: Math.max(0, Math.floor(num(raw.pallets))),
    priority: asStatus(raw.priority, PRIORITIES, "normal"),
    siteId: typeof raw.siteId === "string" ? raw.siteId : "site-sev",
    carrierId: carrier?.id ?? rawCar,
    tracking: typeof raw.tracking === "string" ? raw.tracking : null,
    dockWindowStart: isoOrNull(raw.dockWindowStart),
    dockWindowEnd: isoOrNull(raw.dockWindowEnd),
  };
}

function parseAsn(raw: Record<string, unknown>): InboundAsn | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const code = typeof raw.code === "string" ? raw.code : null;
  if (!id || !code) return null;
  return {
    id,
    code,
    supplier: typeof raw.supplier === "string" ? raw.supplier : "",
    eta: iso(raw.eta),
    dock: typeof raw.dock === "string" ? raw.dock : "",
    status: asStatus(raw.status, ASN_STATUSES, "previsto"),
    lines: Math.max(0, Math.floor(num(raw.lines))),
    palletsExpected: Math.max(0, Math.floor(num(raw.palletsExpected))),
    palletsDone: Math.max(0, Math.floor(num(raw.palletsDone))),
    siteId: typeof raw.siteId === "string" ? raw.siteId : "site-sev",
  };
}

function parseOrderLine(raw: Record<string, unknown>): OrderLine | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const orderId = typeof raw.orderId === "string" ? raw.orderId : null;
  const skuId = typeof raw.skuId === "string" ? raw.skuId : null;
  if (!id || !orderId || !skuId) return null;
  return {
    id,
    orderId,
    skuId,
    qtyOrdered: num(raw.qtyOrdered),
    qtyAllocated: num(raw.qtyAllocated),
    qtyPicked: num(raw.qtyPicked),
    qtyShipped: num(raw.qtyShipped),
  };
}

function parseAsnLine(raw: Record<string, unknown>): AsnLine | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const asnId = typeof raw.asnId === "string" ? raw.asnId : null;
  const skuId = typeof raw.skuId === "string" ? raw.skuId : null;
  if (!id || !asnId || !skuId) return null;
  return {
    id,
    asnId,
    skuId,
    qtyExpected: num(raw.qtyExpected),
    qtyReceived: num(raw.qtyReceived),
    lotExpected: typeof raw.lotExpected === "string" ? raw.lotExpected : null,
  };
}

function parseWave(
  raw: Record<string, unknown>,
  tasks: PickLine[],
): PickWave | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const code = typeof raw.code === "string" ? raw.code : null;
  if (!id || !code) return null;
  const kind = raw.kind === "reposicion" ? "reposicion" : "picking";
  return {
    id,
    code,
    aisle: typeof raw.aisle === "string" ? raw.aisle : "",
    siteId: typeof raw.siteId === "string" ? raw.siteId : "site-sev",
    kind,
    status: asStatus(raw.status, WAVE_STATUSES, "abierta"),
    operatorId: typeof raw.operatorId === "string" ? raw.operatorId : null,
    fleetId: typeof raw.fleetId === "string" ? raw.fleetId : null,
    printedAt: iso(raw.printedAt),
    lines: tasks
      .filter((t) => t.waveId === id)
      .sort((a, b) => a.sequence - b.sequence),
  };
}

function parsePickTask(
  raw: Record<string, unknown>,
  slots: Slot[],
): PickLine | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const waveId = typeof raw.waveId === "string" ? raw.waveId : null;
  const skuId = typeof raw.skuId === "string" ? raw.skuId : null;
  if (!id || !waveId || !skuId) return null;
  const slotCode = typeof raw.slotCode === "string" ? raw.slotCode : null;
  const slot = slotCode ? slots.find((s) => s.code === slotCode) : undefined;
  return {
    id,
    waveId,
    orderCode: typeof raw.orderCode === "string" ? raw.orderCode : "",
    skuId,
    qty: num(raw.qty),
    qtyPicked: num(raw.qtyPicked),
    qtyPacked: num(raw.qtyPacked),
    slotId: slot?.id ?? "",
    palletId: typeof raw.palletId === "string" ? raw.palletId : null,
    status: asStatus(raw.status, PICK_STATUSES, "pendiente"),
    sequence: Math.max(1, Math.floor(num(raw.sequence, 1))),
  };
}

const EXCEPTION_SLOT: SlotStatus[] = ["bloqueado", "inventario", "reservado"];

function overlaySlotStatus(slots: Slot[], rows: unknown[]): Slot[] {
  if (!rows.length) return slots;
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const code = typeof rec.code === "string" ? rec.code : null;
    const siteId = typeof rec.siteId === "string" ? rec.siteId : null;
    if (code && siteId) byKey.set(`${siteId}:${code}`, rec);
  }
  if (!byKey.size) return slots;

  const seen = new Set<string>();
  const next = slots.map((s) => {
    const rec = byKey.get(`${s.siteId}:${s.code}`);
    if (!rec) return s;
    seen.add(`${s.siteId}:${s.code}`);
    const status = asStatus(rec.status, SLOT_STATUSES, s.status);
    return {
      ...s,
      zone: asStatus(rec.zone, ZONES, s.zone),
      aisle: typeof rec.aisle === "string" ? rec.aisle : s.aisle,
      rack: Number.isFinite(Number(rec.rack)) ? Number(rec.rack) : s.rack,
      level: Number.isFinite(Number(rec.level)) ? Number(rec.level) : s.level,
      pickFace: typeof rec.pickFace === "boolean" ? rec.pickFace : s.pickFace,
      capacityPallets: Number.isFinite(Number(rec.capacityPallets))
        ? Number(rec.capacityPallets)
        : s.capacityPallets,
      status: EXCEPTION_SLOT.includes(status) ? status : s.status,
    };
  });

  for (const [key, rec] of byKey) {
    if (seen.has(key)) continue;
    const code = String(rec.code);
    const siteId = String(rec.siteId);
    const zone = asStatus(rec.zone, ZONES, "seco");
    const aisle = typeof rec.aisle === "string" ? rec.aisle : "A";
    const rack = Math.max(1, Math.floor(num(rec.rack, 1)));
    const level = Math.max(1, Math.floor(num(rec.level, 1)));
    const position = num(rec.position, 1) === 2 ? 2 : 1;
    next.push({
      id: slotRecordId(siteId, code),
      code,
      siteId,
      zone,
      aisle,
      rack,
      level,
      position,
      pickFace: Boolean(rec.pickFace),
      status: asStatus(rec.status, SLOT_STATUSES, "libre"),
      capacityPallets: Math.max(1, Math.floor(num(rec.capacityPallets, 1))),
      palletId: null,
      lastCountedAt: null,
    });
  }
  return next;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

export type FulfillmentRows = {
  orders?: unknown;
  orderLines?: unknown;
  asns?: unknown;
  asnLines?: unknown;
  waves?: unknown;
  pickTasks?: unknown;
  slots?: unknown;
};

/**
 * Tablas ganan sobre el jsonb para pedidos/ASN/olas.
 * Si las tablas están vacías, se conserva el floor (bootstrap).
 * Huecos: layout del floor; bloqueado/inventario/reservado sale de locations.
 */
export function overlayFulfillment(floor: WmsSnapshot, rows: FulfillmentRows | null | undefined): WmsSnapshot {
  if (!rows) return floor;
  const orderRows = asRecords(rows.orders).map((row) => parseOrder(row, floor.carriers)).filter((x): x is OutboundOrder => Boolean(x));
  const asnRows = asRecords(rows.asns).map(parseAsn).filter((x): x is InboundAsn => Boolean(x));
  const waveRaw = asRecords(rows.waves);
  const taskRows = asRecords(rows.pickTasks)
    .map((row) => parsePickTask(row, floor.slots))
    .filter((x): x is PickLine => Boolean(x));
  const waves = waveRaw
    .map((row) => parseWave(row, taskRows))
    .filter((x): x is PickWave => Boolean(x));

  const slots = overlaySlotStatus(floor.slots, asRecords(rows.slots));

  return {
    ...floor,
    outbound: orderRows.length ? orderRows : floor.outbound,
    inbound: asnRows.length ? asnRows : floor.inbound,
    pickWaves: waves.length ? waves : floor.pickWaves,
    orderLines: (() => {
      const parsed = asRecords(rows.orderLines)
        .map(parseOrderLine)
        .filter((x): x is OrderLine => Boolean(x));
      return parsed.length ? parsed : floor.orderLines;
    })(),
    asnLines: (() => {
      const parsed = asRecords(rows.asnLines)
        .map(parseAsnLine)
        .filter((x): x is AsnLine => Boolean(x));
      return parsed.length ? parsed : floor.asnLines;
    })(),
    slots,
  };
}
