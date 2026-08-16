-- Phase 4–7: orders, ASN/receipts, waves, packing, shipments, carriers.

create table if not exists public.wms_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  code text not null,
  name text not null,
  crm_client_id text,
  created_at timestamptz not null default now(),
  constraint wms_customers_code_unique unique (organization_id, code)
);

create table if not exists public.wms_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete restrict,
  customer_id uuid references public.wms_customers (id),
  code text not null,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'picking', 'embalaje', 'muelle', 'expedido')),
  priority text not null default 'normal' check (priority in ('normal', 'urgente', 'express')),
  cut_off timestamptz,
  dock_code text,
  carrier_id uuid,
  tracking text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wms_orders_code_unique unique (organization_id, code)
);

create table if not exists public.wms_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  order_id uuid not null references public.wms_orders (id) on delete restrict,
  product_id uuid not null references public.wms_products (id) on delete restrict,
  qty_ordered numeric(18, 6) not null check (qty_ordered > 0),
  qty_allocated numeric(18, 6) not null default 0,
  qty_picked numeric(18, 6) not null default 0,
  qty_shipped numeric(18, 6) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.wms_order_status_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  order_id uuid not null references public.wms_orders (id) on delete restrict,
  from_status text,
  to_status text not null,
  at timestamptz not null default now(),
  actor_id uuid references auth.users (id)
);

create table if not exists public.wms_suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint wms_suppliers_code_unique unique (organization_id, code)
);

create table if not exists public.wms_asn (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete restrict,
  supplier_id uuid references public.wms_suppliers (id),
  code text not null,
  status text not null default 'previsto'
    check (status in ('previsto', 'en_muelle', 'descargando', 'ubicando', 'cerrado')),
  eta timestamptz,
  dock_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wms_asn_code_unique unique (organization_id, code)
);

create table if not exists public.wms_asn_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  asn_id uuid not null references public.wms_asn (id) on delete restrict,
  product_id uuid not null references public.wms_products (id) on delete restrict,
  qty_expected numeric(18, 6) not null check (qty_expected > 0),
  qty_received numeric(18, 6) not null default 0,
  lot_expected text
);

create table if not exists public.wms_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  asn_id uuid not null references public.wms_asn (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users (id)
);

create table if not exists public.wms_receipt_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  asn_id uuid not null references public.wms_asn (id) on delete restrict,
  asn_line_id uuid references public.wms_asn_lines (id),
  kind text not null check (kind in ('parcial', 'exceso', 'faltante', 'lote')),
  expected_qty numeric(18, 6),
  actual_qty numeric(18, 6),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.wms_waves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete restrict,
  code text not null,
  kind text not null check (kind in ('picking', 'reposicion')),
  status text not null default 'abierta' check (status in ('abierta', 'en_curso', 'cerrada')),
  aisle text,
  operator_id uuid,
  fleet_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.wms_pick_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  wave_id uuid not null references public.wms_waves (id) on delete restrict,
  order_code text,
  product_id uuid not null references public.wms_products (id) on delete restrict,
  location_id uuid references public.wms_warehouse_locations (id),
  hu_id uuid references public.wms_handling_units (id),
  qty numeric(18, 6) not null,
  qty_picked numeric(18, 6) not null default 0,
  qty_packed numeric(18, 6) not null default 0,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'en_curso', 'picada', 'faltante', 'omitida')),
  sequence integer not null default 1
);

create table if not exists public.wms_replenishment_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete restrict,
  product_id uuid not null references public.wms_products (id) on delete restrict,
  from_location_id uuid references public.wms_warehouse_locations (id),
  to_location_id uuid references public.wms_warehouse_locations (id),
  hu_id uuid references public.wms_handling_units (id),
  kind text not null default 'pick_face' check (kind in ('pick_face', 'minmax')),
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.wms_carriers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  code text not null,
  name text not null,
  kind text not null check (kind in ('nacional', 'internacional', 'frigorifico', 'paqueteria')),
  cutoff_default text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint wms_carriers_code_unique unique (organization_id, code)
);

create table if not exists public.wms_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  order_id uuid not null references public.wms_orders (id) on delete restrict,
  sscc text not null,
  qty_base numeric(18, 6) not null,
  packed_at timestamptz not null default now(),
  constraint wms_packages_sscc_unique unique (organization_id, sscc)
);

create table if not exists public.wms_shipments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  order_id uuid not null references public.wms_orders (id) on delete restrict,
  carrier_id uuid references public.wms_carriers (id),
  tracking text,
  shipped_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.wms_tracking_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  shipment_id uuid not null references public.wms_shipments (id) on delete restrict,
  status text not null,
  note text,
  at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'wms_customers','wms_orders','wms_order_lines','wms_order_status_events',
    'wms_suppliers','wms_asn','wms_asn_lines','wms_receipts','wms_receipt_incidents',
    'wms_waves','wms_pick_tasks','wms_replenishment_tasks','wms_carriers',
    'wms_packages','wms_shipments','wms_tracking_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ' read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id in (select public.wms_org_ids()))',
      t || ' read', t
    );
    execute format('drop policy if exists %I on public.%I', t || ' write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (organization_id in (select public.wms_org_ids())) with check (organization_id in (select public.wms_org_ids()))',
      t || ' write', t
    );
  end loop;
end $$;
