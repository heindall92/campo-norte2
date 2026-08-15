import type { Operator, OperatorRoleFloor, ShiftCode } from "./types";

export const ROSTER_TARGET_PER_SHIFT = 25;
export const ROSTER_PRIMARY_SITE = "site-sev";

const VACANT_ROLES: OperatorRoleFloor[] = [
  "picker",
  "carretillero",
  "recepcion",
  "expedicion",
  "calidad",
];

export function normalizeOperator(op: Operator): Operator {
  return {
    ...op,
    vacant: Boolean(op.vacant),
    fingerprintEnrolled: Boolean(op.fingerprintEnrolled),
    pinHash: op.pinHash ?? null,
  };
}

/**
 * Completa el cupo 25/25/25 del hub principal con plazas «Alta pendiente».
 * No inventa identidades: las plazas vacantes no tienen nombre ni horas.
 */
export function ensureShiftRoster(
  operators: Operator[],
  siteId = ROSTER_PRIMARY_SITE,
  target = ROSTER_TARGET_PER_SHIFT,
): Operator[] {
  const next = operators.map(normalizeOperator);
  const shifts: ShiftCode[] = ["manana", "tarde", "noche"];
  for (const shift of shifts) {
    const count = next.filter((o) => o.siteId === siteId && o.shift === shift).length;
    for (let i = count; i < target; i++) {
      const n = i + 1;
      const role = VACANT_ROLES[i % VACANT_ROLES.length]!;
      next.push({
        id: `vac-${siteId}-${shift}-${String(n).padStart(2, "0")}`,
        code: `VAC-${shift.slice(0, 1).toUpperCase()}${String(n).padStart(2, "0")}`,
        name: "Alta pendiente",
        role,
        shift,
        siteId,
        active: false,
        vacant: true,
        certifications: [],
        costPerHour: 0,
        picksPerHour: 0,
        movesToday: 0,
        hoursToday: 0,
        overtimeHoursWeek: 0,
        hiredAt: "",
        fingerprintEnrolled: false,
        pinHash: null,
      });
    }
  }
  return next;
}

export function rosterCounts(operators: Operator[], siteId: string) {
  const shifts: ShiftCode[] = ["manana", "tarde", "noche"];
  return Object.fromEntries(
    shifts.map((shift) => {
      const rows = operators.filter((o) => o.siteId === siteId && o.shift === shift);
      return [
        shift,
        {
          total: rows.length,
          hired: rows.filter((o) => !o.vacant).length,
          vacant: rows.filter((o) => o.vacant).length,
        },
      ];
    }),
  ) as Record<ShiftCode, { total: number; hired: number; vacant: number }>;
}
