import { WMS_DEMO_NOW } from "./alerts";
import { appendAuditLog } from "./audit";
import { markShipmentPacked } from "./shipping";
import type { PackPackage, PackStation, WmsSnapshot } from "./types";

export type PackError =
  | "order_missing"
  | "order_done"
  | "station_missing"
  | "station_site"
  | "code_required"
  | "name_required"
  | "site_missing"
  | "station_dup"
  | "sscc_required"
  | "sscc_taken"
  | "prefix_required"
  | "sscc_exhausted"
  | "invalid_measure"
  | "line_missing"
  | "line_order"
  | "package_missing";

export type PackResult =
  | { ok: true; snap: WmsSnapshot; stationId?: string; packageId?: string; sscc?: string }
  | { ok: false; error: PackError };

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function cleanCode(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/** Prefijo escrito. Vacío o ausente = hay que teclear el SSCC. */
export function configuredSsccPrefix(snap: WmsSnapshot): string | null {
  const prefix = snap.org.ssccPrefix?.trim() ?? "";
  return prefix.length ? prefix : null;
}

export function listedSsccCodes(snap: WmsSnapshot): string[] {
  const codes: string[] = [];
  for (const pallet of snap.pallets) {
    const sscc = pallet.sscc.trim();
    if (sscc) codes.push(sscc);
  }
  for (const pkg of snap.packPackages ?? []) {
    const sscc = pkg.sscc.trim();
    if (sscc) codes.push(sscc);
  }
  for (const wave of snap.pickWaves) {
    for (const line of wave.lines) {
      const sscc = line.cartonSscc?.trim() ?? "";
      if (sscc) codes.push(sscc);
    }
  }
  return codes;
}

export function isSsccTaken(
  snap: WmsSnapshot,
  sscc: string,
  except?: { packageId?: string; lineId?: string; palletId?: string },
): boolean {
  const code = sscc.trim();
  if (!code) return false;
  for (const pallet of snap.pallets) {
    if (except?.palletId && pallet.id === except.palletId) continue;
    if (pallet.sscc.trim() === code) return true;
  }
  for (const pkg of snap.packPackages ?? []) {
    if (except?.packageId && pkg.id === except.packageId) continue;
    if (pkg.sscc.trim() === code) return true;
  }
  for (const wave of snap.pickWaves) {
    for (const line of wave.lines) {
      if (except?.lineId && line.id === except.lineId) continue;
      if ((line.cartonSscc?.trim() ?? "") === code) return true;
    }
  }
  return false;
}

/**
 * SSCC interno bajo el prefijo escrito.
 * No añade dígito de control GS1 ni rellena 18 dígitos: sin GCP no se fabrica un SSCC que lo parezca.
 */
export function generatePackSscc(snap: WmsSnapshot): { ok: true; sscc: string } | { ok: false; error: Extract<PackError, "prefix_required" | "sscc_exhausted"> } {
  const prefix = configuredSsccPrefix(snap);
  if (!prefix) return { ok: false, error: "prefix_required" };
  const taken = new Set(listedSsccCodes(snap));
  for (let n = 1; n <= 999_999; n += 1) {
    const sscc = `${prefix}${String(n).padStart(6, "0")}`;
    if (!taken.has(sscc)) return { ok: true, sscc };
  }
  return { ok: false, error: "sscc_exhausted" };
}

export function setOrgSsccPrefix(snap: WmsSnapshot, prefix: string | null): PackResult {
  const next = prefix?.trim() ?? "";
  return {
    ok: true,
    snap: {
      ...snap,
      org: { ...snap.org, ssccPrefix: next.length ? next : null },
    },
  };
}

function writtenMeasure(value: number | null | undefined): { ok: true; value: number | null } | { ok: false } {
  if (value == null) return { ok: true, value: null };
  if (!Number.isFinite(value) || value < 0) return { ok: false };
  return { ok: true, value };
}

export function addPackStation(
  snap: WmsSnapshot,
  input: { warehouseId: string; code: string; name: string },
  at = WMS_DEMO_NOW,
): PackResult {
  const code = cleanCode(input.code);
  const name = cleanCode(input.name);
  if (!code) return { ok: false, error: "code_required" };
  if (!name) return { ok: false, error: "name_required" };
  if (!snap.sites.some((s) => s.id === input.warehouseId)) return { ok: false, error: "site_missing" };
  const dup = (snap.packStations ?? []).some(
    (s) => s.warehouseId === input.warehouseId && s.code.toUpperCase() === code.toUpperCase(),
  );
  if (dup) return { ok: false, error: "station_dup" };
  const station: PackStation = {
    id: uid("pst"),
    warehouseId: input.warehouseId,
    code,
    name,
    createdAt: at,
  };
  return {
    ok: true,
    stationId: station.id,
    snap: { ...snap, packStations: [station, ...(snap.packStations ?? [])] },
  };
}

function lineBelongsToOrder(snap: WmsSnapshot, orderCode: string, lineId: string): boolean {
  return snap.pickWaves.some((w) => w.lines.some((l) => l.id === lineId && l.orderCode === orderCode));
}

export function openPackPackage(
  snap: WmsSnapshot,
  input: {
    orderId: string;
    stationId?: string | null;
    sscc?: string | null;
    weightKg?: number | null;
    dimLengthCm?: number | null;
    dimWidthCm?: number | null;
    dimHeightCm?: number | null;
    lineIds?: string[];
    createdBy?: string | null;
  },
  at = WMS_DEMO_NOW,
): PackResult {
  const order = snap.outbound.find((o) => o.id === input.orderId);
  if (!order) return { ok: false, error: "order_missing" };
  if (order.status === "expedido") return { ok: false, error: "order_done" };

  const stationId = input.stationId?.trim() || null;
  if (stationId) {
    const station = (snap.packStations ?? []).find((s) => s.id === stationId);
    if (!station) return { ok: false, error: "station_missing" };
    if (station.warehouseId !== order.siteId) return { ok: false, error: "station_site" };
  }

  const weight = writtenMeasure(input.weightKg);
  const length = writtenMeasure(input.dimLengthCm);
  const width = writtenMeasure(input.dimWidthCm);
  const height = writtenMeasure(input.dimHeightCm);
  if (!weight.ok || !length.ok || !width.ok || !height.ok) return { ok: false, error: "invalid_measure" };

  const lineIds = [...new Set((input.lineIds ?? []).map((id) => id.trim()).filter(Boolean))];
  for (const lineId of lineIds) {
    const exists = snap.pickWaves.some((w) => w.lines.some((l) => l.id === lineId));
    if (!exists) return { ok: false, error: "line_missing" };
    if (!lineBelongsToOrder(snap, order.code, lineId)) return { ok: false, error: "line_order" };
  }

  let sscc = cleanCode(input.sscc);
  if (!sscc) {
    const generated = generatePackSscc(snap);
    if (!generated.ok) return generated;
    sscc = generated.sscc;
  }
  if (isSsccTaken(snap, sscc)) return { ok: false, error: "sscc_taken" };

  const pkg: PackPackage = {
    id: uid("pkg"),
    orderId: order.id,
    stationId,
    sscc,
    weightKg: weight.value,
    dimLengthCm: length.value,
    dimWidthCm: width.value,
    dimHeightCm: height.value,
    lineIds,
    createdAt: at,
    createdBy: input.createdBy ?? null,
  };

  let next: WmsSnapshot = {
    ...snap,
    packPackages: [pkg, ...(snap.packPackages ?? [])],
  };
  next = appendAuditLog(next, {
    actorId: pkg.createdBy,
    warehouseId: order.siteId,
    action: "pack.open",
    entity: "pack_package",
    entityId: pkg.id,
    beforeData: null,
    afterData: { sscc: pkg.sscc, orderId: pkg.orderId, weightKg: pkg.weightKg },
    reason: "open pack package",
    deviceId: null,
    correlationId: pkg.id,
    timestamp: at,
  });
  const packed = markShipmentPacked(next, order.id, at);
  return { ok: true, snap: packed.ok ? packed.snap : next, packageId: pkg.id, sscc: pkg.sscc };
}

function escHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function measureLine(pkg: PackPackage, lang: "es" | "en"): string {
  const bits: string[] = [];
  if (pkg.weightKg != null) bits.push(lang === "es" ? `${pkg.weightKg} kg` : `${pkg.weightKg} kg`);
  if (pkg.dimLengthCm != null && pkg.dimWidthCm != null && pkg.dimHeightCm != null) {
    bits.push(`${pkg.dimLengthCm}×${pkg.dimWidthCm}×${pkg.dimHeightCm} cm`);
  }
  if (!bits.length) return lang === "es" ? "Peso y medidas no escritas" : "Weight and dims not written";
  return bits.join(" · ");
}

/**
 * Etiqueta logística del bulto. Imprime el SSCC del registro.
 * No copia tracking del pedido ni fabrica uno.
 */
export function packPackageLabelHtml(
  snap: WmsSnapshot,
  packageId: string,
  lang: "es" | "en" = "es",
): string | null {
  const pkg = (snap.packPackages ?? []).find((p) => p.id === packageId);
  if (!pkg) return null;
  const order = snap.outbound.find((o) => o.id === pkg.orderId);
  if (!order) return null;
  const site = snap.sites.find((s) => s.id === order.siteId);
  const station = pkg.stationId ? (snap.packStations ?? []).find((s) => s.id === pkg.stationId) : null;
  const title = lang === "es" ? "Etiqueta de packing" : "Packing label";
  const hint =
    lang === "es"
      ? "SSCC del registro. Sin tracking de transportista."
      : "Registry SSCC. No carrier tracking.";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/><title>${escHtml(title)} ${escHtml(pkg.sscc)}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;margin:12px;background:#e2e8f0}
  h1{font-size:22px;margin:4px 0 8px}
  .label{background:#fff;border:2px solid #0f172a;border-radius:8px;padding:16px 18px;min-height:220px;max-width:420px}
  .org{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#475569;margin:0}
  .sscc{font-size:22px;font-weight:800;font-family:ui-monospace,monospace;margin:12px 0 4px;letter-spacing:.04em}
  .meta,.hint{color:#475569;font-size:12px}
  .dock{font-size:16px;font-weight:600}
  @media print{body{margin:8mm;background:#fff}}
</style></head><body>
  <article class="label">
    <p class="org">${escHtml(snap.org.legalName)}</p>
    <h1>${escHtml(order.customer)}</h1>
    <p class="meta">${escHtml(order.code)} · ${escHtml(site?.city ?? "")}${station ? ` · ${escHtml(station.code)}` : ""}</p>
    <p class="sscc">${escHtml(pkg.sscc)}</p>
    <p class="meta">${escHtml(measureLine(pkg, lang))}</p>
    <p class="dock">${lang === "es" ? "Muelle" : "Dock"} ${escHtml(order.dock)}</p>
    <p class="hint">${escHtml(hint)}</p>
  </article>
</body></html>`;
}

export function openPackPackagePrint(
  snap: WmsSnapshot,
  packageId: string,
  lang: "es" | "en" = "es",
): boolean {
  if (typeof window === "undefined") return false;
  const html = packPackageLabelHtml(snap, packageId, lang);
  if (!html) return false;
  const popup = window.open("", "_blank", "noopener,noreferrer,width=520,height=720");
  if (!popup) return false;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}

export function packagesForOrder(snap: WmsSnapshot, orderId: string): PackPackage[] {
  return (snap.packPackages ?? []).filter((p) => p.orderId === orderId);
}

export function stationsForWarehouse(snap: WmsSnapshot, warehouseId: string): PackStation[] {
  return (snap.packStations ?? []).filter((s) => s.warehouseId === warehouseId);
}
