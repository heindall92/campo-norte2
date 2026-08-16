/**
 * Parser GS1 / códigos de hueco Campo Norte.
 * No está acoplado a una pantalla: RF y recepción lo importan.
 */

import { formatSlotCode, parseSlotCode } from "@/lib/wms/location";

export type BarcodeKind = "slot" | "sscc" | "gtin" | "gs1" | "qty" | "unknown";

export interface ParsedBarcode {
  kind: BarcodeKind;
  raw: string;
  value: string;
  gtin?: string;
  lot?: string;
  exp?: string;
  sscc?: string;
  serial?: string;
  slotCode?: string;
}

const SSCC_RE = /^\d{18}$/;
const GTIN14_RE = /^\d{14}$/;
const EAN13_RE = /^\d{13}$/;
const QTY_RE = /^\d{1,9}$/;

/** AIs de longitud fija (sin FNC1). */
const FIXED_AI: Record<string, number> = {
  "00": 18,
  "01": 14,
  "17": 6,
  "13": 6,
};

function stripGs1Wrappers(raw: string): string {
  return raw.trim().replace(/[()]/g, "").split(String.fromCharCode(29)).join("");
}

function parseGs1AIs(payload: string): Partial<ParsedBarcode> {
  const out: Partial<ParsedBarcode> = {};
  let i = 0;
  const src = payload.replace(/\s/g, "");

  while (i < src.length) {
    const ai2 = src.slice(i, i + 2);
    const len = FIXED_AI[ai2];

    if (ai2 === "00") {
      const val = src.slice(i + 2, i + 20);
      if (SSCC_RE.test(val)) {
        out.sscc = val;
        i += 20;
        continue;
      }
    }
    if (ai2 === "01") {
      const val = src.slice(i + 2, i + 16);
      if (GTIN14_RE.test(val) || EAN13_RE.test(val)) {
        out.gtin = val;
        i += 2 + val.length;
        continue;
      }
    }
    if (ai2 === "17" || ai2 === "13") {
      const val = src.slice(i + 2, i + 8);
      if (/^\d{6}$/.test(val)) {
        out.exp = val;
        i += 8;
        continue;
      }
    }
    if (ai2 === "10" || ai2 === "21") {
      i += 2;
      let end = src.length;
      for (const next of ["00", "01", "17", "13", "10", "21"]) {
        const idx = src.indexOf(next, i);
        if (idx > i && idx < end) end = idx;
      }
      const val = src.slice(i, end);
      if (ai2 === "10") out.lot = val;
      else out.serial = val;
      i = end;
      continue;
    }
    if (len) {
      i += 2 + len;
      continue;
    }
    break;
  }

  return out;
}

export function parseBarcode(raw: string): ParsedBarcode {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "unknown", raw: trimmed, value: trimmed };

  const slot = parseSlotCode(trimmed);
  if (slot) {
    const slotCode = formatSlotCode(slot);
    return { kind: "slot", raw: trimmed, value: slotCode, slotCode };
  }

  const paren = trimmed.match(
    /^\(00\)(\d{18})|\(01\)(\d{13,14})|\(10\)([^()]*)|\(17\)(\d{6})|\(21\)([^()]*)/g,
  );
  if (trimmed.includes("(") && paren) {
    const gs1: ParsedBarcode = { kind: "gs1", raw: trimmed, value: stripGs1Wrappers(trimmed) };
    const sscc = trimmed.match(/\(00\)(\d{18})/);
    const gtin = trimmed.match(/\(01\)(\d{13,14})/);
    const lot = trimmed.match(/\(10\)([^()]+)/);
    const exp = trimmed.match(/\(17\)(\d{6})/);
    const serial = trimmed.match(/\(21\)([^()]+)/);
    if (sscc) gs1.sscc = sscc[1];
    if (gtin) gs1.gtin = gtin[1];
    if (lot) gs1.lot = lot[1];
    if (exp) gs1.exp = exp[1];
    if (serial) gs1.serial = serial[1];
    if (gs1.sscc) {
      gs1.kind = "sscc";
      gs1.value = gs1.sscc;
    } else if (gs1.gtin && !gs1.lot && !gs1.exp) {
      gs1.kind = "gtin";
      gs1.value = gs1.gtin;
    }
    return gs1;
  }

  const digits = trimmed.replace(/\s/g, "");
  if (SSCC_RE.test(digits)) {
    return { kind: "sscc", raw: trimmed, value: digits, sscc: digits };
  }
  if (digits.startsWith("00") && SSCC_RE.test(digits.slice(2))) {
    const sscc = digits.slice(2);
    return { kind: "sscc", raw: trimmed, value: sscc, sscc };
  }

  const fromAi = parseGs1AIs(digits);
  if (fromAi.sscc || fromAi.gtin || fromAi.lot) {
    return {
      kind: fromAi.sscc ? "sscc" : fromAi.gtin ? "gs1" : "gs1",
      raw: trimmed,
      value: fromAi.sscc ?? fromAi.gtin ?? digits,
      ...fromAi,
    };
  }

  if (EAN13_RE.test(digits) || GTIN14_RE.test(digits)) {
    return { kind: "gtin", raw: trimmed, value: digits, gtin: digits };
  }

  if (QTY_RE.test(trimmed) && digits.length < 10) {
    return { kind: "qty", raw: trimmed, value: trimmed };
  }

  if (/^\d{10,}$/.test(digits)) {
    return { kind: "sscc", raw: trimmed, value: digits, sscc: digits };
  }

  return { kind: "unknown", raw: trimmed, value: trimmed };
}
