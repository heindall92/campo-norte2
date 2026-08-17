-- Pedidos, ASN, olas y huecos salen del jsonb del floor a tablas relacionales.
-- Stock sigue en HU + ledger. El floor jsonb queda para flota/operarios/layout.

alter table public.wms_orders
  add column if not exists external_id text,
  add column if not exists pallets_count integer not null default 0,
  add column if not exists lines_count integer not null default 0,
  add column if not exists dock_window_start timestamptz,
  add column if not exists dock_window_end timestamptz;

alter table public.wms_asn
  add column if not exists external_id text,
  add column if not exists pallets_expected integer not null default 0,
  add column if not exists pallets_done integer not null default 0,
  add column if not exists lines_count integer not null default 0;

alter table public.wms_waves
  add column if not exists external_id text,
  add column if not exists operator_code text,
  add column if not exists fleet_code text,
  add column if not exists printed_at timestamptz;

alter table public.wms_pick_tasks
  add column if not exists external_id text,
  add column if not exists slot_code text,
  add column if not exists pallet_external_id text;

alter table public.wms_order_lines
  add column if not exists external_id text;

alter table public.wms_asn_lines
  add column if not exists external_id text;

create unique index if not exists wms_orders_external_idx
  on public.wms_orders (organization_id, external_id)
  where external_id is not null;
create unique index if not exists wms_asn_external_idx
  on public.wms_asn (organization_id, external_id)
  where external_id is not null;
create unique index if not exists wms_waves_external_idx
  on public.wms_waves (organization_id, external_id)
  where external_id is not null;
create unique index if not exists wms_waves_code_idx
  on public.wms_waves (organization_id, code);
create unique index if not exists wms_pick_tasks_external_idx
  on public.wms_pick_tasks (organization_id, external_id)
  where external_id is not null;
create unique index if not exists wms_order_lines_external_idx
  on public.wms_order_lines (organization_id, external_id)
  where external_id is not null;
create unique index if not exists wms_asn_lines_external_idx
  on public.wms_asn_lines (organization_id, external_id)
  where external_id is not null;

create or replace function public.wms_ensure_sku(p_org uuid, p_sku text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_uom uuid;
  v_sku text := coalesce(nullif(p_sku, ''), 'SKU');
begin
  select id into v_id
  from public.wms_products
  where organization_id = p_org and sku = v_sku;
  if v_id is not null then
    return v_id;
  end if;

  select id into v_uom
  from public.wms_uoms
  where organization_id = p_org and code = 'UNIT'
  limit 1;
  if v_uom is null then
    insert into public.wms_uoms (organization_id, code, label_es, label_en)
    values (p_org, 'UNIT', 'Unidad', 'Unit')
    returning id into v_uom;
  end if;

  insert into public.wms_products (id, organization_id, sku, name, base_uom_id)
  values (public.wms_stable_uuid(p_org::text || ':sku:' || v_sku), p_org, v_sku, v_sku, v_uom)
  on conflict (organization_id, sku) do update set sku = excluded.sku
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.wms_ensure_warehouse(p_org uuid, p_code text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_code text := coalesce(nullif(p_code, ''), 'DEFAULT');
begin
  select id into v_id
  from public.wms_warehouses
  where organization_id = p_org and code = v_code;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.wms_warehouses (id, organization_id, code, name)
  values (public.wms_stable_uuid(p_org::text || ':wh:' || v_code), p_org, v_code, v_code)
  on conflict (organization_id, code) do update set code = excluded.code
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.wms_save_fulfillment(p_organization_id uuid, p_payload jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  rec jsonb;
  v_wh uuid;
  v_prod uuid;
  v_cust uuid;
  v_sup uuid;
  v_car uuid;
  v_ord uuid;
  v_asn uuid;
  v_wave uuid;
  v_zone uuid;
  v_loc uuid;
  v_hu uuid;
  v_code text;
  v_kind text;
begin
  if p_organization_id not in (select public.wms_org_ids()) then
    raise exception 'wms_forbidden_org';
  end if;

  for rec in select value from jsonb_array_elements(coalesce(p_payload->'carriers', '[]'::jsonb))
  loop
    v_code := coalesce(nullif(rec->>'code', ''), rec->>'id');
    if v_code is null then continue; end if;
    insert into public.wms_carriers (id, organization_id, code, name, kind, cutoff_default, active)
    values (
      public.wms_stable_uuid(p_organization_id::text || ':car:' || v_code),
      p_organization_id,
      v_code,
      coalesce(nullif(rec->>'name', ''), v_code),
      case when rec->>'kind' in ('nacional', 'internacional', 'frigorifico', 'paqueteria')
        then rec->>'kind' else 'nacional' end,
      rec->>'cutoffDefault',
      coalesce((rec->>'active')::boolean, true)
    )
    on conflict (organization_id, code) do update
      set name = excluded.name,
          kind = excluded.kind,
          active = excluded.active;
  end loop;

  for rec in select value from jsonb_array_elements(coalesce(p_payload->'orders', '[]'::jsonb))
  loop
    v_code := rec->>'code';
    if v_code is null then continue; end if;
    v_wh := public.wms_ensure_warehouse(p_organization_id, rec->>'siteId');

    insert into public.wms_customers (id, organization_id, code, name)
    values (
      public.wms_stable_uuid(p_organization_id::text || ':cust:' || coalesce(rec->>'customer', v_code)),
      p_organization_id,
      left(coalesce(rec->>'customer', v_code), 80),
      coalesce(rec->>'customer', v_code)
    )
    on conflict (organization_id, code) do update set name = excluded.name
    returning id into v_cust;

    v_car := null;
    if rec->>'carrierId' is not null then
      select id into v_car
      from public.wms_carriers
      where organization_id = p_organization_id and code = rec->>'carrierId';
    end if;

    insert into public.wms_orders (
      id, organization_id, warehouse_id, customer_id, code, status, priority,
      cut_off, dock_code, carrier_id, tracking, external_id,
      pallets_count, lines_count, dock_window_start, dock_window_end, updated_at
    )
    values (
      public.wms_stable_uuid(p_organization_id::text || ':ord:' || coalesce(rec->>'id', v_code)),
      p_organization_id,
      v_wh,
      v_cust,
      v_code,
      case when rec->>'status' in ('pendiente', 'picking', 'embalaje', 'muelle', 'expedido')
        then rec->>'status' else 'pendiente' end,
      case when rec->>'priority' in ('normal', 'urgente', 'express')
        then rec->>'priority' else 'normal' end,
      nullif(rec->>'cutOff', '')::timestamptz,
      rec->>'dock',
      v_car,
      rec->>'tracking',
      rec->>'id',
      coalesce((rec->>'pallets')::int, 0),
      coalesce((rec->>'lines')::int, 0),
      nullif(rec->>'dockWindowStart', '')::timestamptz,
      nullif(rec->>'dockWindowEnd', '')::timestamptz,
      now()
    )
    on conflict (organization_id, code) do update
      set status = excluded.status,
          priority = excluded.priority,
          cut_off = excluded.cut_off,
          dock_code = excluded.dock_code,
          carrier_id = excluded.carrier_id,
          tracking = excluded.tracking,
          external_id = coalesce(excluded.external_id, public.wms_orders.external_id),
          pallets_count = excluded.pallets_count,
          lines_count = excluded.lines_count,
          dock_window_start = excluded.dock_window_start,
          dock_window_end = excluded.dock_window_end,
          customer_id = excluded.customer_id,
          warehouse_id = excluded.warehouse_id,
          updated_at = now();
  end loop;

  for rec in select value from jsonb_array_elements(coalesce(p_payload->'orderLines', '[]'::jsonb))
  loop
    if rec->>'id' is null then continue; end if;
    select id into v_ord
    from public.wms_orders
    where organization_id = p_organization_id
      and (external_id = rec->>'orderId' or code = rec->>'orderId')
    limit 1;
    if v_ord is null then continue; end if;
    v_prod := public.wms_ensure_sku(p_organization_id, rec->>'skuId');
    insert into public.wms_order_lines (
      id, organization_id, order_id, product_id, qty_ordered, qty_allocated, qty_picked, qty_shipped, external_id
    )
    values (
      public.wms_stable_uuid(p_organization_id::text || ':ol:' || (rec->>'id')),
      p_organization_id,
      v_ord,
      v_prod,
      greatest(coalesce((rec->>'qtyOrdered')::numeric, 1), 0.000001),
      coalesce((rec->>'qtyAllocated')::numeric, 0),
      coalesce((rec->>'qtyPicked')::numeric, 0),
      coalesce((rec->>'qtyShipped')::numeric, 0),
      rec->>'id'
    )
    on conflict (id) do update
      set qty_ordered = excluded.qty_ordered,
          qty_allocated = excluded.qty_allocated,
          qty_picked = excluded.qty_picked,
          qty_shipped = excluded.qty_shipped;
  end loop;

  for rec in select value from jsonb_array_elements(coalesce(p_payload->'asns', '[]'::jsonb))
  loop
    v_code := rec->>'code';
    if v_code is null then continue; end if;
    v_wh := public.wms_ensure_warehouse(p_organization_id, rec->>'siteId');
    insert into public.wms_suppliers (id, organization_id, code, name)
    values (
      public.wms_stable_uuid(p_organization_id::text || ':sup:' || coalesce(rec->>'supplier', v_code)),
      p_organization_id,
      left(coalesce(rec->>'supplier', v_code), 80),
      coalesce(rec->>'supplier', v_code)
    )
    on conflict (organization_id, code) do update set name = excluded.name
    returning id into v_sup;

    insert into public.wms_asn (
      id, organization_id, warehouse_id, supplier_id, code, status, eta, dock_code,
      external_id, pallets_expected, pallets_done, lines_count, updated_at
    )
    values (
      public.wms_stable_uuid(p_organization_id::text || ':asn:' || coalesce(rec->>'id', v_code)),
      p_organization_id,
      v_wh,
      v_sup,
      v_code,
      case when rec->>'status' in ('previsto', 'en_muelle', 'descargando', 'ubicando', 'cerrado')
        then rec->>'status' else 'previsto' end,
      nullif(rec->>'eta', '')::timestamptz,
      rec->>'dock',
      rec->>'id',
      coalesce((rec->>'palletsExpected')::int, 0),
      coalesce((rec->>'palletsDone')::int, 0),
      coalesce((rec->>'lines')::int, 0),
      now()
    )
    on conflict (organization_id, code) do update
      set status = excluded.status,
          eta = excluded.eta,
          dock_code = excluded.dock_code,
          supplier_id = excluded.supplier_id,
          warehouse_id = excluded.warehouse_id,
          external_id = coalesce(excluded.external_id, public.wms_asn.external_id),
          pallets_expected = excluded.pallets_expected,
          pallets_done = excluded.pallets_done,
          lines_count = excluded.lines_count,
          updated_at = now();
  end loop;

  for rec in select value from jsonb_array_elements(coalesce(p_payload->'asnLines', '[]'::jsonb))
  loop
    if rec->>'id' is null then continue; end if;
    select id into v_asn
    from public.wms_asn
    where organization_id = p_organization_id
      and (external_id = rec->>'asnId' or code = rec->>'asnId')
    limit 1;
    if v_asn is null then continue; end if;
    v_prod := public.wms_ensure_sku(p_organization_id, rec->>'skuId');
    insert into public.wms_asn_lines (
      id, organization_id, asn_id, product_id, qty_expected, qty_received, lot_expected, external_id
    )
    values (
      public.wms_stable_uuid(p_organization_id::text || ':al:' || (rec->>'id')),
      p_organization_id,
      v_asn,
      v_prod,
      greatest(coalesce((rec->>'qtyExpected')::numeric, 1), 0.000001),
      coalesce((rec->>'qtyReceived')::numeric, 0),
      rec->>'lotExpected',
      rec->>'id'
    )
    on conflict (id) do update
      set qty_expected = excluded.qty_expected,
          qty_received = excluded.qty_received,
          lot_expected = excluded.lot_expected;
  end loop;

  for rec in select value from jsonb_array_elements(coalesce(p_payload->'waves', '[]'::jsonb))
  loop
    v_code := rec->>'code';
    if v_code is null then continue; end if;
    v_wh := public.wms_ensure_warehouse(p_organization_id, rec->>'siteId');
    insert into public.wms_waves (
      id, organization_id, warehouse_id, code, kind, status, aisle,
      external_id, operator_code, fleet_code, printed_at
    )
    values (
      public.wms_stable_uuid(p_organization_id::text || ':wave:' || coalesce(rec->>'id', v_code)),
      p_organization_id,
      v_wh,
      v_code,
      case when rec->>'kind' in ('picking', 'reposicion') then rec->>'kind' else 'picking' end,
      case when rec->>'status' in ('abierta', 'en_curso', 'cerrada') then rec->>'status' else 'abierta' end,
      rec->>'aisle',
      rec->>'id',
      rec->>'operatorId',
      rec->>'fleetId',
      nullif(rec->>'printedAt', '')::timestamptz
    )
    on conflict (organization_id, code) do update
      set kind = excluded.kind,
          status = excluded.status,
          aisle = excluded.aisle,
          warehouse_id = excluded.warehouse_id,
          external_id = coalesce(excluded.external_id, public.wms_waves.external_id),
          operator_code = excluded.operator_code,
          fleet_code = excluded.fleet_code,
          printed_at = excluded.printed_at;
  end loop;

  delete from public.wms_pick_tasks
  where organization_id = p_organization_id;

  for rec in select value from jsonb_array_elements(coalesce(p_payload->'pickTasks', '[]'::jsonb))
  loop
    if rec->>'id' is null then continue; end if;
    select id into v_wave
    from public.wms_waves
    where organization_id = p_organization_id
      and (external_id = rec->>'waveId' or code = rec->>'waveId')
    limit 1;
    if v_wave is null then continue; end if;
    v_prod := public.wms_ensure_sku(p_organization_id, rec->>'skuId');
    v_hu := null;
    if rec->>'palletId' is not null then
      select id into v_hu
      from public.wms_handling_units
      where organization_id = p_organization_id and external_id = rec->>'palletId'
      limit 1;
    end if;
    v_loc := null;
    if rec->>'slotCode' is not null then
      select l.id into v_loc
      from public.wms_warehouse_locations l
      join public.wms_waves w on w.id = v_wave
      where l.organization_id = p_organization_id
        and l.warehouse_id = w.warehouse_id
        and l.code = rec->>'slotCode'
      limit 1;
    end if;
    insert into public.wms_pick_tasks (
      id, organization_id, wave_id, order_code, product_id, location_id, hu_id,
      qty, qty_picked, qty_packed, status, sequence,
      external_id, slot_code, pallet_external_id
    )
    values (
      public.wms_stable_uuid(p_organization_id::text || ':pt:' || (rec->>'id')),
      p_organization_id,
      v_wave,
      rec->>'orderCode',
      v_prod,
      v_loc,
      v_hu,
      coalesce((rec->>'qty')::numeric, 0),
      coalesce((rec->>'qtyPicked')::numeric, 0),
      coalesce((rec->>'qtyPacked')::numeric, 0),
      case when rec->>'status' in ('pendiente', 'en_curso', 'picada', 'faltante', 'omitida')
        then rec->>'status' else 'pendiente' end,
      coalesce((rec->>'sequence')::int, 1),
      rec->>'id',
      rec->>'slotCode',
      rec->>'palletId'
    );
  end loop;

  for rec in select value from jsonb_array_elements(coalesce(p_payload->'slots', '[]'::jsonb))
  loop
    if rec->>'code' is null then continue; end if;
    v_wh := public.wms_ensure_warehouse(p_organization_id, rec->>'siteId');
    v_kind := case
      when rec->>'zone' in ('seco', 'fresco', 'congelado', 'picking', 'muelle', 'crossdock', 'yard')
        then rec->>'zone'
      else 'seco'
    end;
    insert into public.wms_warehouse_zones (id, organization_id, warehouse_id, code, kind, aisle)
    values (
      public.wms_stable_uuid(p_organization_id::text || ':zone:' || (rec->>'siteId') || ':' || v_kind),
      p_organization_id,
      v_wh,
      v_kind,
      v_kind,
      rec->>'aisle'
    )
    on conflict (warehouse_id, code) do update set kind = excluded.kind
    returning id into v_zone;

    insert into public.wms_warehouse_locations (
      id, organization_id, warehouse_id, zone_id, code, aisle, bay, level, position,
      pick_face, status, capacity_pallets, updated_at
    )
    values (
      public.wms_stable_uuid(p_organization_id::text || ':loc:' || (rec->>'siteId') || ':' || (rec->>'code')),
      p_organization_id,
      v_wh,
      v_zone,
      rec->>'code',
      coalesce(rec->>'aisle', '?'),
      coalesce((rec->>'rack')::int, 1),
      coalesce((rec->>'level')::int, 1),
      case when coalesce((rec->>'position')::int, 1) in (1, 2) then (rec->>'position')::int else 1 end,
      coalesce((rec->>'pickFace')::boolean, false),
      case when rec->>'status' in ('libre', 'ocupado', 'reservado', 'bloqueado', 'inventario')
        then rec->>'status' else 'libre' end,
      coalesce((rec->>'capacityPallets')::int, 1),
      now()
    )
    on conflict (warehouse_id, code) do update
      set aisle = excluded.aisle,
          bay = excluded.bay,
          level = excluded.level,
          position = excluded.position,
          pick_face = excluded.pick_face,
          status = excluded.status,
          capacity_pallets = excluded.capacity_pallets,
          zone_id = excluded.zone_id,
          updated_at = now();
  end loop;
end;
$$;

create or replace function public.wms_load_fulfillment(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_organization_id not in (select public.wms_org_ids()) then
    raise exception 'wms_forbidden_org';
  end if;
  return jsonb_build_object(
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', coalesce(o.external_id, o.code),
        'code', o.code,
        'customer', coalesce(c.name, o.code),
        'cutOff', o.cut_off,
        'dock', o.dock_code,
        'status', o.status,
        'priority', o.priority,
        'siteId', w.code,
        'carrierId', car.code,
        'tracking', o.tracking,
        'pallets', o.pallets_count,
        'lines', o.lines_count,
        'dockWindowStart', o.dock_window_start,
        'dockWindowEnd', o.dock_window_end
      ) order by o.created_at desc)
      from public.wms_orders o
      join public.wms_warehouses w on w.id = o.warehouse_id
      left join public.wms_customers c on c.id = o.customer_id
      left join public.wms_carriers car on car.id = o.carrier_id
      where o.organization_id = p_organization_id
    ), '[]'::jsonb),
    'orderLines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', coalesce(l.external_id, l.id::text),
        'orderId', coalesce(o.external_id, o.code),
        'skuId', p.sku,
        'qtyOrdered', l.qty_ordered,
        'qtyAllocated', l.qty_allocated,
        'qtyPicked', l.qty_picked,
        'qtyShipped', l.qty_shipped
      ))
      from public.wms_order_lines l
      join public.wms_orders o on o.id = l.order_id
      join public.wms_products p on p.id = l.product_id
      where l.organization_id = p_organization_id
    ), '[]'::jsonb),
    'asns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', coalesce(a.external_id, a.code),
        'code', a.code,
        'supplier', coalesce(s.name, a.code),
        'eta', a.eta,
        'dock', a.dock_code,
        'status', a.status,
        'lines', a.lines_count,
        'palletsExpected', a.pallets_expected,
        'palletsDone', a.pallets_done,
        'siteId', w.code
      ) order by a.created_at)
      from public.wms_asn a
      join public.wms_warehouses w on w.id = a.warehouse_id
      left join public.wms_suppliers s on s.id = a.supplier_id
      where a.organization_id = p_organization_id
    ), '[]'::jsonb),
    'asnLines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', coalesce(l.external_id, l.id::text),
        'asnId', coalesce(a.external_id, a.code),
        'skuId', p.sku,
        'qtyExpected', l.qty_expected,
        'qtyReceived', l.qty_received,
        'lotExpected', l.lot_expected
      ))
      from public.wms_asn_lines l
      join public.wms_asn a on a.id = l.asn_id
      join public.wms_products p on p.id = l.product_id
      where l.organization_id = p_organization_id
    ), '[]'::jsonb),
    'waves', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', coalesce(v.external_id, v.code),
        'code', v.code,
        'aisle', v.aisle,
        'siteId', w.code,
        'kind', v.kind,
        'status', v.status,
        'operatorId', v.operator_code,
        'fleetId', v.fleet_code,
        'printedAt', v.printed_at
      ) order by v.created_at)
      from public.wms_waves v
      join public.wms_warehouses w on w.id = v.warehouse_id
      where v.organization_id = p_organization_id
    ), '[]'::jsonb),
    'pickTasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', coalesce(t.external_id, t.id::text),
        'waveId', coalesce(v.external_id, v.code),
        'orderCode', t.order_code,
        'skuId', p.sku,
        'qty', t.qty,
        'qtyPicked', t.qty_picked,
        'qtyPacked', t.qty_packed,
        'slotCode', t.slot_code,
        'palletId', t.pallet_external_id,
        'status', t.status,
        'sequence', t.sequence
      ) order by t.sequence)
      from public.wms_pick_tasks t
      join public.wms_waves v on v.id = t.wave_id
      join public.wms_products p on p.id = t.product_id
      where t.organization_id = p_organization_id
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', l.code,
        'siteId', w.code,
        'zone', z.kind,
        'aisle', l.aisle,
        'rack', l.bay,
        'level', l.level,
        'position', l.position,
        'pickFace', l.pick_face,
        'status', l.status,
        'capacityPallets', l.capacity_pallets
      ))
      from public.wms_warehouse_locations l
      join public.wms_warehouses w on w.id = l.warehouse_id
      join public.wms_warehouse_zones z on z.id = l.zone_id
      where l.organization_id = p_organization_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.wms_ensure_sku(uuid, text) from public, anon;
revoke all on function public.wms_ensure_warehouse(uuid, text) from public, anon;
revoke all on function public.wms_save_fulfillment(uuid, jsonb) from public, anon;
revoke all on function public.wms_load_fulfillment(uuid) from public, anon;

grant execute on function public.wms_ensure_sku(uuid, text) to authenticated;
grant execute on function public.wms_ensure_warehouse(uuid, text) to authenticated;
grant execute on function public.wms_save_fulfillment(uuid, jsonb) to authenticated;
grant execute on function public.wms_load_fulfillment(uuid) to authenticated;
