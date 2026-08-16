-- Briefs 6–7. Inventory core + balances.
-- No se aplica en producción desde este repo. Idempotente.
-- balances = estado actual. transactions = ledger histórico append-only.
-- Nunca cambiar un número de stock sin insertar una transacción.
-- Race: UPDATE … WHERE revision = $esperada dentro de una transacción SQL.

create table if not exists public.wms_products (
  id text primary key,
  org_id text not null,
  sku text not null,
  name text not null,
  ean text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  category text not null,
  unique (org_id, sku)
);

create table if not exists public.wms_product_uoms (
  id text primary key,
  org_id text not null,
  product_id text not null references public.wms_products (id),
  uom text not null,
  is_base boolean not null default false,
  factor_to_base numeric not null check (factor_to_base > 0),
  unique (org_id, product_id, uom)
);

create table if not exists public.wms_lots (
  id text primary key,
  org_id text not null,
  product_id text not null references public.wms_products (id),
  lot text not null,
  expiry timestamptz,
  received_at timestamptz not null,
  blocked boolean not null default false,
  unique (org_id, product_id, lot)
);

create table if not exists public.wms_serial_numbers (
  id text primary key,
  org_id text not null,
  product_id text not null references public.wms_products (id),
  serial text not null,
  lot text,
  status text not null default 'in_stock' check (status in ('in_stock', 'shipped')),
  unique (org_id, product_id, serial)
);

create table if not exists public.wms_inventory_balances (
  id text primary key,
  org_id text not null,
  sku_id text not null,
  lot text,
  location_id text not null,
  on_hand numeric not null default 0,
  allocated numeric not null default 0,
  picked numeric not null default 0,
  packed numeric not null default 0,
  staged numeric not null default 0,
  blocked numeric not null default 0,
  quarantined numeric not null default 0,
  available numeric generated always as (on_hand - allocated - blocked - quarantined) stored,
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (org_id, sku_id, lot, location_id)
);

create table if not exists public.wms_inventory_reservations (
  id text primary key,
  org_id text not null,
  sku_id text not null,
  lot text,
  location_id text not null,
  qty numeric not null check (qty > 0),
  status text not null check (status in ('open', 'released', 'consumed')),
  order_code text not null,
  wave_id text,
  line_id text,
  pallet_id text,
  created_at timestamptz not null default now(),
  revision integer not null default 1
);

create table if not exists public.wms_inventory_transactions (
  id text primary key,
  org_id text not null,
  type text not null check (type in (
    'RECEIPT','PUTAWAY','MOVE','ALLOCATE','DEALLOCATE','PICK','REPLENISH',
    'PACK','STAGE','LOAD','SHIP','RETURN','ADJUSTMENT','COUNT','QUARANTINE','RELEASE'
  )),
  sku_id text not null,
  lot text,
  from_location_id text,
  to_location_id text,
  qty numeric not null,
  counted_qty numeric,
  uom text not null default 'ud',
  reason text not null default '',
  ref_type text,
  ref_id text,
  pallet_id text,
  created_at timestamptz not null default now(),
  actor_id text
);

create table if not exists public.wms_inventory_adjustments (
  id text primary key,
  org_id text not null,
  sku_id text not null,
  lot text,
  location_id text not null,
  qty numeric not null,
  reason text not null,
  tx_id text not null references public.wms_inventory_transactions (id),
  created_at timestamptz not null default now(),
  actor_id text
);

create table if not exists public.wms_inventory_counts (
  id text primary key,
  org_id text not null,
  sku_id text not null,
  lot text,
  location_id text not null,
  expected_qty numeric not null,
  counted_qty numeric not null,
  variance numeric not null,
  tx_id text not null references public.wms_inventory_transactions (id),
  created_at timestamptz not null default now(),
  actor_id text
);

create index if not exists wms_inv_bal_org_sku_idx
  on public.wms_inventory_balances (org_id, sku_id);
create index if not exists wms_inv_tx_org_ts_idx
  on public.wms_inventory_transactions (org_id, created_at);
create index if not exists wms_inv_tx_ref_idx
  on public.wms_inventory_transactions (ref_type, ref_id);
create index if not exists wms_inv_rsv_org_status_idx
  on public.wms_inventory_reservations (org_id, status);

alter table public.wms_products enable row level security;
alter table public.wms_product_uoms enable row level security;
alter table public.wms_lots enable row level security;
alter table public.wms_serial_numbers enable row level security;
alter table public.wms_inventory_balances enable row level security;
alter table public.wms_inventory_reservations enable row level security;
alter table public.wms_inventory_transactions enable row level security;
alter table public.wms_inventory_adjustments enable row level security;
alter table public.wms_inventory_counts enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'wms_products','wms_product_uoms','wms_lots','wms_serial_numbers',
    'wms_inventory_balances','wms_inventory_reservations',
    'wms_inventory_transactions','wms_inventory_adjustments','wms_inventory_counts'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select using (public.mps_is_team())',
      t, t
    );
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format(
      'create policy %I_write on public.%I for insert with check (public.mps_is_team())',
      t, t
    );
  end loop;
end $$;

-- Sin policy de update/delete en transactions: el ledger no se reescribe.
drop policy if exists wms_inventory_balances_update on public.wms_inventory_balances;
create policy wms_inventory_balances_update
  on public.wms_inventory_balances
  for update
  using (public.mps_is_team())
  with check (public.mps_is_team());

create or replace function public.apply_wms_inventory_tx(
  p_id text,
  p_org text,
  p_type text,
  p_sku text,
  p_lot text,
  p_from text,
  p_to text,
  p_qty numeric,
  p_counted numeric,
  p_expected_revision integer,
  p_allow_negative boolean default false
) returns public.wms_inventory_balances
language plpgsql
as $$
declare
  loc text;
  row public.wms_inventory_balances;
  n integer;
begin
  loc := coalesce(p_from, p_to);
  if loc is null then
    raise exception 'location_required';
  end if;

  insert into public.wms_inventory_balances (id, org_id, sku_id, lot, location_id)
  values (
    'ibal-' || p_org || '|' || p_sku || '|' || coalesce(p_lot, '') || '|' || loc,
    p_org, p_sku, p_lot, loc
  )
  on conflict (org_id, sku_id, lot, location_id) do nothing;

  select * into row
  from public.wms_inventory_balances
  where org_id = p_org and sku_id = p_sku and location_id = loc
    and lot is not distinct from p_lot
  for update;

  if p_expected_revision is not null and row.revision is distinct from p_expected_revision then
    raise exception 'revision_conflict';
  end if;

  if p_type = 'RECEIPT' or p_type = 'RETURN' then
    row.on_hand := row.on_hand + p_qty;
  elsif p_type = 'ALLOCATE' then
    row.allocated := row.allocated + p_qty;
  elsif p_type = 'DEALLOCATE' then
    row.allocated := row.allocated - p_qty;
  elsif p_type = 'PICK' then
    row.on_hand := row.on_hand - p_qty;
    row.allocated := row.allocated - least(row.allocated, p_qty);
    row.picked := row.picked + p_qty;
  elsif p_type = 'PACK' then
    row.picked := row.picked - p_qty;
    row.packed := row.packed + p_qty;
  elsif p_type = 'STAGE' then
    row.packed := row.packed - least(row.packed, p_qty);
    row.picked := row.picked - least(row.picked, p_qty - least(row.packed + p_qty, p_qty));
    row.staged := row.staged + p_qty;
  elsif p_type = 'LOAD' then
    row.staged := row.staged - p_qty;
  elsif p_type = 'SHIP' then
    row.on_hand := row.on_hand - p_qty;
  elsif p_type = 'ADJUSTMENT' then
    row.on_hand := row.on_hand + p_qty;
  elsif p_type = 'COUNT' then
    row.on_hand := p_counted;
  elsif p_type = 'QUARANTINE' then
    row.quarantined := row.quarantined + p_qty;
  elsif p_type = 'RELEASE' then
    row.quarantined := row.quarantined - p_qty;
  end if;

  if row.blocked > row.on_hand then
    row.blocked := greatest(0, row.on_hand);
  end if;

  if not p_allow_negative then
    if row.on_hand < 0 or row.allocated < 0 or row.picked < 0 or row.packed < 0
       or row.staged < 0 or row.blocked < 0 or row.quarantined < 0
       or (row.on_hand - row.allocated - row.blocked - row.quarantined) < 0 then
      raise exception 'negative_stock';
    end if;
  end if;

  update public.wms_inventory_balances
  set
    on_hand = row.on_hand,
    allocated = row.allocated,
    picked = row.picked,
    packed = row.packed,
    staged = row.staged,
    blocked = row.blocked,
    quarantined = row.quarantined,
    revision = row.revision + 1,
    updated_at = now()
  where id = row.id and revision = row.revision;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'revision_conflict';
  end if;

  insert into public.wms_inventory_transactions (
    id, org_id, type, sku_id, lot, from_location_id, to_location_id,
    qty, counted_qty
  ) values (
    p_id, p_org, p_type, p_sku, p_lot, p_from, p_to,
    case when p_type = 'COUNT' then p_counted - row.on_hand else p_qty end,
    case when p_type = 'COUNT' then p_counted else null end
  );

  select * into row from public.wms_inventory_balances where id = row.id;
  return row;
end;
$$;

comment on table public.wms_inventory_balances is
  'Estado actual. available = on_hand - allocated - blocked - quarantined. Lock por revision.';
comment on table public.wms_inventory_transactions is
  'Ledger histórico append-only. Toda mutación de stock pasa por aquí.';
comment on function public.apply_wms_inventory_tx is
  'Única vía SQL para mutar un balance: lock de fila + chequeo de revisión + insert del ledger.';
