import { assignWaveOperator, openWaveFromOrder } from "./waves";
import { codesEqual } from "./location";
import { blockedSlotIds } from "./slot-fix";
import type {
  LoadUnit,
  LoadUnitKind,
  Operator,
  OutboundOrder,
  PickLine,
  SuperAssignment,
  WmsSnapshot,
} from "./types";

export type FloorError =
  | "order_missing"
  | "order_done"
  | "operator_missing"
  | "code_required"
  | "no_free_pallets"
  | "nothing_picked"
  | "unit_missing"
  | "label_required"
  | "dock_slot"
  | "lines_used"
  | "kind_required"
  | "invalid_units";

export type FloorResult =
  | { ok: true; snap: WmsSnapshot; operatorId?: string; waveId?: string; unitId?: string }
  | { ok: false; error: FloorError };

/** El aparato no asigna por número de terminal: se identifica con el código de operario. */
export function operatorByCode(snap: WmsSnapshot, code: string): Operator | null {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  return snap.operators.find((o) => o.active && !o.vacant && o.code.toUpperCase() === c) ?? null;
}

export interface FloorTicket {
  line: PickLine;
  waveId: string;
  orderCode: string;
  storeName: string;
  dockAisle: string;
  aisle: string;
  slotCode: string;
  skuId: string;
  skuName: string;
  qty: number;
  pickPack: PickLine["pickPack"];
  /** Stock del palet en el hueco. null si no hay palet. No se inventa. */
  stockInSlot: number | null;
  sscc: string;
  loadKind: LoadUnitKind | null;
}

export function storeNameOf(order: OutboundOrder | undefined): string {
  return order?.customer ?? "";
}

export function nextFloorTicket(snap: WmsSnapshot, operatorId: string): FloorTicket | null {
  const waves = snap.pickWaves.filter(
    (w) => w.status !== "cerrada" && w.operatorId === operatorId && w.kind === "picking",
  );
  const blocked = blockedSlotIds(snap);
  for (const wave of waves) {
    const open = wave.lines
      .filter((l) => l.status === "en_curso" || l.status === "pendiente")
      .sort((a, b) => a.sequence - b.sequence);
    for (const line of open) {
      const slot = snap.slots.find((s) => s.id === line.slotId);
      const sku = snap.skus.find((s) => s.id === line.skuId);
      const order = snap.outbound.find((o) => o.code === line.orderCode);
      if (!slot || !sku) continue;
      if (blocked.has(slot.id) || slot.status === "bloqueado") continue;
      const pallet = line.palletId ? snap.pallets.find((p) => p.id === line.palletId) : null;
      const assignment = snap.superAssignments.find((a) => a.operatorId === operatorId && a.orderId === order?.id);
      return {
        line,
        waveId: wave.id,
        orderCode: line.orderCode,
        storeName: storeNameOf(order),
        dockAisle: order?.dock ?? "",
        aisle: slot.aisle,
        slotCode: slot.code,
        skuId: sku.id,
        skuName: sku.name,
        qty: line.qty,
        pickPack: line.pickPack ?? "caja",
        stockInSlot: pallet?.qty ?? null,
        sscc: pallet?.sscc ?? "",
        loadKind: assignment?.loadKind ?? null,
      };
    }
  }
  return null;
}

export interface AisleStop {
  at: string;
  aisle: string;
  slotCode: string;
  skuId: string;
  skuName: string;
  qty: number;
  orderCode: string;
  storeName: string;
}

export interface OperatorAisleTrace {
  operator: Operator;
  assignedStore: string | null;
  assignedOrder: string | null;
  nextAisle: string | null;
  nextSlot: string | null;
  currentAisle: string | null;
  lastAt: string | null;
  stops: AisleStop[];
}

/**
 * Rastro del operario: solo pasillos donde ya marcó un artículo.
 * El siguiente hueco es el asignado, no un GPS inventado.
 */
export function operatorAisleTrace(snap: WmsSnapshot, operatorId: string): OperatorAisleTrace | null {
  const operator = snap.operators.find((o) => o.id === operatorId);
  if (!operator) return null;
  const ticket = nextFloorTicket(snap, operatorId);
  const assignment = snap.superAssignments.find((a) => a.operatorId === operatorId);
  const assignedOrder = assignment
    ? snap.outbound.find((o) => o.id === assignment.orderId)
    : ticket
      ? snap.outbound.find((o) => o.code === ticket.orderCode)
      : null;

  const stops: AisleStop[] = [];
  for (const move of snap.movements) {
    if (move.operatorId !== operatorId || move.type !== "salida" || !move.fromSlotId) continue;
    const slot = snap.slots.find((s) => s.id === move.fromSlotId);
    if (!slot) continue;
    const line = snap.pickWaves
      .flatMap((w) => w.lines)
      .find((l) => l.palletId === move.palletId && l.status === "picada");
    const order = line ? snap.outbound.find((o) => o.code === line.orderCode) : undefined;
    const sku = snap.skus.find((s) => s.id === move.skuId);
    stops.push({
      at: move.at,
      aisle: slot.aisle,
      slotCode: slot.code,
      skuId: move.skuId,
      skuName: sku?.name ?? move.skuId,
      qty: move.qty,
      orderCode: line?.orderCode ?? "",
      storeName: storeNameOf(order),
    });
  }

  const last = stops[0] ?? null;
  return {
    operator,
    assignedStore: assignedOrder ? storeNameOf(assignedOrder) : ticket?.storeName ?? null,
    assignedOrder: assignedOrder?.code ?? ticket?.orderCode ?? null,
    nextAisle: ticket?.aisle ?? null,
    nextSlot: ticket?.slotCode ?? null,
    currentAisle: last?.aisle ?? ticket?.aisle ?? null,
    lastAt: last?.at ?? null,
    stops,
  };
}

export function aisleTraces(snap: WmsSnapshot, siteId?: string): OperatorAisleTrace[] {
  const ids = new Set<string>();
  for (const a of snap.superAssignments) ids.add(a.operatorId);
  for (const w of snap.pickWaves) {
    if (w.operatorId && w.status !== "cerrada") ids.add(w.operatorId);
  }
  for (const m of snap.movements) {
    if (m.operatorId && m.type === "salida") ids.add(m.operatorId);
  }
  return [...ids]
    .map((id) => operatorAisleTrace(snap, id))
    .filter((row): row is OperatorAisleTrace => {
      if (!row) return false;
      if (siteId && row.operator.siteId !== siteId) return false;
      return Boolean(row.assignedOrder || row.stops.length || row.nextSlot);
    })
    .sort((a, b) => a.operator.name.localeCompare(b.operator.name));
}

/**
 * Patrón o técnico: asigna el súper (pedido) al código de operario.
 * No usa número de aparato. Abre ola con palets reales si aún no hay.
 */
export function assignSuperToOperator(
  snap: WmsSnapshot,
  orderId: string,
  operatorCode: string,
  assignedBy: string | null = null,
  at = new Date().toISOString(),
  loadKind: LoadUnitKind | null = null,
): FloorResult {
  if (!operatorCode.trim()) return { ok: false, error: "code_required" };
  const operator = operatorByCode(snap, operatorCode);
  if (!operator) return { ok: false, error: "operator_missing" };
  const order = snap.outbound.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "order_missing" };
  if (order.status === "expedido") return { ok: false, error: "order_done" };

  const opened = openWaveFromOrder(snap, orderId, operator.id);
  if (!opened.ok) {
    return { ok: false, error: opened.error === "no_free_pallets" ? "no_free_pallets" : "order_missing" };
  }

  let next = opened.snap;
  const waveIds = [
    ...new Set(
      next.pickWaves
        .filter((w) => w.status !== "cerrada" && w.lines.some((l) => l.orderCode === order.code))
        .map((w) => w.id),
    ),
  ];
  for (const waveId of waveIds) {
    const assigned = assignWaveOperator(next, waveId, operator.id);
    if (assigned.ok) next = assigned.snap;
  }

  const row: SuperAssignment = {
    id: `asg-${orderId}-${operator.id}-${at}`,
    orderId,
    operatorId: operator.id,
    assignedBy: assignedBy?.trim() || null,
    at,
    loadKind,
    unitsMade: null,
    labelsPrinted: 0,
  };
  return {
    ok: true,
    operatorId: operator.id,
    waveId: opened.waveId,
    snap: {
      ...next,
      superAssignments: [row, ...next.superAssignments.filter((a) => a.operatorId !== operator.id || a.orderId !== orderId)],
    },
  };
}

function usedLineIds(snap: WmsSnapshot): Set<string> {
  return new Set(snap.loadUnits.flatMap((u) => u.lineIds));
}

export function pickedLinesForOrder(snap: WmsSnapshot, orderCode: string): PickLine[] {
  const used = usedLineIds(snap);
  return snap.pickWaves
    .flatMap((w) => w.lines)
    .filter((l) => l.orderCode === orderCode && l.status === "picada" && l.qtyPicked > 0 && !used.has(l.id));
}

export function openLoadUnit(
  snap: WmsSnapshot,
  orderId: string,
  kind: LoadUnitKind,
  operatorId: string | null,
  at = new Date().toISOString(),
): FloorResult {
  const order = snap.outbound.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "order_missing" };
  const lines = pickedLinesForOrder(snap, order.code);
  if (!lines.length) return { ok: false, error: "nothing_picked" };
  const id = `lu-${orderId}-${at}`;
  const unit: LoadUnit = {
    id,
    kind,
    orderId: order.id,
    orderCode: order.code,
    siteId: order.siteId,
    operatorId,
    dockAisle: order.dock,
    lineIds: lines.map((l) => l.id),
    qty: lines.reduce((s, l) => s + l.qtyPicked, 0),
    labelCode: null,
    strapped: false,
    labeled: false,
    dockSlotId: null,
    status: "completa",
    createdAt: at,
  };
  return { ok: true, unitId: id, snap: { ...snap, loadUnits: [unit, ...snap.loadUnits] } };
}

export function strapLoadUnit(snap: WmsSnapshot, unitId: string): FloorResult {
  const unit = snap.loadUnits.find((u) => u.id === unitId);
  if (!unit) return { ok: false, error: "unit_missing" };
  return {
    ok: true,
    unitId,
    snap: {
      ...snap,
      loadUnits: snap.loadUnits.map((u) =>
        u.id === unitId ? { ...u, strapped: true, status: u.labeled ? u.status : ("flejada" as const) } : u,
      ),
    },
  };
}

export function labelLoadUnit(snap: WmsSnapshot, unitId: string, labelCode: string): FloorResult {
  const unit = snap.loadUnits.find((u) => u.id === unitId);
  if (!unit) return { ok: false, error: "unit_missing" };
  const code = labelCode.trim();
  if (!code) return { ok: false, error: "label_required" };
  return {
    ok: true,
    unitId,
    snap: {
      ...snap,
      loadUnits: snap.loadUnits.map((u) =>
        u.id === unitId ? { ...u, labeled: true, labelCode: code, status: "etiquetada" as const } : u,
      ),
    },
  };
}

/**
 * Deja la unidad en un hueco real de muelle. No fabrica palet ni etiqueta.
 * El pasillo que ve en pantalla es el `dock` del pedido.
 */
export function placeLoadUnitOnDock(
  snap: WmsSnapshot,
  unitId: string,
  dockSlotCode: string,
): FloorResult {
  const unit = snap.loadUnits.find((u) => u.id === unitId);
  if (!unit) return { ok: false, error: "unit_missing" };
  const slot = snap.slots.find(
    (s) => s.siteId === unit.siteId && s.zone === "muelle" && codesEqual(s.code, dockSlotCode.trim()),
  );
  if (!slot) return { ok: false, error: "dock_slot" };
  return {
    ok: true,
    unitId,
    snap: {
      ...snap,
      loadUnits: snap.loadUnits.map((u) =>
        u.id === unitId ? { ...u, dockSlotId: slot.id, status: "en_muelle" as const } : u,
      ),
    },
  };
}

export const LOAD_KIND_LABEL: Record<LoadUnitKind, { es: string; en: string }> = {
  palet: { es: "Palet", en: "Pallet" },
  caja: { es: "Caja / box", en: "Case / box" },
  carro: { es: "Carro", en: "Roll cage" },
};

export const LOAD_KIND_VOICE: Record<LoadUnitKind, { es: string; en: string }> = {
  palet: { es: "palet", en: "pallet" },
  caja: { es: "box", en: "box" },
  carro: { es: "carro", en: "roll cage" },
};

/** Palet: una etiqueta por cada lado. Box y carro: una por unidad. */
export function sidesPerUnit(kind: LoadUnitKind): number {
  return kind === "palet" ? 2 : 1;
}

export function labelCountForUnits(kind: LoadUnitKind, units: number): number {
  return Math.max(0, units) * sidesPerUnit(kind);
}

export function assignmentForOperatorOrder(
  snap: WmsSnapshot,
  operatorId: string,
  orderId: string,
): SuperAssignment | null {
  return snap.superAssignments.find((a) => a.operatorId === operatorId && a.orderId === orderId) ?? null;
}

export interface SuperLabelFace {
  unitIndex: number;
  units: number;
  side: "A" | "B";
  sideLabel: string;
}

export function superLabelFaces(kind: LoadUnitKind, units: number, lang: "es" | "en" = "es"): SuperLabelFace[] {
  const sides = sidesPerUnit(kind);
  const faces: SuperLabelFace[] = [];
  for (let i = 1; i <= units; i += 1) {
    for (let s = 0; s < sides; s += 1) {
      const side = s === 0 ? "A" : "B";
      faces.push({
        unitIndex: i,
        units,
        side,
        sideLabel:
          sides === 1
            ? lang === "es"
              ? "Una cara"
              : "One face"
            : lang === "es"
              ? `Lado ${side}`
              : `Side ${side}`,
      });
    }
  }
  return faces;
}

/**
 * El operario dice cuántos palets/box/carros ha hecho.
 * 2 palets → 4 etiquetas (una por lado). No se inventa SSCC.
 */
export function declareUnitsMade(
  snap: WmsSnapshot,
  operatorId: string,
  orderId: string,
  units: number,
  at = new Date().toISOString(),
): FloorResult & { labels?: number } {
  if (!Number.isFinite(units) || units < 1 || !Number.isInteger(units)) {
    return { ok: false, error: "invalid_units" };
  }
  const assignment = assignmentForOperatorOrder(snap, operatorId, orderId);
  if (!assignment) return { ok: false, error: "order_missing" };
  if (!assignment.loadKind) return { ok: false, error: "kind_required" };
  const labels = labelCountForUnits(assignment.loadKind, units);
  let next: FloorResult = {
    ok: true,
    snap: {
      ...snap,
      superAssignments: snap.superAssignments.map((a) =>
        a.id === assignment.id ? { ...a, unitsMade: units, labelsPrinted: labels } : a,
      ),
    },
    operatorId,
  };
  const opened = openLoadUnit(next.snap, orderId, assignment.loadKind, operatorId, at);
  if (opened.ok) {
    next = { ...opened, operatorId };
  } else if (opened.error !== "nothing_picked" && opened.error !== "lines_used") {
    return opened;
  }
  return { ...next, labels };
}

function escHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Etiquetas de súper para imprimir. Datos del pedido y del lado; sin SSCC inventado. */
export function superSideLabelsHtml(
  snap: WmsSnapshot,
  operatorId: string,
  orderId: string,
  lang: "es" | "en" = "es",
): string | null {
  const assignment = assignmentForOperatorOrder(snap, operatorId, orderId);
  const order = snap.outbound.find((o) => o.id === orderId);
  if (!assignment?.loadKind || !assignment.unitsMade || !order) return null;
  const kind = assignment.loadKind;
  const faces = superLabelFaces(kind, assignment.unitsMade, lang);
  const site = snap.sites.find((s) => s.id === order.siteId);
  const kindLabel = LOAD_KIND_LABEL[kind][lang];
  const cards = faces
    .map((f) => {
      return `<article class="label">
        <p class="org">${escHtml(snap.org.legalName)}</p>
        <h1>${escHtml(order.customer)}</h1>
        <p class="meta">${escHtml(order.code)} · ${escHtml(site?.city ?? "")}</p>
        <p class="kind">${escHtml(kindLabel)} ${f.unitIndex}/${f.units}</p>
        <p class="side">${escHtml(f.sideLabel)}</p>
        <p class="dock">${lang === "es" ? "Muelle" : "Dock"} ${escHtml(order.dock)}</p>
        <p class="hint">${lang === "es" ? "Pegar en este lado. Sin SSCC inventado." : "Stick on this side. No invented SSCC."}</p>
      </article>`;
    })
    .join("");
  const title = lang === "es" ? "Etiquetas de súper" : "Store labels";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/><title>${escHtml(title)} ${escHtml(order.code)}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;margin:12px;background:#e2e8f0}
  h1{font-size:22px;margin:4px 0 8px}
  .sheet{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .label{background:#fff;border:2px solid #0f172a;border-radius:8px;padding:16px 18px;min-height:220px;break-inside:avoid}
  .org{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#475569;margin:0}
  .meta,.hint{color:#475569;font-size:12px}
  .kind{font-size:18px;font-weight:700;margin:12px 0 0}
  .side{font-size:28px;font-weight:800;margin:4px 0}
  .dock{font-size:16px;font-weight:600}
  @media print{body{margin:8mm;background:#fff}.label{box-shadow:none}}
</style></head><body>
  <div class="sheet">${cards}</div>
</body></html>`;
}

export function openSuperSideLabelsPrint(
  snap: WmsSnapshot,
  operatorId: string,
  orderId: string,
  lang: "es" | "en" = "es",
): boolean {
  if (typeof window === "undefined") return false;
  const html = superSideLabelsHtml(snap, operatorId, orderId, lang);
  if (!html) return false;
  const popup = window.open("", "_blank", "noopener,noreferrer,width=820,height=900");
  if (!popup) return false;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}
