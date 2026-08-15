import { laborCostToday, monthCosts } from "./stats";
import type { OperatorRoleFloor, ShiftCode, WmsSnapshot } from "./types";

/** Tarifas 3PL demo (Andalucía / hubs EU) — ficticias, coherentes con retail. */
export const WMS_TARIFF = {
  storageSlotDayEur: 0.38,
  handlingInEur: 4.8,
  handlingOutEur: 6.2,
  pickLineEur: 0.42,
  daysInMonth: 30,
} as const;

export interface UnitEconomics {
  palletMoves: number;
  pickLinesDone: number;
  pickLinesOpen: number;
  laborTodayEur: number;
  fleetTodayEur: number;
  costPerPalletMoveEur: number;
  costPerPickLineEur: number;
}

export interface SitePnl {
  siteId: string;
  month: string;
  storageEur: number;
  handlingEur: number;
  pickEur: number;
  revenueEur: number;
  opexEur: number;
  budgetEur: number;
  contributionEur: number;
  marginPct: number;
}

export function countPalletMoves(snap: WmsSnapshot, siteId?: string): number {
  return snap.movements.filter((m) => {
    if (m.type !== "entrada" && m.type !== "salida" && m.type !== "traslado") return false;
    if (!siteId) return true;
    const slotId = m.toSlotId ?? m.fromSlotId;
    const slot = slotId ? snap.slots.find((s) => s.id === slotId) : null;
    return !slot || slot.siteId === siteId;
  }).length;
}

export function computeUnitEconomics(snap: WmsSnapshot, siteId?: string): UnitEconomics {
  const operators = snap.operators.filter((o) => o.active && (!siteId || o.siteId === siteId));
  const fleet = snap.fleet.filter((f) => !siteId || f.siteId === siteId);
  const laborTodayEur = laborCostToday(operators);
  const fleetTodayEur = fleet.reduce((s, f) => s + f.hoursToday * f.costPerHour, 0);
  const palletMoves = Math.max(1, countPalletMoves(snap, siteId));
  const siteWaves = snap.pickWaves.filter((w) => !siteId || w.siteId === siteId);
  const pickLinesDone = siteWaves.reduce(
    (s, w) => s + w.lines.filter((l) => l.status === "picada").length,
    0,
  );
  const pickLinesOpen = siteWaves.reduce(
    (s, w) => s + w.lines.filter((l) => l.status !== "picada" && l.status !== "omitida").length,
    0,
  );
  const pickerLabor = operators
    .filter((o) => o.role === "picker")
    .reduce((s, o) => s + o.hoursToday * o.costPerHour, 0);
  const pickDenom = Math.max(1, pickLinesDone + pickLinesOpen);

  return {
    palletMoves: countPalletMoves(snap, siteId),
    pickLinesDone,
    pickLinesOpen,
    laborTodayEur,
    fleetTodayEur,
    costPerPalletMoveEur: (laborTodayEur + fleetTodayEur) / palletMoves,
    costPerPickLineEur: pickerLabor / pickDenom,
  };
}

export function computeSitePnl(
  snap: WmsSnapshot,
  month = "2026-08",
  siteId?: string,
): SitePnl {
  const sid = siteId ?? snap.sites[0]?.id ?? "";
  const occupied = snap.slots.filter((s) => s.siteId === sid && (s.status === "ocupado" || s.status === "reservado")).length;
  const inboundDone = snap.inbound
    .filter((i) => i.siteId === sid)
    .reduce((s, i) => s + i.palletsDone, 0);
  const outboundPallets = snap.outbound
    .filter((o) => o.siteId === sid && o.status !== "pendiente")
    .reduce((s, o) => s + o.pallets, 0);
  const pickLines = snap.pickWaves
    .filter((w) => w.siteId === sid)
    .reduce((s, w) => s + w.lines.length, 0);

  const storageEur = occupied * WMS_TARIFF.storageSlotDayEur * WMS_TARIFF.daysInMonth;
  const handlingEur = inboundDone * WMS_TARIFF.handlingInEur + outboundPallets * WMS_TARIFF.handlingOutEur;
  const pickEur = pickLines * WMS_TARIFF.pickLineEur;
  const revenueEur = storageEur + handlingEur + pickEur;
  const costs = monthCosts(snap.costs, month, sid);
  const opexEur = costs.reduce((s, c) => s + c.amountEur, 0);
  const budgetEur = costs.reduce((s, c) => s + c.budgetEur, 0);
  const contributionEur = revenueEur - opexEur;

  return {
    siteId: sid,
    month,
    storageEur,
    handlingEur,
    pickEur,
    revenueEur,
    opexEur,
    budgetEur,
    contributionEur,
    marginPct: revenueEur ? (contributionEur / revenueEur) * 100 : 0,
  };
}

export const SHIFT_LABEL: Record<ShiftCode, { es: string; en: string }> = {
  manana: { es: "Mañana", en: "Morning" },
  tarde: { es: "Tarde", en: "Afternoon" },
  noche: { es: "Noche", en: "Night" },
};

export const ROLE_FLOOR_LABEL: Record<OperatorRoleFloor, { es: string; en: string }> = {
  supervisor: { es: "Supervisor", en: "Supervisor" },
  carretillero: { es: "Carretillero", en: "Reach / forklift" },
  picker: { es: "Picker", en: "Picker" },
  recepcion: { es: "Recepción", en: "Inbound" },
  expedicion: { es: "Expedición", en: "Outbound" },
  calidad: { es: "Calidad", en: "QA" },
};

/** Dotación mínima por turno (hub tipo hipermercado). */
export const SHIFT_REQUIREMENT: Record<
  string,
  Record<ShiftCode, Partial<Record<OperatorRoleFloor, number>>>
> = {
  "site-sev": {
    manana: { supervisor: 1, carretillero: 2, picker: 2, recepcion: 1, expedicion: 1, calidad: 1 },
    tarde: { carretillero: 1, picker: 2, recepcion: 1, expedicion: 1 },
    noche: { carretillero: 1, picker: 1 },
  },
  "site-hue": {
    manana: { picker: 1, recepcion: 1 },
    tarde: { carretillero: 1 },
    noche: {},
  },
};

export interface ShiftGap {
  siteId: string;
  shift: ShiftCode;
  role: OperatorRoleFloor;
  required: number;
  actual: number;
  gap: number;
}

export interface ShiftCoverage {
  siteId: string;
  gaps: ShiftGap[];
  overtimeRisk: number;
  headsByShift: Record<ShiftCode, number>;
}

export function computeShiftCoverage(snap: WmsSnapshot, siteId?: string): ShiftCoverage {
  const sid = siteId ?? snap.sites[0]?.id ?? "";
  const req = SHIFT_REQUIREMENT[sid] ?? SHIFT_REQUIREMENT["site-sev"]!;
  const ops = snap.operators.filter((o) => o.active && o.siteId === sid);
  const gaps: ShiftGap[] = [];
  const headsByShift: Record<ShiftCode, number> = { manana: 0, tarde: 0, noche: 0 };

  for (const o of ops) headsByShift[o.shift] += 1;

  for (const shift of ["manana", "tarde", "noche"] as ShiftCode[]) {
    const need = req[shift] ?? {};
    for (const role of Object.keys(need) as OperatorRoleFloor[]) {
      const required = need[role] ?? 0;
      const actual = ops.filter((o) => o.shift === shift && o.role === role).length;
      if (required === 0 && actual === 0) continue;
      gaps.push({
        siteId: sid,
        shift,
        role,
        required,
        actual,
        gap: actual - required,
      });
    }
  }

  return {
    siteId: sid,
    gaps,
    overtimeRisk: ops.filter((o) => o.overtimeHoursWeek > 4).length,
    headsByShift,
  };
}

export const CAMPO_NORTE_ORG = {
  id: "org-camponorte",
  legalName: "Campo Norte Logística, S.L.",
  plan: "WMS OS · multi-hub",
  billingCurrency: "EUR",
  /** RLS / org_id en Postgres: siguiente capa infra, no simulada aquí. */
  rlsReady: false,
} as const;
