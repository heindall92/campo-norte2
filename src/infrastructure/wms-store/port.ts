import type { AppUser } from "@/lib/auth/types";
import { forceLocalHub, wmsMode } from "@/lib/runtime";
import type { WmsSnapshot } from "@/lib/wms/types";

/** UUID fijo de la org demo en Postgres (migrations Phase 1). */
export const WMS_PG_ORG_ID = "c0a1e000-0001-4000-8000-000000000001";
export const WMS_SNAPSHOT_ORG_ID = "org-camponorte";

export function toPostgresOrgId(orgId: string | null | undefined): string {
  const raw = (orgId ?? "").trim();
  if (!raw || raw === WMS_SNAPSHOT_ORG_ID) return WMS_PG_ORG_ID;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw;
  }
  return WMS_PG_ORG_ID;
}

export function isDemoWmsEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase().endsWith("@camponorte.demo");
}

/**
 * PRODUCTION escribe tablas wms_* solo con sesión Supabase real.
 * Login demo (provider local, email @camponorte.demo, o hub forzado) nunca escribe prod.
 */
export function canWriteWmsProduction(user: Pick<AppUser, "provider" | "email"> | null | undefined): boolean {
  if (!user) return false;
  if (forceLocalHub()) return false;
  if (wmsMode() !== "production") return false;
  if (user.provider === "local") return false;
  if (isDemoWmsEmail(user.email)) return false;
  return true;
}

export interface WmsPort {
  peek(): WmsSnapshot;
  load(orgId?: string | null): Promise<WmsSnapshot>;
  save(snap: WmsSnapshot, user?: Pick<AppUser, "provider" | "email" | "organizationId"> | null): Promise<void>;
}
