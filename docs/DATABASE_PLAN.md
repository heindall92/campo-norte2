# Plan de base de datos — Campo Norte WMS

> Phase 0. Propuesta. **No se ha ejecutado SQL nuevo en el tip.**
> `supabase/schema.sql` sigue siendo solo CRM.

---

## 1 · Qué hay hoy

### CRM (existe, no tocar el contrato)

| Tabla | Forma | RLS |
|---|---|---|
| `mps_hub_meta` | JSONB | equipo |
| `mps_leads` / `mps_clients` / `mps_reservations` / `mps_invoices` | fila = JSONB | equipo / bill |
| `mps_profiles` | rol `pending\|admin\|ops\|booking\|guide` | self + admin |
| `mps_lead_outcomes`, `mps_run_log`, `mps_access_log` | relacional | lectura equipo |

`mps_reservations` son **reservas de viaje**, no holds de stock. No reutilizar esa tabla.

### WMS

Ninguna tabla. El almacén es `localStorage['cn-wms-hub-v8']` = `WmsSnapshot`.

Campos del snapshot que un schema futuro debe cubrir (sin inventar entidades nuevas de negocio):

`org, sites, categories, skus, slots, pallets, fleet, chargers, operators, clockPunches, inbound, outbound, carriers, costs, movements, pickWaves, loadUnits, superAssignments, mermaEvents, slotFixes`.

---

## 2 · Estrategia: ledger primero, normalizar después

Un big-bang relacional (50 tablas el día 1) rompe el motor actual y obliga a reescribir cada `confirmPick`.

**Oleada A — ledger**

```
wms_orgs
wms_org_members
wms_sites                 -- índice / onboarding
wms_ledgers               -- org_id PK, revision, payload jsonb
wms_movements             -- extract append-only al guardar
wms_reservations          -- holds (cuando exista el motor)
wms_audit
```

- Fuente de verdad = `wms_ledgers.payload` (el snapshot de hoy).
- `revision` + `UPDATE … WHERE revision = $esperada` = lock optimista.
- Si no hay fila: se sube el LS local (semilla). Si hay fila: **gana el remoto**.
- Login demo (`forceLocalHub`) **no** escribe Postgres. Igual que el CRM.

**Oleada B — tablas operativas** (cuando un módulo se abra de verdad)

No duplicar para «verse enterprise». Extraer cuando el módulo necesite consultar sin bajar el JSON entero, o cuando la integridad no quepa en el blob (holds concurrentes, QC, shipments).

---

## 3 · Oleada A — SQL propuesto (no aplicado)

Un solo tenant sembrado: `org-camponorte`. Sin segunda empresa.

```sql
-- Ejecutar DESPUÉS de schema.sql (usa mps_is_team / mps_can_write).

create table public.wms_orgs (
  id text primary key,
  legal_name text not null,
  plan text not null default 'WMS OS',
  billing_currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

create table public.wms_org_members (
  org_id text not null references public.wms_orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'ops',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.wms_sites (
  id text primary key,
  org_id text not null references public.wms_orgs(id) on delete cascade,
  code text not null,
  name text not null,
  city text not null,
  unique (org_id, code)
);

create table public.wms_ledgers (
  org_id text primary key references public.wms_orgs(id) on delete cascade,
  revision integer not null default 0,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.wms_movements (
  id text primary key,
  org_id text not null references public.wms_orgs(id) on delete cascade,
  at timestamptz not null,
  type text not null,
  sku_id text,
  pallet_id text,
  from_slot_id text,
  to_slot_id text,
  qty numeric not null,
  operator_id text,
  fleet_id text,
  note text not null default ''
);

create table public.wms_reservations (
  id text primary key,
  org_id text not null references public.wms_orgs(id) on delete cascade,
  pallet_id text not null,
  sku_id text not null,
  qty numeric not null,
  status text not null check (status in ('hold', 'consumed', 'released')),
  wave_id text,
  line_id text,
  order_code text,
  at timestamptz not null,
  released_at timestamptz
);

create table public.wms_audit (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.wms_orgs(id) on delete cascade,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb
);

insert into public.wms_orgs (id, legal_name, plan, billing_currency)
values ('org-camponorte', 'Campo Norte Logística, S.L.', 'WMS OS · multi-hub', 'EUR')
on conflict (id) do nothing;
```

### RLS (transición single-tenant)

```sql
-- Miembro de org O equipo CRM (un solo tenant hoy).
create function public.wms_is_org_member(p_org_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.mps_is_team()
      or exists (
        select 1 from public.wms_org_members m
        where m.org_id = p_org_id and m.user_id = auth.uid()
      );
$$;
```

Políticas: `select` si `wms_is_org_member(org_id)`; `insert/update` si además `mps_can_write()`. Guía (`guide`) hoy es equipo: puede operar planta. No endurecer a «solo admin escribe stock» sin que planta lo pida: el operario **tiene** que marcar.

---

## 4 · Oleada B — tablas por módulo (cuando se implemente)

No crearlas vacías ahora. Contrato previsto para no improvisar nombres:

### Inventory / ATP

| Tabla | Para |
|---|---|
| `wms_skus` | Catálogo (hoy `skus[]`) |
| `wms_pallets` | SSCC único por org |
| `wms_slots` | Ubicaciones |
| `wms_reservations` | Ya en oleada A |
| `wms_adjustments` | Cycle count + merma tipada |

### Receiving (brief 16)

| Tabla | Notas |
|---|---|
| `wms_suppliers` | Solo los que se escriban |
| `wms_asns` / `wms_asn_lines` | Sustituye `lines: number` |
| `wms_receipts` / `wms_receipt_lines` | Parcial / exceso / faltante / dañado / lote |
| `wms_inbound_incidents` | Toda diferencia |

Flujo: `ASN → ARRIVAL → DOCK → RECEIVING → QC → PUTAWAY → AVAILABLE`.

### Quality (brief 17)

| Tabla | Notas |
|---|---|
| `wms_quality_inspections` | `PENDING\|APPROVED\|REJECTED\|QUARANTINED` |
| `wms_quarantine_stock` | **No disponible para picking** |
| `wms_quality_incidents` | |

`PalletStatus.cuarentena` y `qcStatus` bloquean `confirmPick` / putaway (oleada 5). SQL de inspecciones **no** aplicado.

### Replenishment (brief 15)

No hace falta tabla nueva al inicio: `Sku.minStock` / `maxStock` ya están. Tareas en snapshot `replenishTasks` (`PLANNED|URGENT|AUTO`, origen ola o MIN/MAX). AUTO no mueve sin operario. SQL **no** aplicado.

### Putaway / slotting (18–19)

Reglas en dominio (`slotting.ts`). `slottingRules` y `slottingRecommendations` en el snapshot (semilla vacía). `accepted_at` null hasta confirmar. **Nunca** mover sin confirmación. SQL de tabla **no** aplicado.

### Packing (20)

| Tabla | Notas |
|---|---|
| `wms_packing_stations` | |
| `wms_packages` | caja / palet / bulto, peso, dims |
| `wms_package_lines` | |
| FK | order, SSCC, tracking, carrier |

`LoadUnit` actual es el embrión. Migrar, no clonar en paralelo para siempre.

Dominio (oleada 8, SQL **no** aplicado): `packStations` / `packPackages` en el snapshot. Semilla vacía.

### SSCC (21)

| Tabla | Notas |
|---|---|
| `wms_sscc_registry` | único por org; extension digit + GCP cuando exista GCP real. **Sin GCP no generar** números que parezcan GS1. |

Dominio (oleada 8): unicidad en palets + `cartonSscc` + `packPackages`. `org.ssccPrefix` null en semilla → hay que escribir el SSCC. Con prefijo se genera `{prefijo}{serial 6}` interno, sin dígito GS1. Hasta entonces la etiqueta imprime el SSCC **escrito**.

### Shipping / carriers (22–23)

| Tabla | Notas |
|---|---|
| `wms_shipments` | `PACKED→STAGED→LOADED→SHIPPED` + timestamps |
| `wms_shipment_lines` / `wms_shipment_packages` | |
| `wms_carrier_services` | |
| `wms_tracking_events` | Solo eventos reales o mock **etiquetado** |

`CarrierAdapter` en aplicación, no en SQL.

### Dock / yard (24–25)

| Tabla | Notas |
|---|---|
| `wms_docks` | Hoy `order.dock` es un string (`M-05`) |
| `wms_dock_appointments` / `wms_dock_events` | llegada, check-in, carga/descarga, salida |
| `wms_yard_locations` / `wms_yard_visits` | |
| `wms_yard_vehicles` / `wms_yard_drivers` | **No** son la flota de carretillas (`fleet[]`) |

No sembrar visitas de camión inventadas.

### Returns (26)

`wms_returns`, `wms_return_lines`, `wms_return_inspections`.  
`REQUESTED → RECEIVED → INSPECTING → RESTOCK | QUARANTINE | SCRAP`.

### Cycle count (27)

`wms_count_sessions`, `wms_count_lines`. Tipos: full / cíclico / ABC / slot / SKU / lote.  
Diferencia → `wms_adjustments` + `wms_movements.type = 'ajuste'`.

---

## 5 · Unicidad e integridad (cuando toque)

| Recurso | Clave |
|---|---|
| SSCC | único `(org_id, sscc)` |
| Slot code | único `(site_id, code)` |
| ASN code | único `(org_id, code)` |
| Order code | único `(org_id, code)` |
| Hold | no superar `pallet.qty`; available = qty − holds ajenos |
| Quarantine | `available` excluye esas unidades |

El ledger JSON **no** puede garantizar unicidad entre pestañas. Por eso oleada A (revisión) va antes que oleada B.

---

## 6 · Qué no va a Postgres

- Preferencia de auriculares (`cn-wms-headset-on`).
- Posición del FAB de IA.
- Tesorería / facturas (ya tienen `mps_*`).
- P&L tarifario demo: se calcula; no es un libro mayor.

---

## 7 · Semilla

`buildWmsSeed()` sigue siendo la semilla de demo. Al hidratar Postgres vacío se **sube** esa semilla una vez, marcada `seededFromDemo: true`. No se inventa otro hub ni otros SKU en SQL.
