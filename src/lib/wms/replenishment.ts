import { skuOnHand } from "./inventory";
import type { ReplenishmentProposal } from "./movements";
import type { WmsSnapshot } from "./types";

/**
 * Reposición por MIN/MAX del SKU, además de la cara de picking vacía.
 * No sustituye `proposeReplenishments`.
 */
export function proposeMinMaxReplenishments(snap: WmsSnapshot): ReplenishmentProposal[] {
  const proposals: ReplenishmentProposal[] = [];
  const usedPallets = new Set<string>();

  for (const sku of snap.skus) {
    const sites = [...new Set(snap.pallets.filter((p) => p.skuId === sku.id).map((p) => p.siteId))];
    for (const siteId of sites) {
      const onHand = skuOnHand(snap, sku.id, siteId);
      if (onHand >= sku.minStock) continue;
      const face = snap.slots.find(
        (s) =>
          s.siteId === siteId &&
          s.pickFace &&
          s.status === "libre" &&
          !s.palletId,
      );
      const reserve = snap.slots.find((s) => {
        if (s.siteId !== siteId || s.pickFace || !s.palletId) return false;
        const pallet = snap.pallets.find((p) => p.id === s.palletId);
        return Boolean(pallet && pallet.skuId === sku.id && pallet.status !== "expedido" && !usedPallets.has(pallet.id));
      });
      if (!face || !reserve?.palletId) continue;
      usedPallets.add(reserve.palletId);
      proposals.push({
        id: `mm-${sku.id}-${face.id}`,
        siteId,
        skuId: sku.id,
        fromSlotId: reserve.id,
        toSlotId: face.id,
        palletId: reserve.palletId,
        aisle: face.aisle,
        recommendedFleetKind: "retractil_doble",
      });
    }
  }
  return proposals;
}
