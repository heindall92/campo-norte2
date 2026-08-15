import { formatSlotCode, isPickFaceLevel, slotRecordId } from "./location";
import type { Slot, WarehouseSite, WarehouseZone, WmsSnapshot } from "./types";

export type ZoneSpec = { zone: WarehouseZone; aisle: string; racks: number; levels: number };

export type OnboardSiteError =
  | "city_required"
  | "duplicate_code"
  | "wrong_org"
  | "aisle_invalid"
  | "layout_too_big";

export interface OnboardSiteInput {
  orgId: string;
  city: string;
  region: string;
  country: string;
  name?: string;
  sqm?: number;
  aisles: string[];
  bays: number;
  levels: number;
  zone: WarehouseZone;
  temperatureModes?: WarehouseZone[];
}

const MAX_AISLES = 6;
const MAX_BAYS = 8;
const MAX_LEVELS = 4;

export function cityPrefix(city: string): string {
  const ascii = city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return (ascii.slice(0, 3) || "HUB").padEnd(3, "X");
}

export function nextSiteCode(sites: WarehouseSite[], city: string): string {
  const prefix = cityPrefix(city);
  const n = sites.length + 1;
  let code = `CN-${prefix}-${String(n).padStart(2, "0")}`;
  let i = n;
  while (sites.some((s) => s.code === code)) {
    i += 1;
    code = `CN-${prefix}-${String(i).padStart(2, "0")}`;
  }
  return code;
}

/**
 * Rack selectivo: 2 palets/bahía (salvo muelle), nivel 1 = pick face.
 * `occupy: true` replica la semilla demo; el alta de centro deja huecos libres.
 */
export function generateSiteSlots(
  siteId: string,
  zones: ZoneSpec[],
  opts?: { salt?: number; occupy?: boolean },
): Slot[] {
  const salt = opts?.salt ?? 0;
  const occupy = opts?.occupy ?? false;
  const slots: Slot[] = [];
  let n = salt;
  for (const z of zones) {
    for (let rack = 1; rack <= z.racks; rack++) {
      for (let level = 1; level <= z.levels; level++) {
        const positions: Array<1 | 2> = z.zone === "muelle" ? [1] : [1, 2];
        for (const position of positions) {
          n += 1;
          const code = formatSlotCode({ aisle: z.aisle, bay: rack, level, position });
          const occupied = occupy && n % 5 !== 0 && z.zone !== "muelle";
          const blocked = occupy && n % 37 === 0;
          slots.push({
            id: slotRecordId(siteId, code),
            code,
            siteId,
            zone: z.zone,
            aisle: z.aisle,
            rack,
            level,
            position,
            pickFace: isPickFaceLevel(level, z.zone),
            status: blocked ? "bloqueado" : occupied ? "ocupado" : occupy && n % 11 === 0 ? "reservado" : "libre",
            capacityPallets: 1,
            palletId: null,
            lastCountedAt: occupied ? "2026-08-12T06:30:00.000Z" : null,
          });
        }
      }
    }
  }
  return slots;
}

export function layoutForOnboard(input: OnboardSiteInput): ZoneSpec[] {
  const aisles = input.aisles.map((a) => a.trim().toUpperCase()).filter(Boolean);
  const rack: ZoneSpec[] = aisles.map((aisle) => ({
    zone: input.zone,
    aisle,
    racks: input.bays,
    levels: input.levels,
  }));
  if (!aisles.includes("M")) {
    rack.push({ zone: "muelle", aisle: "M", racks: 3, levels: 1 });
  }
  return rack;
}

export function onboardSite(
  snap: WmsSnapshot,
  input: OnboardSiteInput,
): { ok: true; snap: WmsSnapshot; site: WarehouseSite } | { ok: false; error: OnboardSiteError } {
  const city = input.city.trim();
  if (!city) return { ok: false, error: "city_required" };
  if (input.orgId !== snap.org.id) return { ok: false, error: "wrong_org" };

  const aisles = input.aisles.map((a) => a.trim().toUpperCase()).filter(Boolean);
  if (aisles.length === 0 || aisles.some((a) => !/^[A-Z]{1,2}$/.test(a))) {
    return { ok: false, error: "aisle_invalid" };
  }
  if (aisles.length > MAX_AISLES || input.bays > MAX_BAYS || input.levels > MAX_LEVELS || input.bays < 1 || input.levels < 1) {
    return { ok: false, error: "layout_too_big" };
  }

  const code = nextSiteCode(snap.sites, city);
  if (snap.sites.some((s) => s.code === code)) return { ok: false, error: "duplicate_code" };

  const prefix = cityPrefix(city).toLowerCase();
  let id = `site-${prefix}`;
  let n = 1;
  while (snap.sites.some((s) => s.id === id)) {
    n += 1;
    id = `site-${prefix}-${n}`;
  }

  const modes = input.temperatureModes ?? [input.zone, "muelle"];
  const layout = layoutForOnboard({ ...input, aisles });
  const slots = generateSiteSlots(id, layout, { occupy: false });
  const site: WarehouseSite = {
    id,
    orgId: input.orgId,
    code,
    name: input.name?.trim() || `Hub Campo Norte ${city}`,
    city,
    region: input.region.trim() || city,
    country: input.country.trim().toUpperCase() || "ES",
    sqm: input.sqm ?? Math.max(4_000, slots.length * 12),
    slotsTotal: slots.length,
    temperatureModes: modes,
  };

  return {
    ok: true,
    site,
    snap: {
      ...snap,
      sites: [...snap.sites, site],
      slots: [...snap.slots, ...slots],
    },
  };
}
