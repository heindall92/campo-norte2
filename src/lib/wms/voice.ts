import { LOAD_KIND_VOICE, nextFloorTicket, type FloorTicket } from "./floor";
import { confirmPick, type ConfirmPickError, type ConfirmPickResult } from "./picking";
import type { LoadUnitKind, PickPack, Sku, WmsSnapshot } from "./types";

/** Preferencia del aparato: si los auriculares dictan solos. No es telemetría. */
export const VOICE_HEADSET_PREF_KEY = "cn-wms-headset-on";

export function loadHeadsetOn(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const raw = localStorage.getItem(VOICE_HEADSET_PREF_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

export function saveHeadsetOn(on: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(VOICE_HEADSET_PREF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export const VOICE_PREFS_KEY = "cn-wms-voice-prefs";

export interface VoicePrefs {
  volume: number;
  rate: number;
}

const DEFAULT_VOICE_PREFS: VoicePrefs = { volume: 1, rate: 0.95 };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function loadVoicePrefs(): VoicePrefs {
  if (typeof localStorage === "undefined") return { ...DEFAULT_VOICE_PREFS };
  try {
    const raw = localStorage.getItem(VOICE_PREFS_KEY);
    if (!raw) return { ...DEFAULT_VOICE_PREFS };
    const parsed = JSON.parse(raw) as Partial<VoicePrefs>;
    return {
      volume: clamp(typeof parsed.volume === "number" ? parsed.volume : DEFAULT_VOICE_PREFS.volume, 0.2, 1),
      rate: clamp(typeof parsed.rate === "number" ? parsed.rate : DEFAULT_VOICE_PREFS.rate, 0.7, 1.6),
    };
  } catch {
    return { ...DEFAULT_VOICE_PREFS };
  }
}

export function saveVoicePrefs(next: Partial<VoicePrefs>): VoicePrefs {
  const merged: VoicePrefs = {
    ...loadVoicePrefs(),
    ...next,
  };
  merged.volume = clamp(merged.volume, 0.2, 1);
  merged.rate = clamp(merged.rate, 0.7, 1.6);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(VOICE_PREFS_KEY, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
  }
  return merged;
}

export function bumpVoiceVolume(delta: number): VoicePrefs {
  return saveVoicePrefs({ volume: loadVoicePrefs().volume + delta });
}

export function bumpVoiceRate(delta: number): VoicePrefs {
  return saveVoicePrefs({ rate: loadVoicePrefs().rate + delta });
}

/**
 * Guía de pasillos que relató planta. No es el digital twin (sigue en A/B/C).
 * No se inventan SKU de cerveza, vino ni especias: solo se nombra la familia.
 */
export interface AisleFamily {
  id: string;
  aisleFrom: number;
  aisleTo: number;
  familyEs: string;
  familyEn: string;
  skuIds: string[];
}

export const AISLE_GUIDE: AisleFamily[] = [
  { id: "drogueria", aisleFrom: 8, aisleTo: 16, familyEs: "Droguería / limpieza", familyEn: "Household / cleaning", skuIds: ["sku-detergente"] },
  { id: "secos", aisleFrom: 17, aisleTo: 37, familyEs: "Seco y resto de tienda", familyEn: "Dry grocery and rest of store", skuIds: [] },
  { id: "granos", aisleFrom: 21, aisleTo: 21, familyEs: "Granos y espárragos", familyEn: "Grains and asparagus", skuIds: ["sku-arroz"] },
  { id: "leche", aisleFrom: 28, aisleTo: 28, familyEs: "Leche (tipos y modelos)", familyEn: "Milk (types and packs)", skuIds: ["sku-leche"] },
  { id: "cerveza", aisleFrom: 29, aisleTo: 29, familyEs: "Cerveza", familyEn: "Beer", skuIds: [] },
  { id: "refrescos", aisleFrom: 30, aisleTo: 30, familyEs: "Refrescos", familyEn: "Soft drinks", skuIds: [] },
  { id: "agua", aisleFrom: 31, aisleTo: 32, familyEs: "Agua", familyEn: "Water", skuIds: ["sku-agua"] },
  { id: "papel", aisleFrom: 33, aisleTo: 34, familyEs: "Papel sanitario", familyEn: "Toilet paper", skuIds: [] },
  { id: "especias", aisleFrom: 36, aisleTo: 37, familyEs: "Comino, tomillo, laurel, vinos y otras bebidas", familyEn: "Spices, wine and other drinks", skuIds: [] },
];

export function pickPackForSku(sku: Sku | undefined): PickPack {
  if (!sku) return "caja";
  return sku.uom === "ud" ? "contenedor" : "caja";
}

export function familyForSku(skuId: string): AisleFamily | null {
  return AISLE_GUIDE.find((f) => f.skuIds.includes(skuId)) ?? null;
}

export function aisleRangeLabel(family: AisleFamily): string {
  return family.aisleFrom === family.aisleTo
    ? String(family.aisleFrom)
    : `${family.aisleFrom}–${family.aisleTo}`;
}

export interface VoicePrompt {
  text: string;
  steps: string[];
  pickPack: PickPack;
}

export type VoiceTicket = Pick<FloorTicket, "storeName" | "aisle" | "slotCode" | "skuName" | "skuId" | "qty"> & {
  pickPack?: PickPack;
  stockInSlot?: number | null;
  loadKind?: LoadUnitKind | null;
};

export function slotMatchesTake(stockInSlot: number | null | undefined, takeQty: number): boolean {
  if (stockInSlot == null) return true;
  return stockInSlot >= takeQty;
}

/** Lo que dirían los auriculares. Usa el hueco real del ticket; la familia 8–37 es orientación de planta. */
export function buildVoicePrompt(ticket: VoiceTicket, lang: "es" | "en" = "es"): VoicePrompt {
  const pack = ticket.pickPack ?? "caja";
  const family = familyForSku(ticket.skuId);
  const stock = ticket.stockInSlot;
  const matches = slotMatchesTake(stock, ticket.qty);
  const take =
    pack === "contenedor"
      ? lang === "es"
        ? `Del contenedor, tomar ${ticket.qty}`
        : `From the container, take ${ticket.qty}`
      : lang === "es"
        ? `Tomar ${ticket.qty} cajas`
        : `Take ${ticket.qty} cases`;
  const stockStep =
    stock == null
      ? null
      : lang === "es"
        ? `En el hueco hay ${stock}`
        : `The slot has ${stock}`;
  const confirmStep = matches
    ? lang === "es"
      ? `Di ${ticket.qty} ok`
      : `Say ${ticket.qty} ok`
    : lang === "es"
      ? `Hacen falta ${ticket.qty}. No coincide`
      : `${ticket.qty} needed. It does not match`;

  const familyStep = family
    ? lang === "es"
      ? `${family.familyEs}, pasillo ${aisleRangeLabel(family)} en planta`
      : `${family.familyEn}, aisle ${aisleRangeLabel(family)} on the floor`
    : null;

  const kindStep = ticket.loadKind
    ? lang === "es"
      ? `Tómalo en ${LOAD_KIND_VOICE[ticket.loadKind].es}`
      : `Take it on a ${LOAD_KIND_VOICE[ticket.loadKind].en}`
    : null;

  const steps = [
    ticket.storeName ? (lang === "es" ? `Súper ${ticket.storeName}` : `Store ${ticket.storeName}`) : null,
    kindStep,
    familyStep,
    lang === "es" ? `Pasillo ${ticket.aisle}` : `Aisle ${ticket.aisle}`,
    lang === "es" ? `Hueco ${ticket.slotCode}` : `Slot ${ticket.slotCode}`,
    ticket.skuName,
    stockStep,
    take,
    confirmStep,
  ].filter((s): s is string => Boolean(s));

  return { text: `${steps.join(". ")}.`, steps, pickPack: pack };
}

export function buildSlotRepeatPrompt(ticket: Pick<VoiceTicket, "aisle" | "slotCode">, lang: "es" | "en" = "es"): string {
  return lang === "es"
    ? `Pasillo ${ticket.aisle}. Hueco ${ticket.slotCode}.`
    : `Aisle ${ticket.aisle}. Slot ${ticket.slotCode}.`;
}

export function buildArticlePrompt(ticket: Pick<VoiceTicket, "skuName" | "stockInSlot" | "pickPack">, lang: "es" | "en" = "es"): string {
  const stock =
    ticket.stockInSlot == null
      ? ""
      : lang === "es"
        ? `. En el hueco hay ${ticket.stockInSlot}`
        : `. The slot has ${ticket.stockInSlot}`;
  return lang === "es"
    ? `Artículo: ${ticket.skuName}${stock}.`
    : `Article: ${ticket.skuName}${stock}.`;
}

export function speakVoicePrompt(text: string, lang: "es" | "en" = "es"): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const prefs = loadVoicePrefs();
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang === "es" ? "es-ES" : "en-GB";
  utter.rate = prefs.rate;
  utter.volume = prefs.volume;
  window.speechSynthesis.speak(utter);
  return true;
}

export function stopVoicePrompt(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

export interface ClosePrompt {
  text: string;
  steps: string[];
  dockAisle: string;
}

export type CloseCueInput = {
  storeName: string;
  orderCode: string;
  dockAisle: string;
  loadKind?: LoadUnitKind | null;
};

export function buildFinishAskPrompt(
  input: CloseCueInput,
  lang: "es" | "en" = "es",
): ClosePrompt {
  const store = input.storeName.trim();
  const kind = input.loadKind;
  const unitWord =
    kind === "caja"
      ? lang === "es"
        ? "cajas o box"
        : "boxes"
      : kind === "carro"
        ? lang === "es"
          ? "carros"
          : "roll cages"
        : kind === "palet"
          ? lang === "es"
            ? "palets"
            : "pallets"
          : lang === "es"
            ? "unidades"
            : "units";
  const steps =
    lang === "es"
      ? [
          store ? `Has finalizado el súper ${store}` : `Has finalizado el pedido ${input.orderCode}`,
          `¿Cuántos ${unitWord} has hecho?`,
        ]
      : [
          store ? `You finished store ${store}` : `You finished order ${input.orderCode}`,
          `How many ${unitWord} did you make?`,
        ];
  return { text: `${steps.join(". ")}.`, steps, dockAisle: input.dockAisle };
}

export function buildLabelDockPrompt(
  input: CloseCueInput & { units: number; labels: number },
  lang: "es" | "en" = "es",
): ClosePrompt {
  const store = input.storeName.trim();
  const dock = input.dockAisle.trim();
  const steps =
    lang === "es"
      ? [
          store ? `Súper ${store} finalizado` : `Pedido ${input.orderCode} finalizado`,
          `${input.units} ${input.loadKind === "caja" ? "box" : input.loadKind === "carro" ? "carros" : "palets"}`,
          `Imprime ${input.labels} etiquetas`,
          input.loadKind === "palet" ? "Una por cada lado de cada palet" : "Pégalas a cada unidad",
          dock ? `En pantalla, deja el súper en el muelle ${dock}` : "En pantalla, deja el súper en el muelle que marca",
        ]
      : [
          store ? `Store ${store} finished` : `Order ${input.orderCode} finished`,
          `${input.units} units`,
          `Print ${input.labels} labels`,
          input.loadKind === "palet" ? "One per side of each pallet" : "Stick one on each unit",
          dock ? `On screen, leave the store on dock ${dock}` : "On screen, leave the store on the dock shown",
        ];
  return { text: `${steps.join(". ")}.`, steps, dockAisle: dock };
}

/** Al terminar el súper el aparato dice fleje, etiqueta escrita y pasillo de muelle. */
export function buildClosePrompt(input: CloseCueInput, lang: "es" | "en" = "es"): ClosePrompt {
  const store = input.storeName.trim();
  const dock = input.dockAisle.trim();
  const steps =
    lang === "es"
      ? [
          store ? `Súper ${store} completo` : `Pedido ${input.orderCode} completo`,
          "Fleja",
          "Escribe la etiqueta y pégala",
          dock ? `Deja en el pasillo de muelle ${dock}` : "Deja en el pasillo de muelle que marca la pantalla",
        ]
      : [
          store ? `Store ${store} complete` : `Order ${input.orderCode} complete`,
          "Strap the load",
          "Write the label and stick it",
          dock ? `Leave it on dock aisle ${dock}` : "Leave it on the dock aisle shown on screen",
        ];
  return { text: `${steps.join(". ")}.`, steps, dockAisle: dock };
}

/** Stock que queda en el palet del hueco. No se inventa inner pack. */
export function remainingOnPallet(snap: WmsSnapshot, palletId: string | null | undefined): number | null {
  if (!palletId) return null;
  const pallet = snap.pallets.find((p) => p.id === palletId);
  return pallet ? pallet.qty : null;
}

export function remainderLabel(
  remaining: number | null | undefined,
  pickPack: PickPack = "caja",
  lang: "es" | "en" = "es",
): string | null {
  if (remaining == null) return null;
  if (remaining <= 0) return lang === "es" ? "Hueco vacío" : "Slot empty";
  if (pickPack === "contenedor") {
    return lang === "es" ? `Quedan ${remaining} en el contenedor` : `${remaining} left in the container`;
  }
  return lang === "es" ? `Quedan ${remaining} cajas en el hueco` : `${remaining} cases left in the slot`;
}

export type VoiceCue =
  | { kind: "ticket"; prompt: VoicePrompt; ticket: FloorTicket; remaining: number | null }
  | { kind: "ask_units"; prompt: ClosePrompt; remaining: number | null }
  | { kind: "close"; prompt: ClosePrompt; remaining: number | null };

/**
 * Tras marcar: el aparato dicta el siguiente ticket, o el cierre de muelle si no queda línea.
 * El resto en hueco sale del palet real, no de un desglose inventado.
 */
export function voiceCueAfterMark(
  snap: WmsSnapshot,
  operatorId: string,
  last: CloseCueInput & { palletId?: string | null; pickPack?: PickPack },
  lang: "es" | "en" = "es",
): VoiceCue {
  const remaining = remainingOnPallet(snap, last.palletId);
  const next = nextFloorTicket(snap, operatorId);
  if (next) {
    return { kind: "ticket", prompt: buildVoicePrompt(next, lang), ticket: next, remaining };
  }
  return { kind: "ask_units", prompt: buildFinishAskPrompt(last, lang), remaining };
}

export function speakVoiceCue(cue: VoiceCue, lang: "es" | "en" = "es"): boolean {
  if (!loadHeadsetOn()) return false;
  return speakVoicePrompt(cue.prompt.text, lang);
}

export type VoiceCommand =
  | { kind: "volume_up" }
  | { kind: "volume_down" }
  | { kind: "faster" }
  | { kind: "repeat_slot" }
  | { kind: "article" }
  | { kind: "confirm"; qty: number }
  | { kind: "count"; qty: number }
  | { kind: "unknown" };

const SPOKEN_NUMBERS: Record<string, number> = {
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function foldVoice(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSpokenQty(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  return SPOKEN_NUMBERS[token] ?? null;
}

/** Mandos de planta: sube, baja, acelera, atrás, artículo, «5 ok». */
export function parseVoiceCommand(utterance: string): VoiceCommand {
  const text = foldVoice(utterance);
  if (!text) return { kind: "unknown" };
  if (/^(sube|sube volumen|mas alto|mas volumen|volume up)$/.test(text) || text === "sube") {
    return { kind: "volume_up" };
  }
  if (/^(baja|baja volumen|mas bajo|menos volumen|volume down)$/.test(text) || text === "baja") {
    return { kind: "volume_down" };
  }
  if (/^(acelera|mas rapido|rapido|faster)$/.test(text)) return { kind: "faster" };
  if (/^(atras|detras|repite|repetir|otra vez|hueco)$/.test(text)) return { kind: "repeat_slot" };
  if (/^(articulo|producto|item)$/.test(text)) return { kind: "article" };

  const confirm = text.match(/^(\d+|[a-z]+)\s+(ok|okay|okey|vale)$/);
  if (confirm) {
    const qty = parseSpokenQty(confirm[1] ?? "");
    if (qty != null && qty > 0) return { kind: "confirm", qty };
  }
  const counted = text.match(/^(\d+|[a-z]+)(?:\s+(palets?|cajas?|box|carros?|unidades?))?$/);
  if (counted) {
    const qty = parseSpokenQty(counted[1] ?? "");
    if (qty != null && qty > 0) return { kind: "count", qty };
  }
  return { kind: "unknown" };
}

export type VoicePickError = ConfirmPickError | "no_ticket" | "qty_mismatch" | "slot_short";

export type VoicePickResult = ConfirmPickResult | { ok: false; error: VoicePickError };

/**
 * «5 ok»: confirma la cantidad que dijo el aparato y pica con el hueco/SSCC del ticket.
 * Si el hueco no tiene tantas, no pica: hay que avisar al jefe.
 */
export function confirmVoicePick(
  snap: WmsSnapshot,
  operatorId: string,
  spokenQty: number,
  at = "2026-08-15T10:00:00.000Z",
): VoicePickResult {
  const ticket = nextFloorTicket(snap, operatorId);
  if (!ticket) return { ok: false, error: "no_ticket" };
  if (spokenQty !== ticket.qty) return { ok: false, error: "qty_mismatch" };
  if (ticket.stockInSlot != null && ticket.stockInSlot < ticket.qty) {
    return { ok: false, error: "slot_short" };
  }
  if (!ticket.sscc) return { ok: false, error: "pallet_missing" };
  return confirmPick(
    snap,
    ticket.waveId,
    ticket.line.id,
    { slotCode: ticket.slotCode, sscc: ticket.sscc, qty: spokenQty },
    at,
  );
}
