-- El ledger no puede insertar hu_id antes de que exista la HU.
-- auth.uid() nulo (SQL de consola / migraciones) no debe bloquear el commit.

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
  if auth.uid() is not null and p_organization_id not in (select public.wms_org_ids()) then
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
    on conflict (organization_id, code) do update set name = public.wms_warehouses.name
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
          sku_code = excluded.sku_code,
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

    v_hu := case
      when nullif(tx->>'palletId', '') is null then null
      else public.wms_stable_uuid(p_organization_id::text || ':hu:' || (tx->>'palletId'))
    end;
    if v_hu is not null and not exists (
      select 1
      from public.wms_handling_units hu
      where hu.id = v_hu and hu.organization_id = p_organization_id
    ) then
      skipped := skipped + 1;
      continue;
    end if;

    v_code := coalesce(nullif(tx->>'siteId', ''), 'DEFAULT');
    insert into public.wms_warehouses (id, organization_id, code, name)
    values (public.wms_stable_uuid(p_organization_id::text || ':wh:' || v_code), p_organization_id, v_code, v_code)
    on conflict (organization_id, code) do update set name = public.wms_warehouses.name
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
      v_hu,
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

grant execute on function public.wms_commit_stock(uuid, jsonb, jsonb) to authenticated;
revoke all on function public.wms_commit_stock(uuid, jsonb, jsonb) from public, anon;
