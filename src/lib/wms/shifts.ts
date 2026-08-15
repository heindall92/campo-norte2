import { computeShiftCoverage, DEFAULT_SHIFT_REQUIREMENT, SHIFT_REQUIREMENT } from "./economics";
import type { Operator, OperatorRoleFloor, ShiftCode, WmsSnapshot } from "./types";

const ALL_SHIFTS: ShiftCode[] = ["manana", "tarde", "noche"];
/** Cubrir primero noche: es el hueco más difícil de staffear. */
const SHIFT_FILL_ORDER: ShiftCode[] = ["noche", "tarde", "manana"];

export type ShiftAssignError = "operator_missing" | "inactive";

export interface ShiftMove {
  operatorId: string;
  operatorName: string;
  role: OperatorRoleFloor;
  fromShift: ShiftCode;
  toShift: ShiftCode;
  reason: "cover_gap";
}

export function assignOperatorShift(
  snap: WmsSnapshot,
  operatorId: string,
  toShift: ShiftCode,
): { ok: true; snap: WmsSnapshot } | { ok: false; error: ShiftAssignError } {
  const op = snap.operators.find((o) => o.id === operatorId);
  if (!op) return { ok: false, error: "operator_missing" };
  if (!op.active) return { ok: false, error: "inactive" };
  if (op.shift === toShift) return { ok: true, snap };
  return {
    ok: true,
    snap: {
      ...snap,
      operators: snap.operators.map((o) => (o.id === operatorId ? { ...o, shift: toShift } : o)),
    },
  };
}

export function applyShiftMoves(snap: WmsSnapshot, moves: ShiftMove[]): WmsSnapshot {
  if (moves.length === 0) return snap;
  const byId = new Map(moves.map((m) => [m.operatorId, m.toShift]));
  return {
    ...snap,
    operators: snap.operators.map((o) => {
      const next = byId.get(o.id);
      return next ? { ...o, shift: next } : o;
    }),
  };
}

function requirement(
  siteId: string,
  shift: ShiftCode,
  role: OperatorRoleFloor,
): number {
  return (SHIFT_REQUIREMENT[siteId] ?? DEFAULT_SHIFT_REQUIREMENT)[shift]?.[role] ?? 0;
}

function countRole(ops: Operator[], shift: ShiftCode, role: OperatorRoleFloor): number {
  return ops.filter((o) => o.shift === shift && o.role === role).length;
}

/**
 * Mueve excedente de un rol hacia huecos, priorizando noche (más difícil de cubrir).
 * No deja al turno donante por debajo de la dotación mínima.
 */
export function proposeShiftFills(snap: WmsSnapshot, siteId: string): ShiftMove[] {
  const ops = snap.operators
    .filter((o) => o.active && o.siteId === siteId)
    .map((o) => ({ ...o }));
  const moves: ShiftMove[] = [];
  const req = SHIFT_REQUIREMENT[siteId] ?? DEFAULT_SHIFT_REQUIREMENT;

  for (const toShift of SHIFT_FILL_ORDER) {
    const need = req[toShift] ?? {};
    for (const role of Object.keys(need) as OperatorRoleFloor[]) {
      const required = need[role] ?? 0;
      while (countRole(ops, toShift, role) < required) {
        const donor = ALL_SHIFTS.filter((s) => s !== toShift)
          .flatMap((fromShift) => {
            const surplus = countRole(ops, fromShift, role) - requirement(siteId, fromShift, role);
            if (surplus <= 0) return [];
            return ops
              .filter((o) => o.shift === fromShift && o.role === role)
              .map((o) => ({ o, fromShift, surplus }));
          })
          .sort((a, b) => {
            if (b.surplus !== a.surplus) return b.surplus - a.surplus;
            if (a.o.overtimeHoursWeek !== b.o.overtimeHoursWeek) {
              return a.o.overtimeHoursWeek - b.o.overtimeHoursWeek;
            }
            return a.o.hoursToday - b.o.hoursToday;
          })[0];

        if (!donor) break;
        moves.push({
          operatorId: donor.o.id,
          operatorName: donor.o.name,
          role,
          fromShift: donor.fromShift,
          toShift,
          reason: "cover_gap",
        });
        donor.o.shift = toShift;
      }
    }
  }

  return moves;
}

export function remainingHireGaps(snap: WmsSnapshot, siteId: string) {
  return computeShiftCoverage(snap, siteId).gaps.filter((g) => g.gap < 0);
}
