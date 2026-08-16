/**
 * Selección de lote. FEFO no fabrica caducidad: solo ordena las que ya están escritas.
 */

export type LotPolicy = "FIFO" | "FEFO" | "LIFO" | "MANUAL";

export type LotAlertKind = "EXPIRING_SOON" | "EXPIRED" | "BLOCKED";

export interface LotCandidate {
  id: string;
  lot: string;
  batchCode: string | null;
  qty: number;
  receivedAt: string;
  expiry: string | null;
  manufacturedAt: string | null;
  blocked: boolean;
}

const SOON_MS = 7 * 24 * 60 * 60 * 1000;

export function classifyLotAlert(lot: LotCandidate, nowMs: number, soonMs = SOON_MS): LotAlertKind | null {
  if (lot.blocked) return "BLOCKED";
  if (!lot.expiry) return null;
  const exp = new Date(lot.expiry).getTime();
  if (Number.isNaN(exp)) return null;
  if (exp <= nowMs) return "EXPIRED";
  if (exp - nowMs <= soonMs) return "EXPIRING_SOON";
  return null;
}

function timeOr(iso: string | null, fallback: number): number {
  if (!iso) return fallback;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? fallback : t;
}

/**
 * Elige un lote. MANUAL no elige: hay que pasar `manualId`.
 * FEFO: menor `expiry` entre no bloqueados y no caducados; sin expiry van al final.
 * FIFO: menor `receivedAt`. LIFO: mayor `receivedAt`.
 */
export function selectLot(
  candidates: LotCandidate[],
  policy: LotPolicy,
  nowMs: number,
  manualId?: string | null,
): LotCandidate | null {
  if (policy === "MANUAL") {
    if (!manualId) return null;
    return candidates.find((c) => c.id === manualId && c.qty > 0) ?? null;
  }

  const open = candidates.filter((c) => c.qty > 0 && !c.blocked && classifyLotAlert(c, nowMs) !== "EXPIRED");
  if (!open.length) return null;

  const sorted = [...open].sort((a, b) => {
    if (policy === "FEFO") {
      const ae = a.expiry ? timeOr(a.expiry, Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      const be = b.expiry ? timeOr(b.expiry, Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      if (ae !== be) return ae - be;
    }
    const ar = timeOr(a.receivedAt, 0);
    const br = timeOr(b.receivedAt, 0);
    if (policy === "LIFO") return br - ar;
    return ar - br;
  });
  return sorted[0] ?? null;
}

export function lotFromPallet(pallet: {
  id: string;
  lot: string;
  qty: number;
  receivedAt: string;
  expiry: string | null;
  status: string;
}): LotCandidate {
  return {
    id: pallet.id,
    lot: pallet.lot,
    batchCode: pallet.lot,
    qty: pallet.qty,
    receivedAt: pallet.receivedAt,
    expiry: pallet.expiry,
    manufacturedAt: null,
    blocked: pallet.status === "cuarentena" || pallet.status === "expedido",
  };
}
