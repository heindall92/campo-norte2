import { WMS_DEMO_NOW } from "./alerts";
import type {
  Pallet,
  Slot,
  SlottingRecommendation,
  SlottingRule,
  WarehouseZone,
  WmsSnapshot,
} from "./types";

export type PutawayReason =
  | "zone_match"
  | "zone_fallback"
  | "reserve"
  | "pick_face"
  | "family"
  | "capacity"
  | "fefo_level"
  | "abc_near";

export type PutawayCandidate = {
  slotId: string;
  code: string;
  zone: WarehouseZone;
  score: number;
  /** Heurística 0–100 del viaje entre pasillos. No son metros. */
  travelPct: number;
  reasons: PutawayReason[];
};

export type SlottingError = "pallet_missing" | "no_candidate" | "rule_invalid" | "rec_missing" | "rec_accepted";

export type SlottingOpenResult =
  | { ok: true; snap: WmsSnapshot; recId: string }
  | { ok: false; error: SlottingError };

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Zona preferida según categoría del SKU. Categorías de usuario caen en seco. */
export function zoneForCategory(category: string): WarehouseZone {
  if (category === "frescos" || category === "perecederos") return "fresco";
  if (category === "congelados") return "congelado";
  return "seco";
}

function aisleOrder(siteSlots: Slot[]): string[] {
  return [...new Set(siteSlots.map((s) => s.aisle))].sort((a, b) => a.localeCompare(b));
}

/**
 * % de viaje estimado entre dos huecos del mismo centro.
 * Usa el orden de pasillos A/B/C… y el rack. No inventa metros ni GPS.
 */
export function travelPctBetween(from: Slot, to: Slot, siteSlots: Slot[]): number {
  const aisles = aisleOrder(siteSlots);
  const span = Math.max(1, aisles.length - 1);
  const fromI = Math.max(0, aisles.indexOf(from.aisle));
  const toI = Math.max(0, aisles.indexOf(to.aisle));
  const aislePct = (Math.abs(toI - fromI) / span) * 80;
  const maxRack = Math.max(1, ...siteSlots.filter((s) => s.aisle === to.aisle).map((s) => s.rack));
  const rackPct = (to.rack / maxRack) * 20;
  return Math.round(Math.min(100, Math.max(0, aislePct + rackPct)));
}

function skuOf(snap: WmsSnapshot, skuId: string) {
  return snap.skus.find((s) => s.id === skuId);
}

function pairMatch(left: string, right: string, a: string, b: string): boolean {
  return (left === a && right === b) || (left === b && right === a);
}

function isIncompatible(
  snap: WmsSnapshot,
  palletSkuId: string,
  otherSkuId: string,
  rules: SlottingRule[],
): boolean {
  if (palletSkuId === otherSkuId) return false;
  const palletSku = skuOf(snap, palletSkuId);
  const otherSku = skuOf(snap, otherSkuId);
  for (const rule of rules) {
    if (rule.kind === "incompatible_sku" && pairMatch(rule.left, rule.right, palletSkuId, otherSkuId)) {
      return true;
    }
    if (
      rule.kind === "incompatible_category" &&
      palletSku &&
      otherSku &&
      pairMatch(rule.left, rule.right, palletSku.category, otherSku.category)
    ) {
      return true;
    }
  }
  return false;
}

function bayBlockedByRule(snap: WmsSnapshot, slot: Slot, pallet: Pallet, rules: SlottingRule[]): boolean {
  if (!rules.length) return false;
  for (const neighbor of snap.slots) {
    if (neighbor.siteId !== slot.siteId || neighbor.aisle !== slot.aisle || neighbor.rack !== slot.rack) continue;
    if (!neighbor.palletId) continue;
    const other = snap.pallets.find((p) => p.id === neighbor.palletId);
    if (!other) continue;
    if (isIncompatible(snap, pallet.skuId, other.skuId, rules)) return true;
  }
  return false;
}

function aisleHasSameCategory(snap: WmsSnapshot, slot: Slot, category: string): boolean {
  for (const s of snap.slots) {
    if (s.siteId !== slot.siteId || s.aisle !== slot.aisle || !s.palletId) continue;
    const pal = snap.pallets.find((p) => p.id === s.palletId);
    if (!pal) continue;
    const sku = skuOf(snap, pal.skuId);
    if (sku?.category === category) return true;
  }
  return false;
}

function fromSlotFor(snap: WmsSnapshot, pallet: Pallet): Slot | undefined {
  if (pallet.slotId) {
    const owned = snap.slots.find((s) => s.id === pallet.slotId);
    if (owned) return owned;
  }
  return snap.slots.find((s) => s.siteId === pallet.siteId && s.zone === "muelle");
}

/**
 * Ranking de huecos libres. No mueve palets.
 * Incompatibles solo si hay reglas escritas en `slottingRules`.
 */
export function rankPutawayCandidates(
  snap: WmsSnapshot,
  pallet: Pallet,
  opts: { limit?: number } = {},
): PutawayCandidate[] {
  const sku = skuOf(snap, pallet.skuId);
  const preferred = sku ? zoneForCategory(sku.category) : "seco";
  const rules = snap.slottingRules ?? [];
  const siteSlots = snap.slots.filter((s) => s.siteId === pallet.siteId);
  const from = fromSlotFor(snap, pallet);
  const scored: PutawayCandidate[] = [];

  for (const slot of siteSlots) {
    if (slot.status !== "libre" || slot.palletId) continue;
    if (slot.zone === "muelle" || slot.zone === "crossdock") continue;
    if (slot.capacityPallets < 1) continue;
    if (bayBlockedByRule(snap, slot, pallet, rules)) continue;

    const travelPct = from ? travelPctBetween(from, slot, siteSlots) : 50;
    const reasons: PutawayReason[] = [];
    let score = 0;

    if (slot.zone === preferred) {
      score += 100;
      reasons.push("zone_match");
    } else {
      reasons.push("zone_fallback");
    }

    if (slot.capacityPallets >= 1) {
      score += Math.min(slot.capacityPallets, 2) * 5;
      reasons.push("capacity");
    }

    if (sku && aisleHasSameCategory(snap, slot, sku.category)) {
      score += 30;
      reasons.push("family");
    }

    if (pallet.expiry) {
      score += Math.max(0, 5 - slot.level) * 8;
      reasons.push("fefo_level");
      if (slot.pickFace) {
        score += 5;
        reasons.push("pick_face");
      }
    } else if (!slot.pickFace) {
      score += 15;
      reasons.push("reserve");
    } else {
      reasons.push("pick_face");
    }

    if (sku?.abc === "A") {
      score += Math.round((100 - travelPct) * 0.35);
      reasons.push("abc_near");
    } else if (sku?.abc === "B") {
      score += Math.round((100 - travelPct) * 0.15);
    }

    score -= travelPct * 0.05;

    scored.push({
      slotId: slot.id,
      code: slot.code,
      zone: slot.zone,
      score,
      travelPct,
      reasons,
    });
  }

  return scored.sort((a, b) => b.score - a.score || a.travelPct - b.travelPct || a.code.localeCompare(b.code)).slice(
    0,
    opts.limit ?? 12,
  );
}

/**
 * Primer hueco del ranking. No aplica el putaway.
 * Compatibilidad con pistola / RF / inbound.
 */
export function suggestPutawaySlot(snap: WmsSnapshot, pallet: Pallet): Slot | null {
  const top = rankPutawayCandidates(snap, pallet, { limit: 1 })[0];
  if (!top) return null;
  return snap.slots.find((s) => s.id === top.slotId) ?? null;
}

export function addSlottingRule(
  snap: WmsSnapshot,
  input: { kind: SlottingRule["kind"]; left: string; right: string; note: string },
): SlottingOpenResult {
  const left = input.left.trim();
  const right = input.right.trim();
  if (!left || !right || left === right) return { ok: false, error: "rule_invalid" };
  if (input.kind === "incompatible_sku") {
    if (!snap.skus.some((s) => s.id === left) || !snap.skus.some((s) => s.id === right)) {
      return { ok: false, error: "rule_invalid" };
    }
  }
  const rule: SlottingRule = {
    id: uid("srl"),
    kind: input.kind,
    left,
    right,
    note: input.note.trim(),
  };
  return { ok: true, snap: { ...snap, slottingRules: [...(snap.slottingRules ?? []), rule] }, recId: rule.id };
}

/** Escribe la recomendación. El palet no se mueve. */
export function openSlottingRecommendation(snap: WmsSnapshot, palletId: string, at = WMS_DEMO_NOW): SlottingOpenResult {
  const pallet = snap.pallets.find((p) => p.id === palletId);
  if (!pallet) return { ok: false, error: "pallet_missing" };
  const top = rankPutawayCandidates(snap, pallet, { limit: 1 })[0];
  if (!top) return { ok: false, error: "no_candidate" };
  const from = fromSlotFor(snap, pallet);
  if (!from) return { ok: false, error: "no_candidate" };
  const rec: SlottingRecommendation = {
    id: uid("slt"),
    palletId: pallet.id,
    skuId: pallet.skuId,
    fromSlotId: from.id,
    toSlotId: top.slotId,
    toCode: top.code,
    score: top.score,
    travelPct: top.travelPct,
    reasons: top.reasons,
    createdAt: at,
    acceptedAt: null,
    acceptedBy: null,
  };
  return {
    ok: true,
    snap: { ...snap, slottingRecommendations: [rec, ...(snap.slottingRecommendations ?? [])] },
    recId: rec.id,
  };
}

export const PUTAWAY_REASON_LABEL: Record<PutawayReason, { es: string; en: string }> = {
  zone_match: { es: "zona del SKU", en: "SKU zone" },
  zone_fallback: { es: "otra zona (sin hueco preferido)", en: "other zone (no preferred slot)" },
  reserve: { es: "reserva (no pick face)", en: "reserve (not pick face)" },
  pick_face: { es: "cara de picking", en: "pick face" },
  family: { es: "familia en el pasillo", en: "family in aisle" },
  capacity: { es: "capacidad del hueco", en: "slot capacity" },
  fefo_level: { es: "FEFO · nivel bajo", en: "FEFO · low level" },
  abc_near: { es: "ABC A cerca del muelle", en: "ABC A near dock" },
};
