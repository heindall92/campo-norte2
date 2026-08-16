# Plan de base de datos — Campo Norte WMS

**Fase:** 1–11 (migraciones en `supabase/migrations/`). El snapshot DEMO sigue siendo operativo hasta el adapter Postgres.  
**Motor:** PostgreSQL 15+ (Supabase).  
**Convención de archivos:** `supabase/migrations/YYYYMMDDHHMMSS_description.sql`  
**IDs:** `uuid` (`gen_random_uuid()`).  
**Tiempo:** `timestamptz`. `created_at` / `updated_at` en todas las tablas de negocio. `created_by` / `updated_by` (uuid → auth.users) cuando la fila es mutada por un humano.

El esquema CRM actual (`mps_*`) **se conserva**. El WMS vive en tablas nuevas con prefijo `wms_` (o schema `wms`) para no chocar con jsonb histórico.

---

## 1. Principios

1. Relacional de verdad: columnas, FK, CHECK, UNIQUE. Nada de `payload jsonb` para stock.
2. `organization_id` en **todas** las tablas de negocio WMS.
3. RLS activo en todas; deny by default.
4. El ledger (`wms_inventory_transactions`) es append-only. Sin UPDATE/DELETE desde roles de planta.
5. Mutaciones de stock **solo** vía funciones RPC transaccionales.
6. Idempotencia: `idempotency_key` único por organización en comandos RF y receipts.
7. Migrations idempotentes cuando sea razonable (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
8. Nunca credenciales en SQL de seed de producción.

---

## 2. Relación con el esquema actual

| Objeto actual | Destino |
|---|---|
| `mps_profiles` | Se mantiene. Phase 1: tabla `wms_organization_members` + `wms_user_roles`. El enum CRM `admin/ops/booking/guide/pending` sigue para el Hub. |
| `mps_leads` … `mps_invoices` | Sin cambios en Phase 1–7 |
| `mps_access_log` | Se mantiene; WMS usará `wms_audit_logs` aparte (más rico) |
| Snapshot `WmsSnapshot` | Vista materializada lógica en DEMO; en PROD se descompone en las tablas de abajo |

No hay `supabase/migrations/` hoy. Phase 1 crea la carpeta e **importa** `schema.sql` actual como migración baseline `20260816100000_baseline_crm.sql` (copia, no reescritura) para que el historial sea lineal.

---

## 3. Extensiones y utilidades

```sql
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm"; -- búsqueda SKU / SSCC

-- updated_at genérico
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

Helper RLS (Phase 1):

```sql
-- org ids del usuario
create or replace function public.wms_org_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select organization_id
  from public.wms_organization_members
  where user_id = auth.uid()
    and status = 'active';
$$;
```

---

## 4. Phase 1 — Tenant, auth, RBAC

### 4.1 `wms_organizations`

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text not null | |
| legal_name | text | |
| slug | text unique | |
| billing_currency | text default 'EUR' | |
| status | text | `active/suspended` |
| created_at / updated_at | timestamptz | |

Semilla demo: id fijo documentado **solo en seed SQL de demo**, no en código de app como secreto.

### 4.2 `wms_organization_members`

`user_id uuid → auth.users`, `organization_id`, `status` (`active/invited/disabled`), `created_at`.  
UNIQUE (organization_id, user_id).

### 4.3 `wms_roles` / `wms_permissions` / `wms_role_permissions` / `wms_user_roles`

Roles seed: `ADMIN`, `WAREHOUSE_MANAGER`, `SUPERVISOR`, `RECEIVING`, `PICKER`, `PACKER`, `SHIPPER`, `FORKLIFT_OPERATOR`, `INVENTORY_CONTROLLER`, `AUDITOR`, `VIEWER`.

`wms_user_roles`: user + org + role + opcional `warehouse_id` (NULL = todos los almacenes de la org).

Permisos ejemplo: `wms.inventory.read`, `wms.inventory.adjust`, `wms.pick.confirm`, `wms.ship.dispatch`, `wms.audit.read`.

RLS: miembros leen su org; solo ADMIN de la org asigna roles (trigger equivalente a `mps_guard_role_change`).

---

## 5. Phase 2 — Warehouse, locations, products, UOM

### 5.1 `wms_warehouses`

Mapea `WarehouseSite`.

| Columna | Equivale hoy |
|---|---|
| id, organization_id | site.id, orgId |
| code | `CN-SEV-01` UNIQUE (org, code) |
| name, city, region, country | |
| sqm | |
| timezone | nuevo (Europe/Madrid) |
| allow_negative_stock | boolean default false |
| status | `active/inactive` |

### 5.2 `wms_warehouse_zones`

Mapea `WarehouseZone` + pasillo.

| Columna | Notas |
|---|---|
| warehouse_id | FK |
| code | `seco`, `A`, `muelle` — UNIQUE (warehouse, code) |
| kind | `seco/fresco/congelado/picking/muelle/crossdock/yard` |
| temperature_min_c / max_c | nullable |
| aisle | nullable (pasillo) |

### 5.3 `wms_warehouse_locations`

Mapea `Slot`.

| Columna | Notas |
|---|---|
| warehouse_id, zone_id | FK |
| code | `A-03-02-1` UNIQUE (warehouse, code) |
| aisle, bay, level, position | |
| pick_face | boolean |
| status | `libre/ocupado/reservado/bloqueado/inventario` |
| capacity_pallets | |
| capacity_volume_m3 / capacity_weight_kg | nullable, Phase 5 |
| check | location pertenece al warehouse de la zona |

Índices: `(warehouse_id, status)`, `(warehouse_id, pick_face)`, trigram en `code`.

### 5.4 `wms_products`

Mapea `Sku`.

| Columna | Notas |
|---|---|
| organization_id | |
| sku | UNIQUE (org, sku) |
| name | |
| category_id | FK `wms_product_categories` |
| abc | A/B/C |
| base_uom_id | FK |
| min_stock / max_stock | en base UOM |
| rotation_strategy | `FIFO/FEFO/LIFO/MANUAL` default FEFO si perecedero |
| gtin | nullable |
| is_lot_tracked / is_serial_tracked / is_expiry_tracked | booleans |
| weight_kg / volume_m3 | por unidad base |

### 5.5 `wms_product_categories`

Mapea `ProductCategory` (system + user).

### 5.6 `wms_uoms` / `wms_product_uoms`

Catálogo global ligero (`UNIT`, `BOX`, `CASE`, `PALLET`, `KG`, `L`) por org (para poder etiquetar en ES).

`wms_product_uoms`: `product_id`, `uom_id`, `qty_in_base` (numeric), `is_default_inbound/outbound`.

Ejemplo: CASE = 12 UNIT; PALLET = 576 UNIT (48 CASE × 12).

---

## 6. Phase 3 — Lots, balances, ledger

### 6.1 `wms_lots`

| Columna | Notas |
|---|---|
| product_id, organization_id | |
| lot_code | UNIQUE (product, lot_code) |
| batch_code | |
| manufacture_date, expiry_date | |
| status | `active/blocked/expired` |

### 6.2 `wms_serial_numbers`

`product_id`, `serial`, UNIQUE (org, product, serial), `lot_id` nullable, `status`.

### 6.3 `wms_handling_units` (palets / bultos)

Mapea `Pallet`.

| Columna | Notas |
|---|---|
| sscc | UNIQUE (organization_id, sscc) |
| warehouse_id | |
| location_id | nullable (en tránsito) |
| product_id, lot_id | |
| qty_base | numeric(18,6) |
| status | `en_ubicacion/en_transito/picking/muelle/expedido/cuarentena` |
| supplier_id, asn_id, received_at | |

CHECK: SSCC no vacío. Generación GS1 en aplicación + unique constraint.

### 6.4 `wms_inventory_balances`

Una fila = stock **disponible de consulta** para (org, warehouse, location, product, lot, hu, quality_status).

| Columna | Tipo |
|---|---|
| on_hand | numeric(18,6) not null default 0 |
| allocated | numeric(18,6) not null default 0 |
| picked / packed / staged | numeric(18,6) default 0 |
| blocked / quarantined | numeric(18,6) default 0 |
| UNIQUE | (warehouse_id, location_id, product_id, coalesce(lot_id, uuid_nil()), coalesce(hu_id, uuid_nil()), quality_status) |

Generated column o vista:

```sql
available as (on_hand - allocated - blocked - quarantined)
```

CHECK: `on_hand >= 0` (salvo warehouse.allow_negative_stock).  
CHECK: `allocated >= 0` y `allocated <= on_hand` cuando no hay negativos.

Índices: product+warehouse, lot expiry join, location.

### 6.5 `wms_inventory_transactions` (ledger)

Append-only.

| Columna | Notas |
|---|---|
| id | uuid |
| organization_id, warehouse_id | |
| type | enum/text CHECK lista del encargo |
| product_id, lot_id, serial_id, hu_id | |
| from_location_id, to_location_id | |
| qty_base | signed: + receipt, − ship, etc. **o** qty absoluta + direction. Recomendado: `qty_base` siempre > 0 + `from`/`to` |
| uom_id, qty_uom | captura |
| reservation_id, order_id, wave_id, task_id, asn_id, shipment_id | nullable FKs |
| reason | text |
| actor_id, device_id, correlation_id, idempotency_key | |
| occurred_at | timestamptz not null |
| created_at | |

UNIQUE (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL.

**Sin FK on delete cascade** desde ledger hacia pedidos: `ON DELETE RESTRICT`.

### 6.6 `wms_inventory_reservations`

| Columna | Notas |
|---|---|
| balance_id o (location, product, lot) | |
| order_id, order_line_id, wave_id | |
| qty_base | |
| status | `open/released/consumed/cancelled` |

### 6.7 `wms_inventory_adjustments` / `wms_inventory_count_sessions` / `wms_inventory_count_lines`

Conteo cíclico actual (`CycleCountTask`) se persiste como sesión + líneas. La diferencia genera `COUNT` + opcional `ADJUSTMENT` en el ledger, firmado con `actor_id` (ya hay `operatorId` en dominio).

---

## 7. Phase 4 — Orders y allocation

### `wms_customers` (mínimo)

id, org, code, name. El CRM `clients` puede vincularse después (`crm_client_id` text nullable) sin fusionar jsonb.

### `wms_orders` / `wms_order_lines` / `wms_order_status_events`

Cabecera mapea `OutboundOrder` (`code`, `cut_off`, `dock_id`, `priority`, `carrier_id`, `warehouse_id`).

Línea: product, qty_ordered, qty_allocated, qty_picked, qty_shipped, uom, lot preference.

Estado: CHECK + transición solo por RPC `wms_transition_order`.

---

## 8. Phase 5 — Receiving

`wms_suppliers`  
`wms_asn` / `wms_asn_lines` — hoy `InboundAsn` solo tiene contadores (`lines`, `pallets_expected`, `pallets_done`). Las líneas son **nuevas**.  
`wms_receipts` / `wms_receipt_lines`  
`wms_quality_inspections` / `wms_quality_incidents`

ASN status: `previsto/en_muelle/descargando/ubicando/cerrado` se mapean a `CREATED/ARRIVED/RECEIVING/PUTAWAY/CLOSED`.

---

## 9. Phase 6 — Waves, picking, replenishment

`wms_waves` (kind `picking/reposicion`, status, aisle, operator_id, fleet_id)  
`wms_wave_orders`  
`wms_pick_tasks` — mapea `PickLine` + estados nuevos SHORT/CANCELLED  
`wms_replenishment_tasks` — MIN/MAX y urgent/auto/planned

`operators` de planta: `wms_employees` (no confundir con `auth.users`). Vinculo opcional `user_id`. PIN hash se mueve de snapshot a esta tabla (nunca PIN en claro).

---

## 10. Phase 7 — Packing, SSCC, shipping

`wms_packing_stations`  
`wms_packages` / `wms_package_lines`  
`wms_shipments` / `wms_shipment_lines` / `wms_shipment_packages`  
`wms_carrier_services`  
`wms_tracking_events`

`wms_carriers` mapea `Carrier` (org, code, kind, cutoff_default).

SSCC: unique en `wms_handling_units.sscc` y/o `wms_packages.sscc`.

---

## 11. Phase 8 — Dock, yard, carriers adapter

`wms_docks` (warehouse, code, kind in/out)  
`wms_dock_appointments`  
`wms_dock_events`  
`wms_yard_locations` / `wms_yard_visits`  
`wms_vehicles` / `wms_drivers`

El campo texto `dock` de pedidos/ASN pasa a FK nullable hasta backfill.

Carriers reales: credenciales en **Vault / secrets de servidor**, tabla `wms_carrier_accounts` sin keys en Git. Adapter no vive en SQL.

---

## 12. Phase 9 — Returns y quality (ampliación)

`wms_returns` / `wms_return_lines` / `wms_return_inspections`  
Estados: `REQUESTED/RECEIVED/INSPECTING/RESTOCK/QUARANTINE/SCRAP`.

---

## 13. Phase 10 — RF offline

`wms_device_commands` (servidor): idempotency, status `received/applied/rejected`.  
Outbox del dispositivo no es Postgres (IndexedDB). El servidor guarda el resultado para retried scans.

---

## 14. Phase 11 — Audit y observabilidad

### `wms_audit_logs`

| Columna | Notas |
|---|---|
| actor_id | uuid nullable (sistema) |
| organization_id, warehouse_id | |
| action | text |
| entity, entity_id | |
| before_data, after_data | jsonb |
| reason | |
| device_id, correlation_id | |
| created_at | |

RLS: INSERT solo service/RPC; SELECT AUDITOR/ADMIN; **sin DELETE/UPDATE** para authenticated.

Índice: (org, created_at desc), (entity, entity_id).

---

## 15. Phase 12–13 — Alertas, KPIs, IA

`wms_alerts`: type, severity, status, entity, recommended_action, created_at, resolved_at.  
Tipos del encargo (`LOW_STOCK`, `STOCKOUT`, `EXPIRING`, …). El detector actual se convierte en job o trigger.

KPIs: **vistas** (`wms_v_tower_*`) o tablas snapshot `wms_kpi_daily` si el volumen lo exige. No gráficos sin pregunta operativa.

`wms_ai_findings`: finding, evidence jsonb, confidence, recommendation, optional_action, status `proposed/accepted/rejected`.

---

## 16. Workforce y flota (Phase 1–2 datos, uso continuo)

`wms_employees` — mapea `Operator` (code, name, floor_role, shift, vacant, cost_per_hour, site).  
`wms_clock_punches`  
`wms_fleet_units` / `wms_wall_chargers`  
`wms_cost_lines` — OPEX vs presupuesto (no mezclar con `mps_invoices`)

Batería: `battery_pct`, `battery_source` (`unknown/seed/manual/telemetry`), `battery_reported_at`. Sin trigger que invente %.

---

## 17. RLS (plantilla)

```sql
alter table wms_products enable row level security;

create policy "wms_products_select" on wms_products
  for select to authenticated
  using (organization_id in (select public.wms_org_ids()));

-- writes: permission check via helper wms_has('wms.catalog.write')
```

Warehouse isolation: políticas adicionales `warehouse_id in (select public.wms_warehouse_ids())` para tablas de planta. ADMIN de org ve todos los warehouses.

`SECURITY DEFINER` RPC:

- `wms_confirm_pick(...)`
- `wms_allocate_order(...)`
- `wms_apply_inventory_tx(...)` (interno)

Patrón: validar membership + permiso + `SELECT … FOR UPDATE` del balance + insert ledger + update balance + audit. Una transacción.

---

## 18. Inventario: ejemplo de transacción PICK

```
-- pseudocódigo SQL
begin;
  select * from wms_inventory_balances
    where id = $balance_id
    for update;

  -- available >= qty
  insert into wms_inventory_transactions (type, qty_base, from_location_id, …);
  update wms_inventory_balances
     set allocated = allocated - qty,  -- se consume la reserva
         on_hand = on_hand - qty
   where id = $balance_id
     and on_hand - allocated - blocked - quarantined >= 0;

  insert into wms_handling_units movimiento / update location;
  insert into wms_audit_logs …;
  update wms_pick_tasks set status = 'COMPLETED', qty_picked = qty;
commit;
```

Si el UPDATE no toca filas → `insufficient_stock` (equivalente a no silenciar SHORT).

---

## 19. Índices críticos (además de PK/FK)

- `wms_inventory_balances (warehouse_id, product_id)`
- `wms_inventory_balances (location_id)`
- `wms_inventory_transactions (organization_id, occurred_at desc)`
- `wms_inventory_transactions (product_id, occurred_at)`
- `wms_lots (expiry_date) where status = 'active'`
- `wms_pick_tasks (warehouse_id, status, priority)`
- `wms_orders (warehouse_id, status, cut_off)`
- `wms_handling_units (sscc)`
- `wms_alerts (organization_id, status, severity)`

---

## 20. Seed SQL (Phase 2–3, no Phase 0)

Objetivo de coherencia:

- 1 organization, 2 warehouses (Sevilla, Huelva).
- Zonas y locations generadas (mismo algoritmo que `generateSiteSlots`, en SQL o script TS que emite SQL).
- ≥50 SKU con UOM y lotes.
- Balances = suma de transacciones de seed (script que inserta RECEIPT+PUTAWAY, **no** inserta balances a mano desalineados).
- Pedidos, olas, pick tasks y shipments que cuadran con el ledger.

Prohibido: `random()` en qty de stock sin ledger gemelo.

Hasta que ese seed exista, DEMO MODE sigue usando `src/lib/wms/seed.ts`.

---

## 21. Realtime y Storage

- Realtime: `wms_alerts`, `wms_pick_tasks` (status), `wms_dock_appointments` — Phase 12, no antes.
- Storage: etiquetas PDF/ZPL, fotos QC — Phase 7–9. Buckets por org, RLS storage.

---

## 22. Migraciones previstas (nombres)

| Archivo | Fase |
|---|---|
| `20260816100000_baseline_crm.sql` | 1 (snapshot del schema actual) |
| `20260816120000_create_wms_tenant_rbac.sql` | 1 |
| `20260817120000_create_warehouse_catalog.sql` | 2 |
| `20260818120000_create_inventory_core.sql` | 3 |
| `20260819120000_create_orders_allocation.sql` | 4 |
| `20260820120000_create_receiving_quality.sql` | 5 |
| `20260821120000_create_waves_picking.sql` | 6 |
| `20260822120000_create_packing_shipping.sql` | 7 |
| `20260823120000_create_dock_yard.sql` | 8 |
| `20260824120000_create_returns.sql` | 9 |
| `20260825120000_create_audit_alerts.sql` | 11–12 |

Fechas ilustrativas; al ejecutar se usa timestamp real.

---

## 23. Lo que no se modela aún

- Contabilidad de asientos / PGC (sigue fuera de núcleo CRM).
- Telemetría de flota de fabricante.
- Plantillas biométricas.
- Multi-moneda operativa (billing_currency EUR suficiente).
- Partitioning del ledger (revisar en Phase 14 si el volumen lo pide).
