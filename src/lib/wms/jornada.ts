import { hoursFromPunches, lastPunch } from "./clock";
import { pinsMatch } from "./fingerprint";
import { WMS_DEMO_NOW } from "./alerts";
import type { ClockMethod, ClockPunch, Operator, ShiftCode, StockMovement, WmsSnapshot } from "./types";

/** Ventanas de turno (hora local del centro). No se inventan horas extra. */
export const SHIFT_WINDOW: Record<ShiftCode, { start: string; end: string; plannedHours: number }> = {
  manana: { start: "06:00", end: "14:00", plannedHours: 8 },
  tarde: { start: "14:00", end: "22:00", plannedHours: 8 },
  noche: { start: "22:00", end: "06:00", plannedHours: 8 },
};

export type PickGateError =
  | "operator_missing"
  | "operator_vacant"
  | "not_clocked"
  | "pin_required"
  | "pin_mismatch";

export interface OperatorJornada {
  operator: Operator;
  clockedIn: boolean;
  lastKind: "entrada" | "salida" | null;
  hoursWorked: number;
  plannedHours: number;
  overtimeHours: number;
  withinWindow: boolean;
  windowLabel: string;
  method: string | null;
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isWithinShiftWindow(shift: ShiftCode, at: Date): boolean {
  const win = SHIFT_WINDOW[shift];
  const minutes = at.getHours() * 60 + at.getMinutes();
  const start = minutesOf(win.start);
  const end = minutesOf(win.end);
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

export function operatorJornada(
  snap: WmsSnapshot,
  operatorId: string,
  now = new Date(WMS_DEMO_NOW),
): OperatorJornada | null {
  const operator = snap.operators.find((o) => o.id === operatorId);
  if (!operator) return null;
  const last = lastPunch(snap.clockPunches, operatorId);
  const clockedIn = last?.kind === "entrada";
  const hoursWorked = hoursFromPunches(snap.clockPunches, operatorId, now.toISOString(), now.toISOString());
  const plannedHours = SHIFT_WINDOW[operator.shift].plannedHours;
  const win = SHIFT_WINDOW[operator.shift];
  return {
    operator,
    clockedIn,
    lastKind: last?.kind ?? null,
    hoursWorked,
    plannedHours,
    overtimeHours: Math.max(0, Math.round((hoursWorked - plannedHours) * 10) / 10),
    withinWindow: isWithinShiftWindow(operator.shift, now),
    windowLabel: `${win.start}–${win.end}`,
    method: last?.method ?? null,
  };
}

/** Planta: hay que haber fichado. Dirección/almacén no se bloquean aquí. */
export function assertCanPick(
  snap: WmsSnapshot,
  operatorId: string,
  pin: string | null,
  requireClock: boolean,
): { ok: true } | { ok: false; error: PickGateError } {
  const op = snap.operators.find((o) => o.id === operatorId);
  if (!op) return { ok: false, error: "operator_missing" };
  if (op.vacant) return { ok: false, error: "operator_vacant" };
  if (requireClock) {
    const last = lastPunch(snap.clockPunches, operatorId);
    if (last?.kind !== "entrada") return { ok: false, error: "not_clocked" };
  }
  if (op.fingerprintEnrolled) {
    if (!pin) return { ok: false, error: "pin_required" };
    if (!pinsMatch(pin, op.pinHash)) return { ok: false, error: "pin_mismatch" };
  }
  return { ok: true };
}

export interface ShiftCloseOperator {
  operator: Operator;
  punches: ClockPunch[];
  hoursWorked: number;
  clockedIn: boolean;
  lastKind: "entrada" | "salida" | null;
  method: ClockMethod | null;
}

export interface ShiftClose {
  siteId: string;
  day: string;
  operators: ShiftCloseOperator[];
  punchesTotal: number;
  hoursTotal: number;
  stillIn: number;
  movements: StockMovement[];
  inboundMoves: number;
  outboundMoves: number;
  transfers: number;
  adjustments: number;
}

function movementAtSite(snap: WmsSnapshot, move: StockMovement, siteId: string): boolean {
  const from = move.fromSlotId ? snap.slots.find((s) => s.id === move.fromSlotId) : null;
  const to = move.toSlotId ? snap.slots.find((s) => s.id === move.toSlotId) : null;
  if (from?.siteId === siteId || to?.siteId === siteId) return true;
  const op = move.operatorId ? snap.operators.find((o) => o.id === move.operatorId) : null;
  return op?.siteId === siteId;
}

/**
 * Cierre de jornada: solo fichajes y movimientos del día.
 * No inventa horas, operarios ni KPIs de productividad.
 */
export function buildShiftClose(
  snap: WmsSnapshot,
  siteId: string,
  dayIso = WMS_DEMO_NOW,
): ShiftClose {
  const day = dayIso.slice(0, 10);
  const punches = snap.clockPunches.filter((p) => p.siteId === siteId && p.at.slice(0, 10) === day);
  const byOp = new Map<string, ClockPunch[]>();
  for (const punch of punches) {
    const list = byOp.get(punch.operatorId) ?? [];
    list.push(punch);
    byOp.set(punch.operatorId, list);
  }
  const operators: ShiftCloseOperator[] = [...byOp.entries()]
    .flatMap(([operatorId, list]) => {
      const operator = snap.operators.find((o) => o.id === operatorId);
      if (!operator) return [];
      const last = lastPunch(list, operatorId);
      const row: ShiftCloseOperator = {
        operator,
        punches: list.slice().sort((a, b) => a.at.localeCompare(b.at)),
        hoursWorked: hoursFromPunches(list, operatorId, dayIso, dayIso),
        clockedIn: last?.kind === "entrada",
        lastKind: last?.kind ?? null,
        method: last?.method ?? null,
      };
      return [row];
    })
    .sort((a, b) => a.operator.name.localeCompare(b.operator.name));

  const movements = snap.movements.filter(
    (m) => m.at.slice(0, 10) === day && movementAtSite(snap, m, siteId),
  );
  return {
    siteId,
    day,
    operators,
    punchesTotal: punches.length,
    hoursTotal: Math.round(operators.reduce((s, o) => s + o.hoursWorked, 0) * 10) / 10,
    stillIn: operators.filter((o) => o.clockedIn).length,
    movements,
    inboundMoves: movements.filter((m) => m.type === "entrada").length,
    outboundMoves: movements.filter((m) => m.type === "salida").length,
    transfers: movements.filter((m) => m.type === "traslado").length,
    adjustments: movements.filter((m) => m.type === "ajuste" || m.type === "inventario").length,
  };
}
