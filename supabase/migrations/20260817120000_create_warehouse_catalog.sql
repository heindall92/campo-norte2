-- Phase 2: warehouse, locations, products, UOM.
-- El snapshot demo sigue siendo la fuente operativa hasta Phase 3.

create table if not exists public.wms_warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  code text not null,
  name text not null,
  city text,
  region text,
  country text not null default 'ES',
  sqm numeric,
  timezone text not null default 'Europe/Madrid',
  allow_negative_stock boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint wms_warehouses_code_unique unique (organization_id, code)
);

create index if not exists wms_warehouses_org_idx on public.wms_warehouses (organization_id);

drop trigger if exists wms_warehouses_updated_at on public.wms_warehouses;
create trigger wms_warehouses_updated_at
  before update on public.wms_warehouses
  for each row execute function public.set_updated_at();

create table if not exists public.wms_warehouse_zones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete cascade,
  code text not null,
  kind text not null
    check (kind in ('seco', 'fresco', 'congelado', 'picking', 'muelle', 'crossdock', 'yard')),
  aisle text,
  temperature_min_c numeric,
  temperature_max_c numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wms_warehouse_zones_code_unique unique (warehouse_id, code)
);

create index if not exists wms_zones_wh_idx on public.wms_warehouse_zones (warehouse_id);

drop trigger if exists wms_warehouse_zones_updated_at on public.wms_warehouse_zones;
create trigger wms_warehouse_zones_updated_at
  before update on public.wms_warehouse_zones
  for each row execute function public.set_updated_at();

create table if not exists public.wms_warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete cascade,
  zone_id uuid not null references public.wms_warehouse_zones (id) on delete cascade,
  code text not null,
  aisle text not null,
  bay integer not null,
  level integer not null,
  position integer not null check (position in (1, 2)),
  pick_face boolean not null default false,
  status text not null default 'libre'
    check (status in ('libre', 'ocupado', 'reservado', 'bloqueado', 'inventario')),
  capacity_pallets integer not null default 1 check (capacity_pallets >= 0),
  capacity_volume_m3 numeric,
  capacity_weight_kg numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wms_locations_code_unique unique (warehouse_id, code)
);

create index if not exists wms_locations_wh_status_idx
  on public.wms_warehouse_locations (warehouse_id, status);
create index if not exists wms_locations_pick_idx
  on public.wms_warehouse_locations (warehouse_id, pick_face);

drop trigger if exists wms_warehouse_locations_updated_at on public.wms_warehouse_locations;
create trigger wms_warehouse_locations_updated_at
  before update on public.wms_warehouse_locations
  for each row execute function public.set_updated_at();

create table if not exists public.wms_product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  code text not null,
  label_es text not null,
  label_en text not null,
  system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wms_product_categories_code_unique unique (organization_id, code)
);

drop trigger if exists wms_product_categories_updated_at on public.wms_product_categories;
create trigger wms_product_categories_updated_at
  before update on public.wms_product_categories
  for each row execute function public.set_updated_at();

create table if not exists public.wms_uoms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  code text not null,
  label_es text not null,
  label_en text not null,
  created_at timestamptz not null default now(),
  constraint wms_uoms_code_unique unique (organization_id, code)
);

create table if not exists public.wms_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  sku text not null,
  name text not null,
  category_id uuid references public.wms_product_categories (id),
  abc text check (abc in ('A', 'B', 'C')),
  base_uom_id uuid not null references public.wms_uoms (id),
  min_stock numeric(18, 6) not null default 0,
  max_stock numeric(18, 6) not null default 0,
  rotation_strategy text not null default 'FEFO'
    check (rotation_strategy in ('FIFO', 'FEFO', 'LIFO', 'MANUAL')),
  gtin text,
  is_lot_tracked boolean not null default true,
  is_serial_tracked boolean not null default false,
  is_expiry_tracked boolean not null default true,
  weight_kg numeric,
  volume_m3 numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  constraint wms_products_sku_unique unique (organization_id, sku)
);

create index if not exists wms_products_org_idx on public.wms_products (organization_id);

drop trigger if exists wms_products_updated_at on public.wms_products;
create trigger wms_products_updated_at
  before update on public.wms_products
  for each row execute function public.set_updated_at();

create table if not exists public.wms_product_uoms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  product_id uuid not null references public.wms_products (id) on delete cascade,
  uom_id uuid not null references public.wms_uoms (id),
  qty_in_base numeric(18, 6) not null check (qty_in_base > 0),
  is_default_inbound boolean not null default false,
  is_default_outbound boolean not null default false,
  created_at timestamptz not null default now(),
  constraint wms_product_uoms_unique unique (product_id, uom_id)
);

-- Demo org UOMs (no products yet — seed operativo sigue en TypeScript).
insert into public.wms_uoms (organization_id, code, label_es, label_en)
select 'c0a1e000-0001-4000-8000-000000000001', x.code, x.label_es, x.label_en
from (values
  ('UNIT', 'Unidad', 'Unit'),
  ('BOX', 'Caja pequeña', 'Box'),
  ('CASE', 'Caja', 'Case'),
  ('PALLET', 'Palet', 'Pallet'),
  ('KG', 'Kilogramo', 'Kilogram'),
  ('L', 'Litro', 'Litre')
) as x(code, label_es, label_en)
on conflict (organization_id, code) do nothing;

alter table public.wms_warehouses enable row level security;
alter table public.wms_warehouse_zones enable row level security;
alter table public.wms_warehouse_locations enable row level security;
alter table public.wms_product_categories enable row level security;
alter table public.wms_uoms enable row level security;
alter table public.wms_products enable row level security;
alter table public.wms_product_uoms enable row level security;

drop policy if exists "wms warehouses read" on public.wms_warehouses;
create policy "wms warehouses read" on public.wms_warehouses
  for select to authenticated
  using (organization_id in (select public.wms_org_ids()));
drop policy if exists "wms warehouses write" on public.wms_warehouses;
create policy "wms warehouses write" on public.wms_warehouses
  for all to authenticated
  using (public.wms_has('wms.warehouse.write', organization_id))
  with check (public.wms_has('wms.warehouse.write', organization_id));

drop policy if exists "wms zones read" on public.wms_warehouse_zones;
create policy "wms zones read" on public.wms_warehouse_zones
  for select to authenticated
  using (organization_id in (select public.wms_org_ids()));
drop policy if exists "wms zones write" on public.wms_warehouse_zones;
create policy "wms zones write" on public.wms_warehouse_zones
  for all to authenticated
  using (public.wms_has('wms.warehouse.write', organization_id))
  with check (public.wms_has('wms.warehouse.write', organization_id));

drop policy if exists "wms locations read" on public.wms_warehouse_locations;
create policy "wms locations read" on public.wms_warehouse_locations
  for select to authenticated
  using (organization_id in (select public.wms_org_ids()));
drop policy if exists "wms locations write" on public.wms_warehouse_locations;
create policy "wms locations write" on public.wms_warehouse_locations
  for all to authenticated
  using (public.wms_has('wms.warehouse.write', organization_id))
  with check (public.wms_has('wms.warehouse.write', organization_id));

drop policy if exists "wms categories read" on public.wms_product_categories;
create policy "wms categories read" on public.wms_product_categories
  for select to authenticated
  using (organization_id in (select public.wms_org_ids()));
drop policy if exists "wms categories write" on public.wms_product_categories;
create policy "wms categories write" on public.wms_product_categories
  for all to authenticated
  using (public.wms_has('wms.catalog.write', organization_id))
  with check (public.wms_has('wms.catalog.write', organization_id));

drop policy if exists "wms uoms read" on public.wms_uoms;
create policy "wms uoms read" on public.wms_uoms
  for select to authenticated
  using (organization_id in (select public.wms_org_ids()));
drop policy if exists "wms uoms write" on public.wms_uoms;
create policy "wms uoms write" on public.wms_uoms
  for all to authenticated
  using (public.wms_has('wms.catalog.write', organization_id))
  with check (public.wms_has('wms.catalog.write', organization_id));

drop policy if exists "wms products read" on public.wms_products;
create policy "wms products read" on public.wms_products
  for select to authenticated
  using (organization_id in (select public.wms_org_ids()));
drop policy if exists "wms products write" on public.wms_products;
create policy "wms products write" on public.wms_products
  for all to authenticated
  using (public.wms_has('wms.catalog.write', organization_id))
  with check (public.wms_has('wms.catalog.write', organization_id));

drop policy if exists "wms product uoms read" on public.wms_product_uoms;
create policy "wms product uoms read" on public.wms_product_uoms
  for select to authenticated
  using (organization_id in (select public.wms_org_ids()));
drop policy if exists "wms product uoms write" on public.wms_product_uoms;
create policy "wms product uoms write" on public.wms_product_uoms
  for all to authenticated
  using (public.wms_has('wms.catalog.write', organization_id))
  with check (public.wms_has('wms.catalog.write', organization_id));
