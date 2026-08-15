import type { FloorTicket } from "./floor";
import type { PickPack, Sku } from "./types";

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
