/**
 * Parser GS1 / EAN. Solo extrae AIs presentes. No genera SSCC ni GTIN.
 */

export type BarcodeSymbology = "EAN-13" | "EAN-128" | "GS1-128" | "GS1-DataMatrix" | "SSCC" | "GTIN" | "unknown";

export interface ParsedBarcode {
  raw: string;
  symbology: BarcodeSymbology;
  gtin: string | null;
  lot: string | null;
  exp: string | null;
  sscc: string | null;
  serial: string | null;
}

const GS1_FNC1 = String.fromCharCode(29);

const AI_FIXED: Record<string, number> = {
  "00": 18,
  "01": 14,
  "02": 14,
  "11": 6,
  "13": 6,
  "15": 6,
  "17": 6,
};

function gs1CheckDigit(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const n = Number(body[body.length - 1 - i]);
    sum += n * (i % 2 === 0 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
}

export function gs1CheckDigitOk(digits: string): boolean {
  if (!/^\d{8,18}$/.test(digits)) return false;
  return digits.slice(-1) === gs1CheckDigit(digits.slice(0, -1));
}

function yymmddToIso(yymmdd: string): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function takeAi(rest: string): { ai: string; value: string; next: string } | null {
  const paren = rest.match(/^\((\d{2,4})\)/);
  if (paren) {
    const ai = paren[1]!;
    const after = rest.slice(paren[0].length);
    const fixed = AI_FIXED[ai];
    if (fixed) {
      return { ai, value: after.slice(0, fixed), next: after.slice(fixed) };
    }
    const cut = after.search(/\(|$/);
    return { ai, value: after.slice(0, cut), next: after.slice(cut) };
  }
  for (const len of [4, 3, 2]) {
    const ai = rest.slice(0, len);
    if (AI_FIXED[ai] != null || ai === "10" || ai === "21") {
      const fixed = AI_FIXED[ai];
      if (fixed) {
        return { ai, value: rest.slice(len, len + fixed), next: rest.slice(len + fixed) };
      }
      const body = rest.slice(len);
      const fnc = body.indexOf(GS1_FNC1);
      const value = fnc >= 0 ? body.slice(0, fnc) : body;
      const next = fnc >= 0 ? body.slice(fnc + GS1_FNC1.length) : "";
      return { ai, value, next };
    }
  }
  return null;
}

function empty(raw: string, symbology: BarcodeSymbology): ParsedBarcode {
  return { raw, symbology, gtin: null, lot: null, exp: null, sscc: null, serial: null };
}

function applyAi(out: ParsedBarcode, ai: string, value: string): void {
  if (ai === "00") out.sscc = value;
  if (ai === "01" || ai === "02") out.gtin = value;
  if (ai === "10") out.lot = value;
  if (ai === "17" || ai === "15") out.exp = yymmddToIso(value);
  if (ai === "21") out.serial = value;
}

export function parseBarcode(input: string): ParsedBarcode {
  const raw = input.trim();
  const digits = raw.split(GS1_FNC1).join("").replace(/\D/g, "");

  if (/^\d{13}$/.test(digits) && !raw.includes("(") && !raw.includes("01")) {
    const parsed = empty(raw, "EAN-13");
    parsed.gtin = digits;
    return parsed;
  }
  if (/^\d{18}$/.test(digits) && (digits.startsWith("00") || raw.length === 18)) {
    const parsed = empty(raw, "SSCC");
    parsed.sscc = digits;
    return parsed;
  }
  if (/^\d{14}$/.test(digits) && !raw.includes("(")) {
    const parsed = empty(raw, "GTIN");
    parsed.gtin = digits;
    return parsed;
  }

  const rest0 = raw.split(GS1_FNC1).join("");
  const parsed = empty(raw, rest0.includes("(") || raw.includes(GS1_FNC1) ? "GS1-128" : "EAN-128");
  let rest = rest0;
  let guard = 0;
  while (rest.length && guard < 20) {
    guard += 1;
    const piece = takeAi(rest);
    if (!piece) break;
    applyAi(parsed, piece.ai, piece.value);
    rest = piece.next;
  }
  if (parsed.sscc) parsed.symbology = parsed.gtin || parsed.lot ? "GS1-128" : "SSCC";
  if (parsed.gtin && !parsed.sscc && !parsed.lot && digits.length === 13) parsed.symbology = "EAN-13";
  return parsed;
}
