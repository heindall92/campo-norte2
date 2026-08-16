import { computeWmsAlerts } from "./alerts";
import { skuOnHand } from "./inventory";
import { proposeMinMaxReplenishments } from "./replenishment";
import { proposeReplenishments } from "./movements";
import type { WmsSnapshot } from "./types";

export type TowerActionKind =
  | "ASIGNAR_PICKER"
  | "LANZAR_OLA"
  | "REPOSICION"
  | "CORTE_FEFO"
  | "BLOQUEO_MUELLE";

export interface TowerAction {
  id: string;
  kind: TowerActionKind;
  titleEs: string;
  titleEn: string;
  detailEs: string;
  detailEn: string;
  entityId: string;
  siteId: string;
}

export function computeTowerActions(snap: WmsSnapshot, siteId?: string): TowerAction[] {
  const actions: TowerAction[] = [];
  const inSite = (id: string) => !siteId || id === siteId;

  for (const wave of snap.pickWaves) {
    if (!inSite(wave.siteId) || wave.status === "cerrada") continue;
    if (!wave.operatorId) {
      actions.push({
        id: `act-pick-${wave.id}`,
        kind: "ASIGNAR_PICKER",
        titleEs: `Asignar picker · ${wave.code}`,
        titleEn: `Assign picker · ${wave.code}`,
        detailEs: `${wave.lines.length} líneas sin operario`,
        detailEn: `${wave.lines.length} lines without operator`,
        entityId: wave.id,
        siteId: wave.siteId,
      });
    }
  }

  for (const order of snap.outbound) {
    if (!inSite(order.siteId) || order.status !== "pendiente") continue;
    const hasWave = snap.pickWaves.some((w) => w.lines.some((l) => l.orderCode === order.code));
    if (!hasWave) {
      actions.push({
        id: `act-wave-${order.id}`,
        kind: "LANZAR_OLA",
        titleEs: `Lanzar ola · ${order.code}`,
        titleEn: `Release wave · ${order.code}`,
        detailEs: `${order.customer} · ${order.priority}`,
        detailEn: `${order.customer} · ${order.priority}`,
        entityId: order.id,
        siteId: order.siteId,
      });
    }
  }

  const replenish = [...proposeReplenishments(snap), ...proposeMinMaxReplenishments(snap)];
  for (const p of replenish.slice(0, 8)) {
    if (!inSite(p.siteId)) continue;
    actions.push({
      id: `act-${p.id}`,
      kind: "REPOSICION",
      titleEs: `Reposición ${p.aisle}`,
      titleEn: `Replenish ${p.aisle}`,
      detailEs: p.id.startsWith("mm-") ? "MIN/MAX del SKU" : "Cara de picking vacía",
      detailEn: p.id.startsWith("mm-") ? "SKU MIN/MAX" : "Empty pick face",
      entityId: p.id,
      siteId: p.siteId,
    });
  }

  const now = new Date("2026-08-15T12:00:00.000Z").getTime();
  for (const pallet of snap.pallets) {
    if (!inSite(pallet.siteId) || !pallet.expiry || pallet.status === "expedido") continue;
    const exp = new Date(pallet.expiry).getTime();
    if (exp - now <= 3 * 24 * 60 * 60 * 1000) {
      actions.push({
        id: `act-fefo-${pallet.id}`,
        kind: "CORTE_FEFO",
        titleEs: `FEFO · lote ${pallet.lot}`,
        titleEn: `FEFO · lot ${pallet.lot}`,
        detailEs: `Caduca ${pallet.expiry.slice(0, 10)} · ${skuOnHand(snap, pallet.skuId, pallet.siteId)} ud.`,
        detailEn: `Expires ${pallet.expiry.slice(0, 10)} · ${skuOnHand(snap, pallet.skuId, pallet.siteId)} u.`,
        entityId: pallet.id,
        siteId: pallet.siteId,
      });
    }
  }

  const alerts = computeWmsAlerts(snap, new Date("2026-08-15T12:00:00.000Z"), siteId);
  for (const a of alerts.filter((x) => x.kind === "cut_off" && x.severity === "critical").slice(0, 4)) {
    actions.push({
      id: `act-dock-${a.id}`,
      kind: "BLOQUEO_MUELLE",
      titleEs: a.titleEs,
      titleEn: a.titleEn,
      detailEs: a.detailEs,
      detailEn: a.detailEn,
      entityId: a.entityId ?? a.id,
      siteId: a.siteId,
    });
  }

  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}
