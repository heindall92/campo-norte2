import { applyTxToSnapshot, locationOfPallet } from "./inventory-core";
import { codesEqual } from "./location";
import type { FleetKind, PickLine, PickWave, StockMovement, WmsSnapshot } from "./types";

export function nextOpenLine(wave: PickWave): PickLine | null {
  return (
    wave.lines.find((l) => l.status === "en_curso") ??
    wave.lines.find((l) => l.status === "pendiente") ??
    null
  );
}

export type ConfirmPickInput = {
  slotCode: string;
  sscc: string;
  qty: number;
};

export type ConfirmPickError =
  | "wave_missing"
  | "line_missing"
  | "line_not_open"
  | "wrong_slot"
  | "wrong_sscc"
  | "invalid_qty"
  | "pallet_missing"
  | "slot_blocked";

export type ConfirmPickResult =
  | { ok: true; snap: WmsSnapshot }
  | { ok: false; error: ConfirmPickError };

/** Recogepedidos en cara de picking; retráctil doble stand-up para reposición desde reserva. */
export function recommendedFleetKind(kind: PickWave["kind"]): FleetKind {
  return kind === "reposicion" ? "retractil_doble" : "recogepedidos";
}

export function confirmPick(
  snap: WmsSnapshot,
  waveId: string,
  lineId: string,
  input: ConfirmPickInput,
  at = "2026-08-15T10:00:00.000Z",
): ConfirmPickResult {
  const wave = snap.pickWaves.find((w) => w.id === waveId);
  if (!wave) return { ok: false, error: "wave_missing" };

  const line = wave.lines.find((l) => l.id === lineId);
  if (!line) return { ok: false, error: "line_missing" };
  if (line.status !== "pendiente" && line.status !== "en_curso") {
    return { ok: false, error: "line_not_open" };
  }

  const slot = snap.slots.find((s) => s.id === line.slotId);
  if (!slot || !codesEqual(slot.code, input.slotCode)) {
    return { ok: false, error: "wrong_slot" };
  }
  if (slot.status === "bloqueado") {
    return { ok: false, error: "slot_blocked" };
  }

  const pallet = line.palletId ? snap.pallets.find((p) => p.id === line.palletId) : null;
  if (!pallet) return { ok: false, error: "pallet_missing" };
  if (input.sscc.trim() !== pallet.sscc) return { ok: false, error: "wrong_sscc" };
  if (!Number.isFinite(input.qty) || input.qty < 1 || input.qty > line.qty || input.qty > pallet.qty) {
    return { ok: false, error: "invalid_qty" };
  }

  const nextLines = wave.lines.map((l) => {
    if (l.id === line.id) return { ...l, status: "picada" as const, qtyPicked: input.qty, qtyPacked: 0, cartonSscc: null };
    if (l.status === "pendiente" && l.sequence === line.sequence + 1) {
      return { ...l, status: "en_curso" as const };
    }
    return l;
  });
  const allDone = nextLines.every(
    (l) => l.status === "picada" || l.status === "omitida" || l.status === "faltante",
  );
  const nextWave: PickWave = {
    ...wave,
    status: allDone ? "cerrada" : "en_curso",
    lines: nextLines,
  };

  const remaining = pallet.qty - input.qty;
  const emptied = remaining <= 0;
  const nextPallets = snap.pallets.map((p) =>
    p.id === pallet.id
      ? {
          ...p,
          qty: Math.max(0, remaining),
          status: emptied ? ("picking" as const) : p.status,
          slotId: emptied ? null : p.slotId,
        }
      : p,
  );
  const nextSlots = emptied
    ? snap.slots.map((s) =>
        s.id === slot.id ? { ...s, palletId: null, status: "libre" as const } : s,
      )
    : snap.slots;

  const movement: StockMovement = {
    id: `mv-pick-${line.id}`,
    at,
    type: wave.kind === "reposicion" ? "traslado" : "salida",
    skuId: line.skuId,
    palletId: pallet.id,
    fromSlotId: slot.id,
    toSlotId: null,
    qty: input.qty,
    operatorId: wave.operatorId,
    fleetId: wave.fleetId,
    note: `${nextWave.code} · ${slot.code}`,
  };

  const nextOperators = snap.operators.map((o) =>
    o.id === wave.operatorId ? { ...o, movesToday: o.movesToday + 1 } : o,
  );

  const physical: WmsSnapshot = {
    ...snap,
    pickWaves: snap.pickWaves.map((w) => (w.id === nextWave.id ? nextWave : w)),
    slots: nextSlots,
    pallets: nextPallets,
    movements: [movement, ...snap.movements],
    operators: nextOperators,
    reservations: (snap.reservations ?? []).map((r) =>
      r.status === "hold" && r.palletId === pallet.id && (r.lineId === line.id || r.orderCode === line.orderCode)
        ? { ...r, status: "consumed" as const, revision: r.revision + 1 }
        : r,
    ),
    inventoryReservations: (snap.inventoryReservations ?? []).map((r) =>
      r.status === "open" && r.palletId === pallet.id && (r.lineId === line.id || r.orderCode === line.orderCode)
        ? { ...r, status: "consumed" as const, revision: r.revision + 1 }
        : r,
    ),
  };
  const led = applyTxToSnapshot(physical, {
    type: "PICK",
    skuId: line.skuId,
    lot: pallet.lot || null,
    fromLocationId: locationOfPallet(pallet),
    qty: input.qty,
    reason: nextWave.code,
    refType: "pick_line",
    refId: line.id,
    palletId: pallet.id,
    actorId: wave.operatorId,
    at,
    id: `itx-PICK-${line.id}-${at}`,
  });
  if (!led.ok) return { ok: false, error: "invalid_qty" };
  return { ok: true, snap: led.snap };
}

function closeLine(
  snap: WmsSnapshot,
  waveId: string,
  lineId: string,
  status: "omitida" | "faltante",
  qtyPicked: number,
  note: string,
  at: string,
): ConfirmPickResult {
  const wave = snap.pickWaves.find((w) => w.id === waveId);
  if (!wave) return { ok: false, error: "wave_missing" };
  const line = wave.lines.find((l) => l.id === lineId);
  if (!line) return { ok: false, error: "line_missing" };
  if (line.status !== "pendiente" && line.status !== "en_curso") {
    return { ok: false, error: "line_not_open" };
  }

  const nextLines = wave.lines.map((l) => {
    if (l.id === line.id) return { ...l, status, qtyPicked, qtyPacked: 0, cartonSscc: null };
    if (l.status === "pendiente" && l.sequence === line.sequence + 1) {
      return { ...l, status: "en_curso" as const };
    }
    return l;
  });
  const allDone = nextLines.every(
    (l) => l.status === "picada" || l.status === "omitida" || l.status === "faltante",
  );
  const nextWave: PickWave = {
    ...wave,
    status: allDone ? "cerrada" : "en_curso",
    lines: nextLines,
  };

  return {
    ok: true,
    snap: {
      ...snap,
      pickWaves: snap.pickWaves.map((w) => (w.id === nextWave.id ? nextWave : w)),
      movements: [
        {
          id: `mv-${status}-${line.id}`,
          at,
          type: "ajuste",
          skuId: line.skuId,
          palletId: line.palletId,
          fromSlotId: line.slotId,
          toSlotId: null,
          qty: qtyPicked,
          operatorId: wave.operatorId,
          fleetId: wave.fleetId,
          note,
        },
        ...snap.movements,
      ],
    },
  };
}

export function skipPickLine(
  snap: WmsSnapshot,
  waveId: string,
  lineId: string,
  reason = "omitida en pasillo",
  at = "2026-08-15T10:00:00.000Z",
): ConfirmPickResult {
  return closeLine(snap, waveId, lineId, "omitida", 0, reason, at);
}

export function markShortage(
  snap: WmsSnapshot,
  waveId: string,
  lineId: string,
  qtyFound: number,
  at = "2026-08-15T10:00:00.000Z",
): ConfirmPickResult {
  const wave = snap.pickWaves.find((w) => w.id === waveId);
  const line = wave?.lines.find((l) => l.id === lineId);
  if (line && (!Number.isFinite(qtyFound) || qtyFound < 0 || qtyFound >= line.qty)) {
    return { ok: false, error: "invalid_qty" };
  }
  return closeLine(
    snap,
    waveId,
    lineId,
    "faltante",
    qtyFound,
    `faltante · encontrado ${qtyFound}`,
    at,
  );
}
