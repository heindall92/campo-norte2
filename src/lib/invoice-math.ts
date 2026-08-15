/**
 * Matemáticas REAV (régimen especial agencias de viajes).
 * La base imponible es el margen; el IVA se calcula sobre esa base, no sobre el total cobrado al viajero.
 */

/** IVA sobre margen REAV (2 decimales comerciales). */
export function reavVatAmount(taxBase: number, vatRatePct: number): number {
  if (!Number.isFinite(taxBase) || !Number.isFinite(vatRatePct)) return 0;
  return Math.round(taxBase * vatRatePct) / 100;
}

/** Comprueba coherencia: vatAmount ≈ taxBase × vatRate. */
export function reavVatMatches(
  taxBase: number,
  vatRatePct: number,
  vatAmount: number,
  epsilon = 0.02,
): boolean {
  const expected = reavVatAmount(taxBase, vatRatePct);
  return Math.abs(expected - vatAmount) <= epsilon;
}

/**
 * En REAV el total al cliente NO tiene por qué ser taxBase + IVA
 * (el margen es solo una parte del precio de venta).
 */
export function isReavPriceShape(taxBase: number, vatAmount: number, total: number): boolean {
  if (total <= 0 || taxBase < 0 || vatAmount < 0) return false;
  return taxBase + vatAmount <= total + 0.01;
}
