/** Conversiones UOM. El inventario usa siempre unidad base. */

export type DemoUom = "ud" | "caja" | "kg" | "palet";

export type CanonicalUom = "UNIT" | "BOX" | "CASE" | "PALLET" | "KG" | "L";

export interface UomConversion {
  code: CanonicalUom | string;
  qtyInBase: number;
}

const DEMO_ALIAS: Record<DemoUom, CanonicalUom> = {
  ud: "UNIT",
  caja: "CASE",
  kg: "KG",
  palet: "PALLET",
};

export function canonicalUom(code: string): string {
  const lower = code.trim().toLowerCase();
  if (lower in DEMO_ALIAS) return DEMO_ALIAS[lower as DemoUom];
  return code.trim().toUpperCase();
}

/**
 * 1 CASE = 12 UNIT (defecto retail).
 * 1 PALLET = unitsPerPallet CASE (o UNIT si el SKU ya está en ud).
 */
export function conversionsForSku(input: {
  uom: DemoUom;
  unitsPerPallet: number;
  unitsPerCase?: number;
}): UomConversion[] {
  const perCase = input.unitsPerCase && input.unitsPerCase > 0 ? input.unitsPerCase : 12;
  const perPallet = input.unitsPerPallet > 0 ? input.unitsPerPallet : 1;

  if (input.uom === "kg") {
    return [
      { code: "KG", qtyInBase: 1 },
      { code: "PALLET", qtyInBase: perPallet },
    ];
  }
  if (input.uom === "ud") {
    return [
      { code: "UNIT", qtyInBase: 1 },
      { code: "CASE", qtyInBase: perCase },
      { code: "PALLET", qtyInBase: perPallet },
    ];
  }
  return [
    { code: "UNIT", qtyInBase: 1 },
    { code: "CASE", qtyInBase: perCase },
    { code: "PALLET", qtyInBase: perCase * perPallet },
  ];
}

export function toBaseQty(
  qty: number,
  uom: string,
  conversions: readonly UomConversion[],
): number | null {
  if (!Number.isFinite(qty) || qty < 0) return null;
  const code = canonicalUom(uom);
  const row = conversions.find((c) => canonicalUom(c.code) === code);
  if (!row) return null;
  return qty * row.qtyInBase;
}

export function fromBaseQty(
  qtyBase: number,
  uom: string,
  conversions: readonly UomConversion[],
): number | null {
  if (!Number.isFinite(qtyBase) || qtyBase < 0) return null;
  const code = canonicalUom(uom);
  const row = conversions.find((c) => canonicalUom(c.code) === code);
  if (!row || row.qtyInBase <= 0) return null;
  return qtyBase / row.qtyInBase;
}
