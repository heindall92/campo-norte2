import { hashIdentityPin, pinLooksValid, pinsMatch } from "./fingerprint";
import type { ClockPunch, Operator, WmsSnapshot } from "./types";

export type ClockError =
  | "operator_missing"
  | "operator_vacant"
  | "pin_invalid"
  | "pin_mismatch"
  | "already_in"
  | "not_in"
  | "adapter_empty";

export type ClockResult = { ok: true; snap: WmsSnapshot } | { ok: false; error: ClockError };

function newPunchId(): string {
  return `clk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function lastPunch(punches: ClockPunch[], operatorId: string): ClockPunch | null {
  return punches.filter((p) => p.operatorId === operatorId).at(0) ?? null;
}

/** Horas del día a partir de pares entrada/salida. No inventa fichajes. */
export function hoursFromPunches(punches: ClockPunch[], operatorId: string, dayIso: string): number {
  const day = dayIso.slice(0, 10);
  const mine = punches
    .filter((p) => p.operatorId === operatorId && p.at.slice(0, 10) === day)
    .slice()
    .reverse();
  let open: number | null = null;
  let ms = 0;
  for (const p of mine) {
    const t = new Date(p.at).getTime();
    if (p.kind === "entrada") open = t;
    if (p.kind === "salida" && open !== null) {
      ms += Math.max(0, t - open);
      open = null;
    }
  }
  return Math.round((ms / 3_600_000) * 10) / 10;
}

export function enrollOperatorPin(
  snap: WmsSnapshot,
  operatorId: string,
  pin: string,
): ClockResult {
  if (!pinLooksValid(pin)) return { ok: false, error: "pin_invalid" };
  const op = snap.operators.find((o) => o.id === operatorId);
  if (!op) return { ok: false, error: "operator_missing" };
  if (op.vacant) return { ok: false, error: "operator_vacant" };
  return {
    ok: true,
    snap: {
      ...snap,
      operators: snap.operators.map((o) =>
        o.id === operatorId
          ? { ...o, fingerprintEnrolled: true, pinHash: hashIdentityPin(pin) }
          : o,
      ),
    },
  };
}

function applyPunch(
  snap: WmsSnapshot,
  op: Operator,
  kind: ClockPunch["kind"],
  method: ClockPunch["method"],
  at: string,
  note: string,
): WmsSnapshot {
  const punch: ClockPunch = {
    id: newPunchId(),
    operatorId: op.id,
    siteId: op.siteId,
    kind,
    at,
    method,
    note,
  };
  const punches = [punch, ...snap.clockPunches];
  const hours = hoursFromPunches(punches, op.id, at);
  return {
    ...snap,
    clockPunches: punches,
    operators: snap.operators.map((o) =>
      o.id === op.id ? { ...o, hoursToday: hours || o.hoursToday } : o,
    ),
  };
}

export function clockWithPin(
  snap: WmsSnapshot,
  operatorId: string,
  pin: string,
  kind: ClockPunch["kind"],
  at = new Date().toISOString(),
): ClockResult {
  const op = snap.operators.find((o) => o.id === operatorId);
  if (!op) return { ok: false, error: "operator_missing" };
  if (op.vacant) return { ok: false, error: "operator_vacant" };
  if (!pinsMatch(pin, op.pinHash)) return { ok: false, error: "pin_mismatch" };
  const last = lastPunch(snap.clockPunches, operatorId);
  if (kind === "entrada" && last?.kind === "entrada") return { ok: false, error: "already_in" };
  if (kind === "salida" && last?.kind !== "entrada") return { ok: false, error: "not_in" };
  return {
    ok: true,
    snap: applyPunch(snap, op, kind, "pin", at, "PIN de verificación (no es huella biométrica)"),
  };
}

/**
 * Punch que llega de un agente local (pyzk / ZKTeco).
 * El SaaS no lee el sensor: solo acepta el evento ya ocurrido.
 */
export function ingestAdapterPunch(
  snap: WmsSnapshot,
  input: { operatorId: string; kind: ClockPunch["kind"]; at: string; deviceId: string },
): ClockResult {
  if (!input.deviceId.trim() || !input.at) return { ok: false, error: "adapter_empty" };
  const op = snap.operators.find((o) => o.id === input.operatorId);
  if (!op) return { ok: false, error: "operator_missing" };
  if (op.vacant) return { ok: false, error: "operator_vacant" };
  return {
    ok: true,
    snap: applyPunch(
      snap,
      op,
      input.kind,
      "adapter",
      input.at,
      `Adaptador ZKTeco ${input.deviceId.trim()}`,
    ),
  };
}
