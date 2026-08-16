/**
 * SSCC GS1 de 18 dígitos. El check digit es el algoritmo GS1 (módulo 10).
 * No reescribe SSCC ya persistidos en el snapshot.
 */

const GCP = "3841001";

function gs1CheckDigit(body17: string): number {
  let sum = 0;
  const chars = body17.split("").reverse();
  for (let i = 0; i < chars.length; i++) {
    const n = Number(chars[i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  return (10 - (sum % 10)) % 10;
}

export function formatSscc(serial9: number): string {
  const serial = String(Math.max(0, Math.floor(serial9))).padStart(9, "0").slice(-9);
  const body = `0${GCP}${serial}`;
  return `${body}${gs1CheckDigit(body)}`;
}

export function nextUniqueSscc(existing: Iterable<string>): string {
  const used = new Set(existing);
  let serial = (used.size % 1_000_000_000) + 1;
  for (let i = 0; i < 10_000; i++) {
    const sscc = formatSscc(serial + i);
    if (!used.has(sscc)) return sscc;
  }
  return formatSscc(Date.now() % 1_000_000_000);
}
