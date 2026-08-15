/** Ubicación de almacén: Pasillo-Bahía-Nivel-Posición (ej. A-03-02-1). */

export type SlotPosition = 1 | 2;

export interface SlotAddress {
  aisle: string;
  bay: number;
  level: number;
  position: SlotPosition;
}

const CODE_RE = /^([A-Z]+)-(\d{2})-(\d{2})-([12])$/;

export function formatSlotCode(addr: SlotAddress): string {
  const aisle = addr.aisle.trim().toUpperCase();
  return `${aisle}-${String(addr.bay).padStart(2, "0")}-${String(addr.level).padStart(2, "0")}-${addr.position}`;
}

export function parseSlotCode(code: string): SlotAddress | null {
  const m = code.trim().toUpperCase().match(CODE_RE);
  if (!m) return null;
  return {
    aisle: m[1]!,
    bay: Number(m[2]),
    level: Number(m[3]),
    position: Number(m[4]) as SlotPosition,
  };
}

/** Nivel 1 = cara de picking (salvo muelle). Superiores = reserva. */
export function isPickFaceLevel(level: number, zone?: string): boolean {
  if (zone === "muelle" || zone === "crossdock") return false;
  return level === 1;
}

export function slotRecordId(siteId: string, code: string): string {
  return `${siteId}__${code}`;
}

export function codesEqual(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}
