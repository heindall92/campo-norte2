import type { AppUser } from "@/lib/auth/types";
import { getSupabase } from "@/lib/supabase/client";
import { snapshotLooksUsable } from "@/lib/wms/normalize";
import type { InventoryTxType, PalletStatus, WmsSnapshot } from "@/lib/wms/types";
import {
  ledgerStockPayload,
  overlayStock,
  palletStockPayload,
  productionBootstrapSnapshot,
  productionPlantSnapshot,
  stripStockForFloor,
  type HandlingUnitRow,
  type LedgerRow,
} from "./mapper";
import { canWriteWmsProduction, toPostgresOrgId, type WmsPort } from "./port";

const PROD_CACHE_KEY = "cn-wms-hub-prod-cache-v1";

type HuQueryRow = {
  external_id: string | null;
  sscc: string;
  qty_base: number | string;
  status: PalletStatus | string;
  location_code: string | null;
  lot_code: string | null;
  sku_code: string | null;
  received_at: string | null;
  wms_warehouses?: { code: string } | { code: string }[] | null;
};

type TxQueryRow = {
  id: string;
  type: InventoryTxType | string;
  qty_base: number | string;
  occurred_at: string;
  correlation_id: string | null;
  idempotency_key: string | null;
  reason: string | null;
  wms_products?: { sku: string } | { sku: string }[] | null;
  wms_handling_units?: { external_id: string | null } | { external_id: string | null }[] | null;
};

function nestOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function cacheGet(): WmsSnapshot | null {
  try {
    const raw = localStorage.getItem(PROD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WmsSnapshot;
    return snapshotLooksUsable(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function cacheSet(snap: WmsSnapshot): void {
  try {
    localStorage.setItem(PROD_CACHE_KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

export function createPostgresWmsAdapter(): WmsPort {
  let memory: WmsSnapshot | null = null;

  function peek(): WmsSnapshot {
    return memory ?? cacheGet() ?? productionBootstrapSnapshot();
  }

  return {
    peek,
    async load(orgId) {
      const sb = getSupabase();
      if (!sb) {
        const local = peek();
        memory = local;
        return local;
      }
      const organizationId = toPostgresOrgId(orgId);
      const [{ data: floorRow }, { data: huRows }, { data: txRows }] = await Promise.all([
        sb.from("wms_floor_state").select("payload").eq("organization_id", organizationId).maybeSingle(),
        sb
          .from("wms_handling_units")
          .select(
            "external_id, sscc, qty_base, status, location_code, lot_code, sku_code, received_at, wms_warehouses(code)",
          )
          .eq("organization_id", organizationId),
        sb
          .from("wms_inventory_transactions")
          .select(
            "id, type, qty_base, occurred_at, correlation_id, idempotency_key, reason, wms_products(sku), wms_handling_units(external_id)",
          )
          .eq("organization_id", organizationId)
          .order("occurred_at", { ascending: true }),
      ]);

      const payload = floorRow?.payload as WmsSnapshot | undefined;
      const husEmpty = (huRows ?? []).length === 0;
      if (!floorRow || husEmpty) {
        const plant = productionPlantSnapshot();
        const { error: bootErr } = await sb.rpc("wms_save_floor", {
          p_organization_id: organizationId,
          p_floor: stripStockForFloor(plant),
        });
        if (bootErr) throw new Error(bootErr.message);
        const pals = palletStockPayload(plant);
        const ledger = ledgerStockPayload(plant);
        for (let i = 0; i < pals.length; i += 80) {
          const { error: stockErr } = await sb.rpc("wms_commit_stock", {
            p_organization_id: organizationId,
            p_ledger: i === 0 ? ledger : [],
            p_pallets: pals.slice(i, i + 80),
          });
          if (stockErr) throw new Error(stockErr.message);
        }
        memory = plant;
        cacheSet(plant);
        return plant;
      }
      const floor = snapshotLooksUsable(payload) ? payload : productionBootstrapSnapshot();
      const hus: HandlingUnitRow[] = ((huRows ?? []) as HuQueryRow[]).map((row) => ({
        external_id: row.external_id,
        sscc: row.sscc,
        qty_base: Number(row.qty_base) || 0,
        status: row.status,
        location_code: row.location_code,
        lot_code: row.lot_code,
        sku_code: row.sku_code,
        received_at: row.received_at,
        warehouse_code: nestOne(row.wms_warehouses)?.code ?? null,
      }));
      const ledger: LedgerRow[] = ((txRows ?? []) as TxQueryRow[]).map((row) => ({
        id: row.id,
        type: row.type,
        qty_base: Number(row.qty_base) || 0,
        occurred_at: row.occurred_at,
        correlation_id: row.correlation_id,
        idempotency_key: row.idempotency_key,
        reason: row.reason,
        sku: nestOne(row.wms_products)?.sku ?? null,
        pallet_external_id: nestOne(row.wms_handling_units)?.external_id ?? null,
      }));

      const next = overlayStock(floor, hus, ledger);
      memory = next;
      cacheSet(next);
      return next;
    },
    async save(snap, user?: Pick<AppUser, "provider" | "email" | "organizationId"> | null) {
      memory = snap;
      cacheSet(snap);
      if (!canWriteWmsProduction(user)) return;
      const sb = getSupabase();
      if (!sb) return;
      const organizationId = toPostgresOrgId(user?.organizationId ?? snap.org.id);
      const floor = stripStockForFloor(snap);
      const { error: floorErr } = await sb.rpc("wms_save_floor", {
        p_organization_id: organizationId,
        p_floor: floor,
      });
      if (floorErr) throw new Error(floorErr.message);
      const { error: stockErr } = await sb.rpc("wms_commit_stock", {
        p_organization_id: organizationId,
        p_ledger: ledgerStockPayload(snap),
        p_pallets: palletStockPayload(snap),
      });
      if (stockErr) throw new Error(stockErr.message);
    },
  };
}

export const postgresWmsAdapter = createPostgresWmsAdapter();
