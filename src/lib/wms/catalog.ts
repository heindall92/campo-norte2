import { ensureShiftRoster, ROSTER_PRIMARY_SITE } from "./roster";
import type {
  FleetUnit,
  InboundAsn,
  Operator,
  OperatorRoleFloor,
  Pallet,
  ProductCategory,
  ShiftCode,
  Sku,
  WmsSnapshot,
} from "./types";

export type CatalogError =
  | "duplicate_sku"
  | "sku_missing"
  | "sku_in_use"
  | "category_missing"
  | "category_in_use"
  | "system_category"
  | "duplicate_category"
  | "invalid_input"
  | "slot_missing"
  | "slot_busy"
  | "pallet_missing"
  | "asn_missing"
  | "operator_missing"
  | "operator_vacant"
  | "fleet_missing"
  | "charger_missing"
  | "battery_invalid";

export type CatalogResult = { ok: true; snap: WmsSnapshot } | { ok: false; error: CatalogError };

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
}

export function createCategory(
  snap: WmsSnapshot,
  input: { code: string; labelEs: string; labelEn: string },
): CatalogResult {
  const code = slug(input.code || input.labelEs);
  if (!code || !input.labelEs.trim()) return { ok: false, error: "invalid_input" };
  if (snap.categories.some((c) => c.id === code || c.code === code)) {
    return { ok: false, error: "duplicate_category" };
  }
  const row: ProductCategory = {
    id: code,
    code,
    labelEs: input.labelEs.trim(),
    labelEn: (input.labelEn || input.labelEs).trim(),
    system: false,
  };
  return { ok: true, snap: { ...snap, categories: [...snap.categories, row] } };
}

export function updateCategory(
  snap: WmsSnapshot,
  id: string,
  input: { labelEs: string; labelEn: string },
): CatalogResult {
  if (!snap.categories.some((c) => c.id === id)) return { ok: false, error: "category_missing" };
  if (!input.labelEs.trim()) return { ok: false, error: "invalid_input" };
  return {
    ok: true,
    snap: {
      ...snap,
      categories: snap.categories.map((c) =>
        c.id === id
          ? { ...c, labelEs: input.labelEs.trim(), labelEn: (input.labelEn || input.labelEs).trim() }
          : c,
      ),
    },
  };
}

export function deleteCategory(snap: WmsSnapshot, id: string): CatalogResult {
  const cat = snap.categories.find((c) => c.id === id);
  if (!cat) return { ok: false, error: "category_missing" };
  if (cat.system) return { ok: false, error: "system_category" };
  if (snap.skus.some((s) => s.category === id)) return { ok: false, error: "category_in_use" };
  return { ok: true, snap: { ...snap, categories: snap.categories.filter((c) => c.id !== id) } };
}

export type SkuDraft = Omit<Sku, "id">;

export function createSku(snap: WmsSnapshot, draft: SkuDraft): CatalogResult {
  if (!draft.sku.trim() || !draft.name.trim()) return { ok: false, error: "invalid_input" };
  if (snap.skus.some((s) => s.sku.toLowerCase() === draft.sku.trim().toLowerCase())) {
    return { ok: false, error: "duplicate_sku" };
  }
  if (!snap.categories.some((c) => c.id === draft.category)) return { ok: false, error: "category_missing" };
  const sku: Sku = { ...draft, id: uid("sku"), sku: draft.sku.trim(), name: draft.name.trim() };
  return { ok: true, snap: { ...snap, skus: [...snap.skus, sku] } };
}

export function updateSku(snap: WmsSnapshot, id: string, draft: SkuDraft): CatalogResult {
  if (!snap.skus.some((s) => s.id === id)) return { ok: false, error: "sku_missing" };
  if (!draft.sku.trim() || !draft.name.trim()) return { ok: false, error: "invalid_input" };
  if (snap.skus.some((s) => s.id !== id && s.sku.toLowerCase() === draft.sku.trim().toLowerCase())) {
    return { ok: false, error: "duplicate_sku" };
  }
  if (!snap.categories.some((c) => c.id === draft.category)) return { ok: false, error: "category_missing" };
  return {
    ok: true,
    snap: {
      ...snap,
      skus: snap.skus.map((s) =>
        s.id === id ? { ...s, ...draft, sku: draft.sku.trim(), name: draft.name.trim() } : s,
      ),
    },
  };
}

export function deleteSku(snap: WmsSnapshot, id: string): CatalogResult {
  if (!snap.skus.some((s) => s.id === id)) return { ok: false, error: "sku_missing" };
  if (snap.pallets.some((p) => p.skuId === id && p.status !== "expedido")) {
    return { ok: false, error: "sku_in_use" };
  }
  return { ok: true, snap: { ...snap, skus: snap.skus.filter((s) => s.id !== id) } };
}

export function createPallet(
  snap: WmsSnapshot,
  input: {
    skuId: string;
    qty: number;
    lot: string;
    expiry: string | null;
    siteId: string;
    slotId: string | null;
    supplier: string;
    sscc?: string;
  },
): CatalogResult {
  if (!snap.skus.some((s) => s.id === input.skuId)) return { ok: false, error: "sku_missing" };
  if (!Number.isFinite(input.qty) || input.qty < 1) return { ok: false, error: "invalid_input" };
  let slotId = input.slotId;
  if (slotId) {
    const slot = snap.slots.find((s) => s.id === slotId);
    if (!slot) return { ok: false, error: "slot_missing" };
    if (slot.palletId || slot.status === "bloqueado") return { ok: false, error: "slot_busy" };
  }
  const pallet: Pallet = {
    id: uid("pal"),
    sscc: input.sscc?.trim() || `00384100${String(Date.now()).slice(-10)}`,
    skuId: input.skuId,
    qty: input.qty,
    lot: input.lot.trim() || "SIN-LOTE",
    expiry: input.expiry,
    status: !slotId || snap.slots.find((s) => s.id === slotId)?.zone === "muelle" ? "muelle" : "en_ubicacion",
    slotId,
    siteId: input.siteId,
    receivedAt: new Date().toISOString(),
    supplier: input.supplier.trim() || "—",
  };
  return {
    ok: true,
    snap: {
      ...snap,
      pallets: [pallet, ...snap.pallets],
      slots: snap.slots.map((s) =>
        s.id === slotId ? { ...s, palletId: pallet.id, status: "ocupado" as const } : s,
      ),
    },
  };
}

export function updatePallet(
  snap: WmsSnapshot,
  id: string,
  input: { qty: number; lot: string; expiry: string | null; supplier: string; status: Pallet["status"] },
): CatalogResult {
  if (!snap.pallets.some((p) => p.id === id)) return { ok: false, error: "pallet_missing" };
  if (!Number.isFinite(input.qty) || input.qty < 0) return { ok: false, error: "invalid_input" };
  return {
    ok: true,
    snap: {
      ...snap,
      pallets: snap.pallets.map((p) =>
        p.id === id
          ? {
              ...p,
              qty: input.qty,
              lot: input.lot.trim() || p.lot,
              expiry: input.expiry,
              supplier: input.supplier.trim() || p.supplier,
              status: input.status,
            }
          : p,
      ),
    },
  };
}

export function deletePallet(snap: WmsSnapshot, id: string): CatalogResult {
  const pallet = snap.pallets.find((p) => p.id === id);
  if (!pallet) return { ok: false, error: "pallet_missing" };
  return {
    ok: true,
    snap: {
      ...snap,
      pallets: snap.pallets.filter((p) => p.id !== id),
      slots: snap.slots.map((s) =>
        s.palletId === id ? { ...s, palletId: null, status: "libre" as const } : s,
      ),
    },
  };
}

export function createAsn(
  snap: WmsSnapshot,
  input: {
    supplier: string;
    eta: string;
    dock: string;
    siteId: string;
    lines: number;
    palletsExpected: number;
  },
): CatalogResult {
  if (!input.supplier.trim() || !input.eta || !input.dock.trim()) {
    return { ok: false, error: "invalid_input" };
  }
  const day = input.eta.slice(2, 10).replace(/-/g, "");
  const asn: InboundAsn = {
    id: uid("in"),
    code: `ASN-${day || "NEW"}-${String(snap.inbound.length + 1).padStart(2, "0")}`,
    supplier: input.supplier.trim(),
    eta: input.eta,
    dock: input.dock.trim(),
    status: "previsto",
    lines: Math.max(1, Math.floor(input.lines) || 1),
    palletsExpected: Math.max(1, Math.floor(input.palletsExpected) || 1),
    palletsDone: 0,
    siteId: input.siteId,
  };
  return { ok: true, snap: { ...snap, inbound: [asn, ...snap.inbound] } };
}

export function updateAsn(
  snap: WmsSnapshot,
  id: string,
  input: Partial<Pick<InboundAsn, "supplier" | "eta" | "dock" | "status" | "lines" | "palletsExpected" | "palletsDone">>,
): CatalogResult {
  if (!snap.inbound.some((a) => a.id === id)) return { ok: false, error: "asn_missing" };
  return {
    ok: true,
    snap: {
      ...snap,
      inbound: snap.inbound.map((a) => (a.id === id ? { ...a, ...input } : a)),
    },
  };
}

export function deleteAsn(snap: WmsSnapshot, id: string): CatalogResult {
  if (!snap.inbound.some((a) => a.id === id)) return { ok: false, error: "asn_missing" };
  return { ok: true, snap: { ...snap, inbound: snap.inbound.filter((a) => a.id !== id) } };
}

/**
 * Recibe un palet de un ASN en un hueco de muelle libre.
 * No inventa SKU ni cantidad: los escribe quien descarga.
 */
export function receiveAsnPallet(
  snap: WmsSnapshot,
  asnId: string,
  input: { skuId: string; qty: number; lot: string },
): CatalogResult {
  const asn = snap.inbound.find((a) => a.id === asnId);
  if (!asn) return { ok: false, error: "asn_missing" };
  if (asn.status === "cerrado") return { ok: false, error: "invalid_input" };
  if (asn.palletsDone >= asn.palletsExpected) return { ok: false, error: "invalid_input" };
  const dock = snap.slots.find(
    (s) => s.siteId === asn.siteId && s.zone === "muelle" && s.status === "libre" && !s.palletId,
  );
  if (!dock) return { ok: false, error: "slot_missing" };
  const created = createPallet(snap, {
    skuId: input.skuId,
    qty: input.qty,
    lot: input.lot,
    expiry: null,
    siteId: asn.siteId,
    slotId: dock.id,
    supplier: asn.supplier,
  });
  if (!created.ok) return created;
  const done = asn.palletsDone + 1;
  return updateAsn(created.snap, asnId, {
    palletsDone: done,
    status: done >= asn.palletsExpected ? "ubicando" : "descargando",
  });
}

export function createOperator(
  snap: WmsSnapshot,
  input: {
    vacantId?: string;
    name: string;
    code: string;
    role: OperatorRoleFloor;
    shift: ShiftCode;
    siteId: string;
    costPerHour: number;
    certifications: string[];
  },
): CatalogResult {
  if (!input.name.trim() || !input.code.trim()) return { ok: false, error: "invalid_input" };
  const hired: Omit<Operator, "id"> = {
    code: input.code.trim(),
    name: input.name.trim(),
    role: input.role,
    shift: input.shift,
    siteId: input.siteId,
    active: true,
    vacant: false,
    certifications: input.certifications,
    costPerHour: input.costPerHour || 12,
    picksPerHour: 0,
    movesToday: 0,
    hoursToday: 0,
    overtimeHoursWeek: 0,
    hiredAt: new Date().toISOString().slice(0, 10),
    fingerprintEnrolled: false,
    pinHash: null,
  };
  let operators: Operator[];
  if (input.vacantId) {
    const vacant = snap.operators.find((o) => o.id === input.vacantId);
    if (!vacant) return { ok: false, error: "operator_missing" };
    if (!vacant.vacant) return { ok: false, error: "invalid_input" };
    operators = snap.operators.map((o) => (o.id === vacant.id ? { ...o, ...hired, id: o.id } : o));
  } else {
    operators = [...snap.operators, { ...hired, id: uid("op") }];
  }
  return {
    ok: true,
    snap: { ...snap, operators: ensureShiftRoster(operators, ROSTER_PRIMARY_SITE) },
  };
}

export function updateOperator(
  snap: WmsSnapshot,
  id: string,
  input: Partial<Pick<Operator, "name" | "code" | "role" | "shift" | "siteId" | "active" | "costPerHour" | "certifications">>,
): CatalogResult {
  const op = snap.operators.find((o) => o.id === id);
  if (!op) return { ok: false, error: "operator_missing" };
  if (op.vacant) return { ok: false, error: "operator_vacant" };
  return {
    ok: true,
    snap: {
      ...snap,
      operators: snap.operators.map((o) => (o.id === id ? { ...o, ...input } : o)),
    },
  };
}

export function deleteOperator(snap: WmsSnapshot, id: string): CatalogResult {
  const op = snap.operators.find((o) => o.id === id);
  if (!op) return { ok: false, error: "operator_missing" };
  if (op.vacant) return { ok: false, error: "operator_vacant" };
  return {
    ok: true,
    snap: {
      ...snap,
      operators: ensureShiftRoster(
        snap.operators.filter((o) => o.id !== id),
        ROSTER_PRIMARY_SITE,
      ),
    },
  };
}

export function reportFleetBattery(
  snap: WmsSnapshot,
  fleetId: string,
  pct: number,
  at = new Date().toISOString(),
): CatalogResult {
  if (!snap.fleet.some((f) => f.id === fleetId)) return { ok: false, error: "fleet_missing" };
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return { ok: false, error: "battery_invalid" };
  return {
    ok: true,
    snap: {
      ...snap,
      fleet: snap.fleet.map((f) =>
        f.id === fleetId
          ? {
              ...f,
              batteryPct: Math.round(pct),
              batterySource: "manual" as const,
              batteryReportedAt: at,
            }
          : f,
      ),
    },
  };
}

export function assignFleetCharger(
  snap: WmsSnapshot,
  fleetId: string,
  chargerId: string | null,
): CatalogResult {
  if (!snap.fleet.some((f) => f.id === fleetId)) return { ok: false, error: "fleet_missing" };
  if (chargerId && !snap.chargers.some((c) => c.id === chargerId)) {
    return { ok: false, error: "charger_missing" };
  }
  return {
    ok: true,
    snap: {
      ...snap,
      fleet: snap.fleet.map((f) => (f.id === fleetId ? { ...f, chargerId } : f)),
      chargers: snap.chargers.map((c) => ({
        ...c,
        assignedFleetId: c.id === chargerId ? fleetId : c.assignedFleetId === fleetId ? null : c.assignedFleetId,
      })),
    },
  };
}

export function createFleetUnit(
  snap: WmsSnapshot,
  input: Pick<FleetUnit, "code" | "brand" | "model" | "kind" | "siteId" | "costPerHour">,
): CatalogResult {
  if (!input.code.trim() || !input.brand.trim()) return { ok: false, error: "invalid_input" };
  const unit: FleetUnit = {
    id: uid("fl"),
    code: input.code.trim(),
    brand: input.brand.trim(),
    model: input.model.trim(),
    kind: input.kind,
    status: "operativa",
    batteryPct: null,
    batterySource: "unknown",
    batteryReportedAt: null,
    chargerId: null,
    hoursToday: 0,
    hoursTotal: 0,
    operatorId: null,
    siteId: input.siteId,
    nextServiceAt: "",
    costPerHour: input.costPerHour || 0,
  };
  return { ok: true, snap: { ...snap, fleet: [...snap.fleet, unit] } };
}
