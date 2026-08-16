-- Phase 3: lots, handling units, balances, ledger, reservations, cycle count.

create table if not exists public.wms_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  product_id uuid not null references public.wms_products (id) on delete restrict,
  lot_code text not null,
  batch_code text,
  manufacture_date date,
  expiry_date date,
  status text not null default 'active'
    check (status in ('active', 'blocked', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wms_lots_code_unique unique (product_id, lot_code)
);

create table if not exists public.wms_serial_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  product_id uuid not null references public.wms_products (id) on delete restrict,
  lot_id uuid references public.wms_lots (id),
  serial text not null,
  status text not null default 'available'
    check (status in ('available', 'allocated', 'shipped', 'scrapped')),
  created_at timestamptz not null default now(),
  constraint wms_serials_unique unique (organization_id, product_id, serial)
);

create table if not exists public.wms_handling_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete restrict,
  location_id uuid references public.wms_warehouse_locations (id),
  product_id uuid not null references public.wms_products (id) on delete restrict,
  lot_id uuid references public.wms_lots (id),
  sscc text not null,
  qty_base numeric(18, 6) not null default 0 check (qty_base >= 0),
  status text not null default 'en_ubicacion'
    check (status in ('en_ubicacion', 'en_transito', 'picking', 'muelle', 'expedido', 'cuarentena')),
  supplier_name text,
  asn_id uuid,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wms_hu_sscc_unique unique (organization_id, sscc)
);

create table if not exists public.wms_inventory_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete restrict,
  location_id uuid references public.wms_warehouse_locations (id),
  product_id uuid not null references public.wms_products (id) on delete restrict,
  lot_id uuid references public.wms_lots (id),
  hu_id uuid references public.wms_handling_units (id),
  quality_status text not null default 'available'
    check (quality_status in ('available', 'blocked', 'quarantined')),
  on_hand numeric(18, 6) not null default 0,
  allocated numeric(18, 6) not null default 0 check (allocated >= 0),
  picked numeric(18, 6) not null default 0,
  packed numeric(18, 6) not null default 0,
  staged numeric(18, 6) not null default 0,
  blocked numeric(18, 6) not null default 0 check (blocked >= 0),
  quarantined numeric(18, 6) not null default 0 check (quarantined >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wms_balances_on_hand_nonneg check (on_hand >= 0)
);

create unique index if not exists wms_balances_grain_idx
  on public.wms_inventory_balances (
    warehouse_id,
    coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
    product_id,
    coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(hu_id, '00000000-0000-0000-0000-000000000000'::uuid),
    quality_status
  );

create table if not exists public.wms_inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete restrict,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete restrict,
  type text not null check (type in (
    'RECEIPT','PUTAWAY','MOVE','ALLOCATE','DEALLOCATE','PICK','REPLENISH','PACK',
    'STAGE','LOAD','SHIP','RETURN','ADJUSTMENT','COUNT','QUARANTINE','RELEASE'
  )),
  product_id uuid not null references public.wms_products (id) on delete restrict,
  lot_id uuid references public.wms_lots (id) on delete restrict,
  serial_id uuid references public.wms_serial_numbers (id) on delete restrict,
  hu_id uuid references public.wms_handling_units (id) on delete restrict,
  from_location_id uuid references public.wms_warehouse_locations (id) on delete restrict,
  to_location_id uuid references public.wms_warehouse_locations (id) on delete restrict,
  qty_base numeric(18, 6) not null check (qty_base > 0),
  reservation_id uuid,
  order_id uuid,
  wave_id uuid,
  task_id uuid,
  asn_id uuid,
  shipment_id uuid,
  reason text,
  actor_id uuid references auth.users (id),
  device_id text,
  correlation_id text,
  idempotency_key text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists wms_ledger_idem_idx
  on public.wms_inventory_transactions (organization_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.wms_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  balance_id uuid references public.wms_inventory_balances (id) on delete restrict,
  hu_id uuid references public.wms_handling_units (id) on delete restrict,
  order_id uuid,
  order_line_id uuid,
  wave_id uuid,
  qty_base numeric(18, 6) not null check (qty_base > 0),
  status text not null default 'open'
    check (status in ('open', 'released', 'consumed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wms_inventory_count_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid references auth.users (id)
);

create table if not exists public.wms_inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  session_id uuid not null references public.wms_inventory_count_sessions (id) on delete cascade,
  location_id uuid not null references public.wms_warehouse_locations (id) on delete restrict,
  hu_id uuid references public.wms_handling_units (id) on delete restrict,
  expected_qty numeric(18, 6) not null,
  counted_qty numeric(18, 6),
  variance numeric(18, 6),
  created_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'wms_lots', 'wms_serial_numbers', 'wms_handling_units', 'wms_inventory_balances',
    'wms_inventory_transactions', 'wms_inventory_reservations',
    'wms_inventory_count_sessions', 'wms_inventory_count_lines'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ' read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id in (select public.wms_org_ids()))',
      t || ' read', t
    );
  end loop;
end $$;

drop policy if exists "wms_inventory_balances write" on public.wms_inventory_balances;
create policy "wms_inventory_balances write" on public.wms_inventory_balances
  for all to authenticated
  using (public.wms_has('wms.inventory.adjust', organization_id))
  with check (public.wms_has('wms.inventory.adjust', organization_id));

drop policy if exists "wms_inventory_transactions insert" on public.wms_inventory_transactions;
create policy "wms_inventory_transactions insert" on public.wms_inventory_transactions
  for insert to authenticated
  with check (organization_id in (select public.wms_org_ids()));

drop policy if exists "wms_lots write" on public.wms_lots;
create policy "wms_lots write" on public.wms_lots
  for all to authenticated
  using (public.wms_has('wms.inventory.adjust', organization_id))
  with check (public.wms_has('wms.inventory.adjust', organization_id));

drop policy if exists "wms_handling_units write" on public.wms_handling_units;
create policy "wms_handling_units write" on public.wms_handling_units
  for all to authenticated
  using (public.wms_has('wms.inventory.adjust', organization_id))
  with check (public.wms_has('wms.inventory.adjust', organization_id));

drop policy if exists "wms_reservations write" on public.wms_inventory_reservations;
create policy "wms_reservations write" on public.wms_inventory_reservations
  for all to authenticated
  using (public.wms_has('wms.pick.confirm', organization_id))
  with check (public.wms_has('wms.pick.confirm', organization_id));
