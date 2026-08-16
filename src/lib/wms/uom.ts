/**
 * Conversiones de UOM configurables. El inventario cuenta en unidad base.
 * No inventa un inner pack: si no hay factor, no se convierte.
 */

export const UOM_CODES = ["UNIT", "BOX", "CASE", "PALLET", "KG", "L"] as const;
export type UomCode = (typeof UOM_CODES)[number];

/** UOM del SKU actual (español) → código canónico. */
export const LEGACY_UOM: Record<"ud" | "caja" | "kg" | "palet", UomCode> = {
  ud: "UNIT",
  caja: "CASE",
  kg: "KG",
  palet: "PALLET",
};

export interface UomFactor {
  /** Si falta, aplica a cualquier SKU. */
  skuId: string | null;
  from: UomCode;
  to: UomCode;
  /** 1 `from` = `factor` `to`. Debe ser > 0. */
  factor: number;
}

export type UomError = "unknown_uom" | "no_factor" | "invalid_qty" | "invalid_factor";

export type UomResult = { ok: true; qty: number; uom: UomCode } | { ok: false; error: UomError };

export function isUomCode(value: string): value is UomCode {
  return (UOM_CODES as readonly string[]).includes(value);
}

export function normalizeUom(value: string): UomCode | null {
  const raw = value.trim().toUpperCase();
  if (raw === "UD" || raw === "UN" || raw === "EA" || raw === "EACH") return "UNIT";
  if (raw === "CAJA") return "CASE";
  if (raw === "PALET" || raw === "PLT") return "PALLET";
  return isUomCode(raw) ? raw : null;
}

function factorBetween(from: UomCode, to: UomCode, table: UomFactor[], skuId?: string | null): number | null {
  if (from === to) return 1;
  const rows = table.filter((r) => r.factor > 0 && (!r.skuId || r.skuId === skuId));
  const direct = rows.find((r) => r.from === from && r.to === to);
  if (direct) return direct.factor;
  const inverse = rows.find((r) => r.from === to && r.to === from);
  if (inverse) return 1 / inverse.factor;
  return null;
}

/**
 * Pasa `qty` de `from` a `to` con la tabla. Sin factor escrito → error, no se adivina.
 */
export function convertUom(
  qty: number,
  from: UomCode,
  to: UomCode,
  table: UomFactor[],
  skuId?: string | null,
): UomResult {
  if (!Number.isFinite(qty) || qty < 0) return { ok: false, error: "invalid_qty" };
  if (!isUomCode(from) || !isUomCode(to)) return { ok: false, error: "unknown_uom" };
  const factor = factorBetween(from, to, table, skuId);
  if (factor == null) return { ok: false, error: "no_factor" };
  if (!Number.isFinite(factor) || factor <= 0) return { ok: false, error: "invalid_factor" };
  return { ok: true, qty: qty * factor, uom: to };
}

export function toBase(qty: number, from: UomCode, base: UomCode, table: UomFactor[], skuId?: string | null): UomResult {
  return convertUom(qty, from, base, table, skuId);
}

/**
 * Factores que sí están escritos en el SKU actual: 1 PALLET = unitsPerPallet CASE (o UNIT si el SKU es ud).
 * No añade 12 UNIT por CASE: eso solo si lo configuran.
 */
export function factorsFromSku(sku: {
  id: string;
  uom: "ud" | "caja" | "kg" | "palet";
  unitsPerPallet: number;
}): UomFactor[] {
  const each = LEGACY_UOM[sku.uom];
  if (each === "PALLET" || each === "KG" || each === "L") return [];
  if (!Number.isFinite(sku.unitsPerPallet) || sku.unitsPerPallet < 1) return [];
  return [
    {
      skuId: sku.id,
      from: "PALLET",
      to: each,
      factor: sku.unitsPerPallet,
    },
  ];
}

/** Ejemplo del brief, solo para tests / config explícita. No se aplica a la semilla. */
export const EXAMPLE_CASE_PALLET: UomFactor[] = [
  { skuId: null, from: "CASE", to: "UNIT", factor: 12 },
  { skuId: null, from: "PALLET", to: "CASE", factor: 48 },
];
