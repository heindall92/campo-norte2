import { applyTxToSnapshot, locationOfPallet } from "./inventory-core";
import { codesEqual } from "./location";
import type { SlotFix, SlotFixReason, WmsSnapshot } from "./types";

export type SlotFixError =
  | "slot_missing"
  | "invalid_qty"
  | "no_pallet"
  | "fix_missing"
  | "already_fixed";

export type SlotFixResult =
  | { ok: true; snap: WmsSnapshot; fixId: string }
  | { ok: false; error: SlotFixError };

export const SLOT_FIX_REASON_LABEL: Record<SlotFixReason, { es: string; en: string }> = {
  merma: { es: "Merma", en: "Shrink" },
  de_mas: { es: "Cogió producto de más", en: "Took extra product" },
  roto: { es: "Roto", en: "Broken" },
  pico_mal: { es: "Picó mal", en: "Picked wrong" },
  otra: { es: "Otra (escribir)", en: "Other (write it)" },
};

export function pendingSlotFixes(snap: WmsSnapshot, siteId?: string): SlotFix[] {
  return snap.slotFixes.filter((f) => {
    if (f.status !== "pendiente") return false;
    if (siteId && f.siteId !== siteId) return false;
    return true;
  });
}

export function blockedSlotIds(snap: WmsSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const slot of snap.slots) {
    if (slot.status === "bloqueado") ids.add(slot.id);
  }
  for (const fix of snap.slotFixes) {
    if (fix.status === "pendiente") ids.add(fix.slotId);
  }
  return ids;
}

/**
 * El operario avisa desde el aparato: el hueco no coincide.
 * Bloquea el hueco para que el jefe lo cuadre. No cambia el stock.
 */
export function reportSlotMismatch(
  snap: WmsSnapshot,
  input: {
    slotCode: string;
    takeQty: number;
    operatorId?: string | null;
    note?: string;
  },
  at = new Date().toISOString(),
): SlotFixResult {
  const slot = snap.slots.find((s) => codesEqual(s.code, input.slotCode.trim()));
  if (!slot) return { ok: false, error: "slot_missing" };
  const pallet = slot.palletId ? snap.pallets.find((p) => p.id === slot.palletId) : null;
  const existing = snap.slotFixes.find((f) => f.slotId === slot.id && f.status === "pendiente");
  if (existing) {
    return {
      ok: true,
      fixId: existing.id,
      snap: {
        ...snap,
        slots: snap.slots.map((s) => (s.id === slot.id ? { ...s, status: "bloqueado" as const } : s)),
      },
    };
  }

  const row: SlotFix = {
    id: `fix-${slot.id}-${at}`,
    at,
    siteId: slot.siteId,
    slotId: slot.id,
    palletId: pallet?.id ?? null,
    skuId: pallet?.skuId ?? "",
    systemQty: pallet?.qty ?? 0,
    takeQty: Number.isFinite(input.takeQty) ? Math.max(0, input.takeQty) : 0,
    countedQty: null,
    reason: null,
    note: input.note?.trim() ?? "",
    reportedBy: input.operatorId ?? null,
    fixedBy: null,
    status: "pendiente",
    fixedAt: null,
  };

  return {
    ok: true,
    fixId: row.id,
    snap: {
      ...snap,
      slots: snap.slots.map((s) => (s.id === slot.id ? { ...s, status: "bloqueado" as const } : s)),
      slotFixes: [row, ...snap.slotFixes],
    },
  };
}

/**
 * El jefe escribe lo que hay de verdad en el hueco y la razón del faltante.
 * No se inventa stock: countedQty es lo que cuenta.
 */
export function fixSlotCount(
  snap: WmsSnapshot,
  input: {
    slotCode: string;
    countedQty: number;
    reason: SlotFixReason;
    note?: string;
    fixedBy?: string | null;
    fixId?: string;
  },
  at = new Date().toISOString(),
): SlotFixResult {
  if (!Number.isFinite(input.countedQty) || input.countedQty < 0) {
    return { ok: false, error: "invalid_qty" };
  }
  const slot = snap.slots.find((s) => codesEqual(s.code, input.slotCode.trim()));
  if (!slot) return { ok: false, error: "slot_missing" };
  const pallet = slot.palletId ? snap.pallets.find((p) => p.id === slot.palletId) : null;
  if (!pallet && input.countedQty > 0) return { ok: false, error: "no_pallet" };

  let fix = input.fixId ? snap.slotFixes.find((f) => f.id === input.fixId) : undefined;
  if (input.fixId && !fix) return { ok: false, error: "fix_missing" };
  if (fix?.status === "arreglado") return { ok: false, error: "already_fixed" };
  if (!fix) {
    fix = snap.slotFixes.find((f) => f.slotId === slot.id && f.status === "pendiente");
  }

  const emptied = input.countedQty <= 0;
  const pallets = pallet
    ? snap.pallets.map((p) =>
        p.id === pallet.id
          ? {
              ...p,
              qty: input.countedQty,
              slotId: emptied ? null : p.slotId,
              status: emptied ? ("picking" as const) : p.status,
            }
          : p,
      )
    : snap.pallets;

  const slots = snap.slots.map((s) => {
    if (s.id !== slot.id) return s;
    if (emptied) return { ...s, palletId: null, status: "libre" as const };
    return { ...s, status: "ocupado" as const };
  });

  const reasonLabel = SLOT_FIX_REASON_LABEL[input.reason].es;
  const completed: SlotFix = {
    id: fix?.id ?? `fix-${slot.id}-${at}`,
    at: fix?.at ?? at,
    siteId: slot.siteId,
    slotId: slot.id,
    palletId: pallet?.id ?? null,
    skuId: pallet?.skuId ?? fix?.skuId ?? "",
    systemQty: fix?.systemQty ?? pallet?.qty ?? 0,
    takeQty: fix?.takeQty ?? 0,
    countedQty: input.countedQty,
    reason: input.reason,
    note: input.note?.trim() || fix?.note || "",
    reportedBy: fix?.reportedBy ?? null,
    fixedBy: input.fixedBy ?? null,
    status: "arreglado",
    fixedAt: at,
  };

  const slotFixes = fix
    ? snap.slotFixes.map((f) => (f.id === completed.id ? completed : f))
    : [completed, ...snap.slotFixes];

  const physical: WmsSnapshot = {
    ...snap,
    pallets,
    slots,
    slotFixes,
    movements: [
      {
        id: `mv-fix-${slot.id}-${at}`,
        at,
        type: "ajuste",
        skuId: completed.skuId,
        palletId: pallet?.id ?? null,
        fromSlotId: slot.id,
        toSlotId: slot.id,
        qty: input.countedQty - (pallet?.qty ?? 0),
        operatorId: input.fixedBy ?? null,
        fleetId: null,
        note: `Hueco arreglado · ${reasonLabel} · ${slot.code} · había ${completed.systemQty} · cuenta ${input.countedQty}`,
      },
      ...snap.movements,
    ],
  };
  if (!pallet) return { ok: true, fixId: completed.id, snap: physical };
  const led = applyTxToSnapshot(physical, {
    type: "COUNT",
    skuId: pallet.skuId,
    lot: pallet.lot || null,
    fromLocationId: locationOfPallet(pallet),
    qty: 0,
    countedQty: input.countedQty,
    reason: `slot-fix:${input.reason}`,
    refType: "slot_fix",
    refId: completed.id,
    palletId: pallet.id,
    actorId: input.fixedBy ?? null,
    at,
    id: `itx-COUNT-fix-${slot.id}-${at}`,
  });
  if (!led.ok) return { ok: false, error: "invalid_qty" };
  return { ok: true, fixId: completed.id, snap: led.snap };
}
