-- Phase production: RPCs de stock (append-only ledger) + floor no-stock + grants.
-- Stock NUNCA se guarda como jsonb. El floor (olas, flota, huecos) sí: no es ledger.

create or replace function public.wms_stable_uuid(p_text text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select (
    substr(md5(p_text), 1, 8) || '-' ||
    substr(md5(p_text), 9, 4) || '-' ||
    '4' || substr(md5(p_text), 13, 3) || '-' ||
    '8' || substr(md5(p_text), 17, 3) || '-' ||
    substr(md5(p_text), 21, 12)
  )::uuid;
$$;

alter table public.wms_handling_units
  add column if not exists external_id text,
  add column if not exists location_code text,
  add column if not exists lot_code text,
  add column if not exists sku_code text;

create unique index if not exists wms_hu_external_idx
  on public.wms_handling_units (organization_id, external_id)
  where external_id is not null;

create table if not exists public.wms_floor_state (
  organization_id uuid primary key references public.wms_organizations (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

alter table public.wms_floor_state enable row level security;
drop policy if exists "wms_floor_state read" on public.wms_floor_state;
create policy "wms_floor_state read" on public.wms_floor_state
  for select to authenticated
  using (organization_id in (select public.wms_org_ids()));
drop policy if exists "wms_floor_state write" on public.wms_floor_state;
create policy "wms_floor_state write" on public.wms_floor_state
  for all to authenticated
  using (organization_id in (select public.wms_org_ids()))
  with check (organization_id in (select public.wms_org_ids()));

-- Pickers/receivers/shippers pueden mutar HU; el ledger sigue insert-only.
drop policy if exists "wms_handling_units write" on public.wms_handling_units;
create policy "wms_handling_units write" on public.wms_handling_units
  for all to authenticated
  using (
    public.wms_has('wms.inventory.adjust', organization_id)
    or public.wms_has('wms.pick.confirm', organization_id)
    or public.wms_has('wms.receiving.confirm', organization_id)
    or public.wms_has('wms.ship.dispatch', organization_id)
  )
  with check (
    public.wms_has('wms.inventory.adjust', organization_id)
    or public.wms_has('wms.pick.confirm', organization_id)
    or public.wms_has('wms.receiving.confirm', organization_id)
    or public.wms_has('wms.ship.dispatch', organization_id)
  );

drop policy if exists "wms_inventory_balances write" on public.wms_inventory_balances;
create policy "wms_inventory_balances write" on public.wms_inventory_balances
  for all to authenticated
  using (
    public.wms_has('wms.inventory.adjust', organization_id)
    or public.wms_has('wms.pick.confirm', organization_id)
    or public.wms_has('wms.receiving.confirm', organization_id)
    or public.wms_has('wms.ship.dispatch', organization_id)
  )
  with check (
    public.wms_has('wms.inventory.adjust', organization_id)
    or public.wms_has('wms.pick.confirm', organization_id)
    or public.wms_has('wms.receiving.confirm', organization_id)
    or public.wms_has('wms.ship.dispatch', organization_id)
  );

-- Quién puede mutar stock (y por tanto upsert de catálogo mínimo en el RPC).
create or replace function public.wms_has_stock_write(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.wms_has('wms.inventory.adjust', p_org)
      or public.wms_has('wms.pick.confirm', p_org)
      or public.wms_has('wms.receiving.confirm', p_org)
      or public.wms_has('wms.ship.dispatch', p_org)
      or public.wms_has('wms.warehouse.write', p_org)
      or public.wms_has('wms.catalog.write', p_org);
$$;

-- Rol en wms_user_roles implica acceso al org (además de membership).
create or replace function public.wms_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.wms_organization_members
  where user_id = auth.uid()
    and status = 'active'
  union
  select organization_id
  from public.wms_user_roles
  where user_id = auth.uid();
$$;

create or replace function public.wms_has(p_permission text, p_org uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wms_user_roles ur
    join public.wms_role_permissions rp on rp.role_code = ur.role_code
    where ur.user_id = auth.uid()
      and rp.permission_code = p_permission
      and (p_org is null or ur.organization_id = p_org)
  );
$$;

drop policy if exists "wms warehouses write" on public.wms_warehouses;
create policy "wms warehouses write" on public.wms_warehouses
  for all to authenticated
  using (public.wms_has_stock_write(organization_id))
  with check (public.wms_has_stock_write(organization_id));

drop policy if exists "wms products write" on public.wms_products;
create policy "wms products write" on public.wms_products
  for all to authenticated
  using (public.wms_has_stock_write(organization_id))
  with check (public.wms_has_stock_write(organization_id));

drop policy if exists "wms uoms write" on public.wms_uoms;
create policy "wms uoms write" on public.wms_uoms
  for all to authenticated
  using (public.wms_has_stock_write(organization_id))
  with check (public.wms_has_stock_write(organization_id));

grant select, insert, update, delete on
  public.wms_floor_state,
  public.wms_handling_units,
  public.wms_inventory_balances,
  public.wms_inventory_transactions,
  public.wms_warehouses,
  public.wms_products,
  public.wms_uoms
to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.wms_has_stock_write(uuid) to authenticated;

create or replace function public.wms_save_floor(p_organization_id uuid, p_floor jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_organization_id not in (select public.wms_org_ids()) then
    raise exception 'wms_forbidden_org';
  end if;
  insert into public.wms_floor_state (organization_id, payload, updated_at, updated_by)
  values (p_organization_id, coalesce(p_floor, '{}'::jsonb), now(), auth.uid())
  on conflict (organization_id) do update
    set payload = excluded.payload,
        updated_at = now(),
        updated_by = auth.uid();
end;
$$;

create or replace function public.wms_commit_stock(
  p_organization_id uuid,
  p_ledger jsonb,
  p_pallets jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  tx jsonb;
  pal jsonb;
  v_warehouse uuid;
  v_product uuid;
  v_hu uuid;
  v_uom uuid;
  v_qty numeric;
  v_key text;
  v_code text;
  v_sku text;
  inserted int := 0;
  skipped int := 0;
begin
  if p_organization_id not in (select public.wms_org_ids()) then
    raise exception 'wms_forbidden_org';
  end if;

  select id into v_uom
  from public.wms_uoms
  where organization_id = p_organization_id and code = 'UNIT'
  limit 1;

  if v_uom is null then
    insert into public.wms_uoms (organization_id, code, label_es, label_en)
    values (p_organization_id, 'UNIT', 'Unidad', 'Unit')
    returning id into v_uom;
  end if;

  for pal in select value from jsonb_array_elements(coalesce(p_pallets, '[]'::jsonb))
  loop
    v_code := coalesce(nullif(pal->>'siteId', ''), 'DEFAULT');
    insert into public.wms_warehouses (id, organization_id, code, name)
    values (public.wms_stable_uuid(p_organization_id::text || ':wh:' || v_code), p_organization_id, v_code, v_code)
    on conflict (organization_id, code) do update set name = excluded.name
    returning id into v_warehouse;

    v_sku := coalesce(nullif(pal->>'skuId', ''), 'SKU');
    insert into public.wms_products (id, organization_id, sku, name, base_uom_id)
    values (
      public.wms_stable_uuid(p_organization_id::text || ':sku:' || v_sku),
      p_organization_id,
      v_sku,
      v_sku,
      v_uom
    )
    on conflict (organization_id, sku) do update set name = excluded.name
    returning id into v_product;

    v_hu := public.wms_stable_uuid(p_organization_id::text || ':hu:' || coalesce(pal->>'id', pal->>'sscc'));
    v_qty := coalesce((pal->>'qty')::numeric, 0);
    if v_qty < 0 then
      raise exception 'wms_negative_stock';
    end if;

    insert into public.wms_handling_units (
      id, organization_id, warehouse_id, product_id, sscc, qty_base, status,
      external_id, location_code, lot_code, sku_code, received_at
    )
    values (
      v_hu,
      p_organization_id,
      v_warehouse,
      v_product,
      coalesce(pal->>'sscc', '000000000000000000'),
      v_qty,
      coalesce(pal->>'status', 'en_ubicacion'),
      pal->>'id',
      pal->>'slotCode',
      pal->>'lot',
      pal->>'skuId',
      coalesce((pal->>'receivedAt')::timestamptz, now())
    )
    on conflict (id) do update
      set qty_base = excluded.qty_base,
          status = excluded.status,
          location_code = excluded.location_code,
          lot_code = excluded.lot_code,
          updated_at = now();

    insert into public.wms_inventory_balances (
      id, organization_id, warehouse_id, product_id, hu_id, on_hand, allocated, blocked, quarantined
    )
    values (
      public.wms_stable_uuid(p_organization_id::text || ':bal:' || coalesce(pal->>'id', v_hu::text)),
      p_organization_id,
      v_warehouse,
      v_product,
      v_hu,
      v_qty,
      coalesce((pal->>'allocated')::numeric, 0),
      coalesce((pal->>'blocked')::numeric, 0),
      coalesce((pal->>'quarantined')::numeric, 0)
    )
    on conflict (id) do update
      set on_hand = excluded.on_hand,
          allocated = excluded.allocated,
          blocked = excluded.blocked,
          quarantined = excluded.quarantined,
          updated_at = now();
  end loop;

  for tx in select value from jsonb_array_elements(coalesce(p_ledger, '[]'::jsonb))
  loop
    v_key := nullif(tx->>'idempotencyKey', '');
    if v_key is not null and exists (
      select 1 from public.wms_inventory_transactions
      where organization_id = p_organization_id and idempotency_key = v_key
    ) then
      skipped := skipped + 1;
      continue;
    end if;

    v_qty := coalesce((tx->>'qty')::numeric, 0);
    if v_qty <= 0 then
      skipped := skipped + 1;
      continue;
    end if;

    v_code := coalesce(nullif(tx->>'siteId', ''), 'DEFAULT');
    insert into public.wms_warehouses (id, organization_id, code, name)
    values (public.wms_stable_uuid(p_organization_id::text || ':wh:' || v_code), p_organization_id, v_code, v_code)
    on conflict (organization_id, code) do update set name = excluded.name
    returning id into v_warehouse;

    v_sku := coalesce(nullif(tx->>'skuId', ''), 'SKU');
    insert into public.wms_products (id, organization_id, sku, name, base_uom_id)
    values (
      public.wms_stable_uuid(p_organization_id::text || ':sku:' || v_sku),
      p_organization_id, v_sku, v_sku, v_uom
    )
    on conflict (organization_id, sku) do update set name = excluded.name
    returning id into v_product;

    insert into public.wms_inventory_transactions (
      organization_id, warehouse_id, type, product_id, hu_id, qty_base,
      reason, actor_id, correlation_id, idempotency_key, occurred_at
    )
    values (
      p_organization_id,
      v_warehouse,
      coalesce(tx->>'type', 'MOVE'),
      v_product,
      case when tx->>'palletId' is null then null
           else public.wms_stable_uuid(p_organization_id::text || ':hu:' || (tx->>'palletId')) end,
      v_qty,
      tx->>'note',
      auth.uid(),
      tx->>'correlationId',
      v_key,
      coalesce((tx->>'at')::timestamptz, now())
    );
    inserted := inserted + 1;
  end loop;

  return jsonb_build_object('inserted', inserted, 'skipped', skipped);
end;
$$;

grant execute on function public.wms_save_floor(uuid, jsonb) to authenticated;
grant execute on function public.wms_commit_stock(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.wms_stable_uuid(text) to authenticated;
grant execute on function public.wms_org_ids() to authenticated;
grant execute on function public.wms_has(text, uuid) to authenticated;
grant execute on function public.wms_is_org_admin(uuid) to authenticated;

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename like 'wms_%'
  loop
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;
