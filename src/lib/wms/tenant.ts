/**
 * Modelo empresarial: organization → warehouses → zones / locations.
 * Se proyecta desde el snapshot (1 org, 2 hubs). No inventa un tercer centro.
 */

import { CAMPO_NORTE_ORG } from "./org";
import { mapCrmRoleToWms, type WmsMembership } from "./rbac";
import type { Slot, WarehouseSite, WarehouseZone, WmsSnapshot } from "./types";

export type TenantOrganization = {
  id: string;
  code: string;
  legalName: string;
  plan: string;
  billingCurrency: "EUR";
};

export type TenantWarehouse = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  city: string;
  region: string;
  country: string;
};

export type TenantZone = {
  id: string;
  warehouseId: string;
  code: WarehouseZone;
};

export type TenantLocation = {
  id: string;
  warehouseId: string;
  zoneId: string;
  code: string;
  aisle: string;
  rack: number;
  level: number;
  position: 1 | 2;
  pickFace: boolean;
};

export type TenantGraph = {
  organization: TenantOrganization;
  warehouses: TenantWarehouse[];
  zones: TenantZone[];
  locations: TenantLocation[];
  memberships: WmsMembership[];
};

export function zoneRecordId(warehouseId: string, zone: WarehouseZone): string {
  return `zone-${warehouseId}-${zone}`;
}

export function warehouseFromSite(site: WarehouseSite): TenantWarehouse {
  return {
    id: site.id,
    organizationId: site.orgId,
    code: site.code,
    name: site.name,
    city: site.city,
    region: site.region,
    country: site.country,
  };
}

export function zonesFromSite(site: WarehouseSite): TenantZone[] {
  return site.temperatureModes.map((code) => ({
    id: zoneRecordId(site.id, code),
    warehouseId: site.id,
    code,
  }));
}

export function locationFromSlot(slot: Slot): TenantLocation {
  return {
    id: slot.id,
    warehouseId: slot.siteId,
    zoneId: zoneRecordId(slot.siteId, slot.zone),
    code: slot.code,
    aisle: slot.aisle,
    rack: slot.rack,
    level: slot.level,
    position: slot.position,
    pickFace: slot.pickFace,
  };
}

/**
 * Cuentas demo del equipo (mismas que el login). Sin password aquí.
 * Jorge solo Sevilla: es el recorte real de `warehouseIds`, no un segundo org.
 */
export function seedMemberships(orgId = CAMPO_NORTE_ORG.id): WmsMembership[] {
  return [
    {
      userId: "local-sofia",
      email: "sofia@camponorte.demo",
      name: "Sofía Navarro",
      organizationId: orgId,
      roles: [...mapCrmRoleToWms("admin")],
      warehouseIds: "*",
    },
    {
      userId: "local-marta",
      email: "marta@camponorte.demo",
      name: "Marta Vega",
      organizationId: orgId,
      roles: [...mapCrmRoleToWms("booking")],
      warehouseIds: "*",
    },
    {
      userId: "local-luis",
      email: "luis@camponorte.demo",
      name: "Luis Ortega",
      organizationId: orgId,
      roles: [...mapCrmRoleToWms("ops")],
      warehouseIds: "*",
    },
    {
      userId: "local-jorge",
      email: "jorge@camponorte.demo",
      name: "Jorge Peña",
      organizationId: orgId,
      roles: [...mapCrmRoleToWms("guide")],
      warehouseIds: ["site-sev"],
    },
  ];
}

export function projectTenant(snap: WmsSnapshot): TenantGraph {
  const organization: TenantOrganization = {
    id: snap.org.id,
    code: snap.org.id,
    legalName: snap.org.legalName,
    plan: snap.org.plan,
    billingCurrency: snap.org.billingCurrency,
  };
  const warehouses = snap.sites.map(warehouseFromSite);
  const zones = snap.sites.flatMap(zonesFromSite);
  const zoneIds = new Set(zones.map((z) => z.id));
  const locations = snap.slots
    .filter((s) => zoneIds.has(zoneRecordId(s.siteId, s.zone)))
    .map(locationFromSlot);
  return {
    organization,
    warehouses,
    zones,
    locations,
    memberships: snap.memberships?.length ? snap.memberships : seedMemberships(snap.org.id),
  };
}
