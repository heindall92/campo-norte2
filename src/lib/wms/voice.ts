import { nextFloorTicket, type FloorTicket } from "./floor";
import type { PickPack, Sku, WmsSnapshot } from "./types";

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

/** Lo que dirían los auriculares. Usa el hueco real del ticket; la familia 8–37 es orientación de planta. */
export function buildVoicePrompt(
  ticket: Pick<FloorTicket, "storeName" | "aisle" | "slotCode" | "skuName" | "skuId" | "qty"> & {
    pickPack?: PickPack;
  },
  lang: "es" | "en" = "es",
): VoicePrompt {
  const pack = ticket.pickPack ?? "caja";
  const family = familyForSku(ticket.skuId);
  const take =
    pack === "contenedor"
      ? lang === "es"
        ? `Del contenedor, tomar ${ticket.qty}`
        : `From the container, take ${ticket.qty}`
      : lang === "es"
        ? `Tomar ${ticket.qty} cajas`
        : `Take ${ticket.qty} cases`;

  const familyStep = family
    ? lang === "es"
      ? `${family.familyEs}, pasillo ${aisleRangeLabel(family)} en planta`
      : `${family.familyEn}, aisle ${aisleRangeLabel(family)} on the floor`
    : null;

  const steps = [
    ticket.storeName ? (lang === "es" ? `Súper ${ticket.storeName}` : `Store ${ticket.storeName}`) : null,
    familyStep,
    lang === "es" ? `Pasillo ${ticket.aisle}` : `Aisle ${ticket.aisle}`,
    lang === "es" ? `Hueco ${ticket.slotCode}` : `Slot ${ticket.slotCode}`,
    ticket.skuName,
    take,
  ].filter((s): s is string => Boolean(s));

  return { text: `${steps.join(". ")}.`, steps, pickPack: pack };
}

export function speakVoicePrompt(text: string, lang: "es" | "en" = "es"): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang === "es" ? "es-ES" : "en-GB";
  utter.rate = 0.95;
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
};

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
  return { kind: "close", prompt: buildClosePrompt(last, lang), remaining };
}

export function speakVoiceCue(cue: VoiceCue, lang: "es" | "en" = "es"): boolean {
  if (!loadHeadsetOn()) return false;
  return speakVoicePrompt(cue.prompt.text, lang);
}
