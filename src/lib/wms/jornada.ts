import { hoursFromPunches, lastPunch } from "./clock";
import { pinsMatch } from "./fingerprint";
import { WMS_DEMO_NOW } from "./alerts";
import type { Operator, ShiftCode, WmsSnapshot } from "./types";

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
