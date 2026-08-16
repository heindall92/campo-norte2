/**
 * Productividad operativa. No es vigilancia:
 * el rollup usa código de operario, rol, turno, zona y almacén.
 * Nombre, PIN y huella viven en `operatorPii` y no se mezclan aquí.
 */
import { parseSlotCode } from "./location";
import type { OperatorRoleFloor, ShiftCode, WarehouseZone, WmsSnapshot } from "./types";

export type ProductivitySubject = "picker" | "packer" | "forklift" | "shift" | "zone" | "warehouse";

export interface ProductivityRates {
  subject: ProductivitySubject;
  subjectId: string;
  linesPerHour: number | null;
  unitsPerHour: number | null;
  ordersPerHour: number | null;
  pickAccuracyPct: number | null;
  travelDistanceM: number | null;
  avgTaskMinutes: number | null;
  sampleLines: number;
  hours: number;
}

export interface OperatorPii {
  operatorId: string;
  name: string;
  pinHash: string | null;
  fingerprintEnrolled: boolean;
}

const AISLE_M = 20;
const BAY_M = 3;
const LEVEL_M = 1.4;

function perHour(count: number, hours: number): number | null {
  if (hours <= 0) return null;
  return Math.round((count / hours) * 10) / 10;
}

export function estimateSlotDistanceM(fromCode: string, toCode: string): number {
  const a = parseSlotCode(fromCode);
  const b = parseSlotCode(toCode);
  if (!a || !b) return 0;
  const aisle = Math.abs(a.aisle.charCodeAt(0) - b.aisle.charCodeAt(0)) * AISLE_M;
  return aisle + Math.abs(a.bay - b.bay) * BAY_M + Math.abs(a.level - b.level) * LEVEL_M;
}

function waveTravelM(snap: WmsSnapshot, waveId: string): number {
  const wave = snap.pickWaves.find((w) => w.id === waveId);
  if (!wave) return 0;
  const slots = wave.lines
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((l) => snap.slots.find((s) => s.id === l.slotId)?.code)
    .filter((c): c is string => Boolean(c));
  let m = 0;
  for (let i = 1; i < slots.length; i += 1) m += estimateSlotDistanceM(slots[i - 1]!, slots[i]!);
  return Math.round(m);
}

function rates(input: {
  subject: ProductivitySubject;
  subjectId: string;
  hours: number;
  lines: number;
  units: number;
  orders: number;
  good: number;
  closed: number;
  travelM: number;
}): ProductivityRates {
  return {
    subject: input.subject,
    subjectId: input.subjectId,
    linesPerHour: perHour(input.lines, input.hours),
    unitsPerHour: perHour(input.units, input.hours),
    ordersPerHour: perHour(input.orders, input.hours),
    pickAccuracyPct: input.closed ? Math.round((input.good / input.closed) * 100) : null,
    travelDistanceM: input.travelM || null,
    avgTaskMinutes: input.lines && input.hours > 0 ? Math.round((input.hours * 60) / input.lines) : null,
    sampleLines: input.lines,
    hours: input.hours,
  };
}

function roleOf(subject: ProductivitySubject): OperatorRoleFloor | null {
  if (subject === "picker") return "picker";
  if (subject === "packer") return "expedicion";
  if (subject === "forklift") return "carretillero";
  return null;
}

/** PII aparte. La UI de productividad no debe pedir esto. */
export function listOperatorPii(snap: WmsSnapshot): OperatorPii[] {
  return snap.operators
    .filter((o) => !o.vacant)
    .map((o) => ({
      operatorId: o.id,
      name: o.name,
      pinHash: o.pinHash,
      fingerprintEnrolled: o.fingerprintEnrolled,
    }));
}

export function computeProductivity(
  snap: WmsSnapshot,
  siteId?: string,
): ProductivityRates[] {
  const rows: ProductivityRates[] = [];
  const ops = snap.operators.filter((o) => o.active && !o.vacant && (!siteId || o.siteId === siteId));

  for (const subject of ["picker", "packer", "forklift"] as const) {
    const role = roleOf(subject)!;
    for (const op of ops.filter((o) => o.role === role)) {
      const waves = snap.pickWaves.filter(
        (w) => w.operatorId === op.id && (!siteId || w.siteId === siteId),
      );
      const lines = waves.flatMap((w) => w.lines);
      const good = lines.filter((l) => l.status === "picada").length;
      const closed = lines.filter((l) => l.status === "picada" || l.status === "omitida" || l.status === "faltante").length;
      const units = lines.reduce((s, l) => s + (l.qtyPicked || 0), 0);
      const orders = new Set(lines.filter((l) => l.status === "picada").map((l) => l.orderCode)).size;
      const travel = waves.reduce((s, w) => s + waveTravelM(snap, w.id), 0);
      const packed = snap.loadUnits.filter((u) => u.operatorId === op.id && u.status !== "abierta");
      const packLines = subject === "packer" ? packed.length : good;
      const packUnits = subject === "packer" ? packed.reduce((s, u) => s + u.qty, 0) : units;
      rows.push(
        rates({
          subject,
          subjectId: op.code,
          hours: op.hoursToday,
          lines: subject === "forklift" ? op.movesToday : packLines,
          units: subject === "forklift" ? op.movesToday : packUnits,
          orders,
          good,
          closed,
          travelM: travel,
        }),
      );
    }
  }

  for (const shift of ["manana", "tarde", "noche"] as ShiftCode[]) {
    const group = ops.filter((o) => o.shift === shift);
    const hours = group.reduce((s, o) => s + o.hoursToday, 0);
    const ids = new Set(group.map((o) => o.id));
    const waves = snap.pickWaves.filter((w) => w.operatorId && ids.has(w.operatorId) && (!siteId || w.siteId === siteId));
    const lines = waves.flatMap((w) => w.lines);
    const good = lines.filter((l) => l.status === "picada").length;
    const closed = lines.filter((l) => l.status === "picada" || l.status === "omitida" || l.status === "faltante").length;
    rows.push(
      rates({
        subject: "shift",
        subjectId: shift,
        hours,
        lines: good,
        units: lines.reduce((s, l) => s + (l.qtyPicked || 0), 0),
        orders: new Set(lines.filter((l) => l.status === "picada").map((l) => l.orderCode)).size,
        good,
        closed,
        travelM: waves.reduce((s, w) => s + waveTravelM(snap, w.id), 0),
      }),
    );
  }

  const zones = new Set(snap.slots.filter((s) => !siteId || s.siteId === siteId).map((s) => s.zone));
  for (const zone of zones) {
    const slotIds = new Set(
      snap.slots.filter((s) => s.zone === zone && (!siteId || s.siteId === siteId)).map((s) => s.id),
    );
    const lines = snap.pickWaves
      .filter((w) => !siteId || w.siteId === siteId)
      .flatMap((w) => w.lines)
      .filter((l) => slotIds.has(l.slotId));
    const good = lines.filter((l) => l.status === "picada").length;
    const closed = lines.filter((l) => l.status === "picada" || l.status === "omitida" || l.status === "faltante").length;
    const hours = ops.reduce((s, o) => s + o.hoursToday, 0);
    rows.push(
      rates({
        subject: "zone",
        subjectId: zone as WarehouseZone,
        hours,
        lines: good,
        units: lines.reduce((s, l) => s + (l.qtyPicked || 0), 0),
        orders: new Set(lines.filter((l) => l.status === "picada").map((l) => l.orderCode)).size,
        good,
        closed,
        travelM: 0,
      }),
    );
  }

  const siteHours = ops.reduce((s, o) => s + o.hoursToday, 0);
  const siteWaves = snap.pickWaves.filter((w) => !siteId || w.siteId === siteId);
  const siteLines = siteWaves.flatMap((w) => w.lines);
  const siteGood = siteLines.filter((l) => l.status === "picada").length;
  const siteClosed = siteLines.filter(
    (l) => l.status === "picada" || l.status === "omitida" || l.status === "faltante",
  ).length;
  rows.push(
    rates({
      subject: "warehouse",
      subjectId: siteId ?? snap.sites[0]?.id ?? "org",
      hours: siteHours,
      lines: siteGood,
      units: siteLines.reduce((s, l) => s + (l.qtyPicked || 0), 0),
      orders: new Set(siteLines.filter((l) => l.status === "picada").map((l) => l.orderCode)).size,
      good: siteGood,
      closed: siteClosed,
      travelM: siteWaves.reduce((s, w) => s + waveTravelM(snap, w.id), 0),
    }),
  );

  return rows;
}

export function productivityHasPii(row: ProductivityRates): boolean {
  return Boolean(row.subjectId.includes("@") || row.subjectId.includes(" "));
}
