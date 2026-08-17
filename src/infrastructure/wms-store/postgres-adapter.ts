import type { AppUser } from "@/lib/auth/types";
import { getSupabase } from "@/lib/supabase/client";
import { snapshotLooksUsable } from "@/lib/wms/normalize";
import type { InventoryTxType, PalletStatus, WmsSnapshot } from "@/lib/wms/types";
import {
  fulfillmentPayload,
  overlayFulfillment,
  stripFloorForPostgres,
  type FulfillmentRows,
} from "./fulfillment";
import {
  ledgerStockPayload,
  overlayStock,
  palletStockPayload,
  productionBootstrapSnapshot,
  productionPlantSnapshot,
  stockCommitBatches,
  type HandlingUnitRow,
  type LedgerRow,
} from "./mapper";
import { canWriteWmsProduction, toPostgresOrgId, type WmsPort } from "./port";

const PROD_CACHE_KEY = "cn-wms-hub-prod-cache-v2";

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
    if (!snapshotLooksUsable(parsed)) return null;
    if (parsed.pallets.length > 0 && parsed.pallets.every((p) => p.qty === 0)) return null;
    return parsed;
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

async function persistStock(
  sb: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> },
  organizationId: string,
  snap: WmsSnapshot,
) {
  const batches = stockCommitBatches(palletStockPayload(snap), ledgerStockPayload(snap));
  for (const batch of batches) {
    const { error } = await sb.rpc("wms_commit_stock", {
      p_organization_id: organizationId,
      p_ledger: batch.ledger,
      p_pallets: batch.pallets,
    });
    if (error) throw new Error(error.message);
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
      const [{ data: floorRow }, { data: huRows }, { data: txRows }, fillRes] = await Promise.all([
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
        sb.rpc("wms_load_fulfillment", { p_organization_id: organizationId }),
      ]);
      if (fillRes.error) throw new Error(fillRes.error.message);
      const fulfillment = fillRes.data;

      const payload = floorRow?.payload as WmsSnapshot | undefined;
      const husEmpty = (huRows ?? []).length === 0;
      if (!floorRow || husEmpty) {
        const plant = productionPlantSnapshot();
        const { error: bootErr } = await sb.rpc("wms_save_floor", {
          p_organization_id: organizationId,
          p_floor: stripFloorForPostgres(plant),
        });
        if (bootErr) throw new Error(bootErr.message);
        const { error: fillErr } = await sb.rpc("wms_save_fulfillment", {
          p_organization_id: organizationId,
          p_payload: fulfillmentPayload(plant),
        });
        if (fillErr) throw new Error(fillErr.message);
        await persistStock(sb, organizationId, plant);
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

      const next = overlayFulfillment(
        overlayStock(floor, hus, ledger),
        (fulfillment ?? null) as FulfillmentRows | null,
      );
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
      const { error: fillErr } = await sb.rpc("wms_save_fulfillment", {
        p_organization_id: organizationId,
        p_payload: fulfillmentPayload(snap),
      });
      if (fillErr) throw new Error(fillErr.message);
      const { error: floorErr } = await sb.rpc("wms_save_floor", {
        p_organization_id: organizationId,
        p_floor: stripFloorForPostgres(snap),
      });
      if (floorErr) throw new Error(floorErr.message);
      await persistStock(sb, organizationId, snap);
    },
  };
}

export const postgresWmsAdapter = createPostgresWmsAdapter();
