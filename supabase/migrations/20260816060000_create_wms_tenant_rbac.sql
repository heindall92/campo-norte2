-- Briefs 4–5. Multi-tenant + RBAC + ledger Postgres.
-- No se aplica en producción desde este repo. Idempotente.
-- Un solo tenant: org-camponorte. No se inserta una segunda empresa.
-- Las credenciales demo (sofia@ / norte2026) NO se siembran aquí.
-- Postgres es la fuente de verdad cuando esta migration esté aplicada
-- y VITE_RUNTIME_MODE=production. Demo sigue en localStorage.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Reloj
-- ---------------------------------------------------------------------------
create or replace function public.wms_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organización → almacenes → zonas → ubicaciones
-- ---------------------------------------------------------------------------
create table if not exists public.wms_organizations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  legal_name text not null,
  plan text not null default 'WMS OS',
  billing_currency text not null default 'EUR' check (billing_currency = 'EUR'),
  allow_negative_inventory boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id)
);

create table if not exists public.wms_warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  code text not null,
  name text not null,
  city text not null default '',
  region text not null default '',
  country text not null default 'ES',
  legacy_site_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  unique (organization_id, code)
);

create table if not exists public.wms_warehouse_zones (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.wms_warehouses (id) on delete cascade,
  code text not null,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, code)
);

create table if not exists public.wms_warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.wms_warehouses (id) on delete cascade,
  zone_id uuid not null references public.wms_warehouse_zones (id) on delete restrict,
  code text not null,
  aisle text not null default '',
  rack integer not null default 1 check (rack >= 1),
  level integer not null default 1 check (level >= 1),
  position integer not null default 1 check (position in (1, 2)),
  pick_face boolean not null default false,
  status text not null default 'libre',
  legacy_slot_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, code)
);

-- ---------------------------------------------------------------------------
-- Usuarios / roles / permisos
-- ---------------------------------------------------------------------------
create table if not exists public.wms_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in (
    'ADMIN','WAREHOUSE_MANAGER','SUPERVISOR','RECEIVING','PICKER','PACKER',
    'SHIPPER','FORKLIFT_OPERATOR','INVENTORY_CONTROLLER','AUDITOR','VIEWER'
  )),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wms_permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wms_role_permissions (
  role_id uuid not null references public.wms_roles (id) on delete cascade,
  permission_id uuid not null references public.wms_permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.wms_users (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  email text,
  display_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id)
);

create table if not exists public.wms_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wms_users (id) on delete cascade,
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  role_id uuid not null references public.wms_roles (id) on delete restrict,
  warehouse_id uuid references public.wms_warehouses (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (user_id, role_id, warehouse_id)
);

-- Fuente de verdad del snapshot cuando el modo es production.
create table if not exists public.wms_ledgers (
  organization_id uuid primary key references public.wms_organizations (id) on delete cascade,
  org_code text not null unique,
  revision integer not null default 0 check (revision >= 0),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id)
);

create index if not exists wms_warehouses_org_idx on public.wms_warehouses (organization_id);
create index if not exists wms_zones_wh_idx on public.wms_warehouse_zones (warehouse_id);
create index if not exists wms_locations_wh_code_idx on public.wms_warehouse_locations (warehouse_id, code);
create index if not exists wms_users_org_idx on public.wms_users (organization_id);
create index if not exists wms_user_roles_user_idx on public.wms_user_roles (user_id);
create index if not exists wms_user_roles_org_idx on public.wms_user_roles (organization_id, role_id);
create index if not exists wms_ledgers_org_code_idx on public.wms_ledgers (org_code);

drop trigger if exists wms_organizations_touch on public.wms_organizations;
create trigger wms_organizations_touch before update on public.wms_organizations
  for each row execute function public.wms_touch_updated_at();
drop trigger if exists wms_warehouses_touch on public.wms_warehouses;
create trigger wms_warehouses_touch before update on public.wms_warehouses
  for each row execute function public.wms_touch_updated_at();
drop trigger if exists wms_zones_touch on public.wms_warehouse_zones;
create trigger wms_zones_touch before update on public.wms_warehouse_zones
  for each row execute function public.wms_touch_updated_at();
drop trigger if exists wms_locations_touch on public.wms_warehouse_locations;
create trigger wms_locations_touch before update on public.wms_warehouse_locations
  for each row execute function public.wms_touch_updated_at();
drop trigger if exists wms_users_touch on public.wms_users;
create trigger wms_users_touch before update on public.wms_users
  for each row execute function public.wms_touch_updated_at();
drop trigger if exists wms_ledgers_touch on public.wms_ledgers;
create trigger wms_ledgers_touch before update on public.wms_ledgers
  for each row execute function public.wms_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Semilla: un org, dos hubs, zonas, catálogo RBAC. Sin usuarios ni passwords.
-- ---------------------------------------------------------------------------
insert into public.wms_organizations (id, code, legal_name, plan, billing_currency, allow_negative_inventory)
values (
  '018f0000-0000-7000-8000-000000000001',
  'org-camponorte',
  'Campo Norte Logística, S.L.',
  'WMS OS · multi-hub',
  'EUR',
  false
)
on conflict (code) do update set legal_name = excluded.legal_name;

insert into public.wms_warehouses (id, organization_id, code, name, city, region, country, legacy_site_id)
values
  (
    '018f0000-0000-7000-8000-000000000011',
    '018f0000-0000-7000-8000-000000000001',
    'CN-SEV-01',
    'Hub Campo Norte Sevilla',
    'Sevilla',
    'Andalucía',
    'ES',
    'site-sev'
  ),
  (
    '018f0000-0000-7000-8000-000000000012',
    '018f0000-0000-7000-8000-000000000001',
    'CN-HUE-02',
    'Cámara fría Huelva',
    'Huelva',
    'Andalucía',
    'ES',
    'site-hue'
  )
on conflict (organization_id, code) do update set name = excluded.name, legacy_site_id = excluded.legacy_site_id;

insert into public.wms_warehouse_zones (warehouse_id, code, name)
select w.id, z.code, z.name
from public.wms_warehouses w
join (
  values
    ('seco', 'Seco'),
    ('fresco', 'Fresco'),
    ('congelado', 'Congelado'),
    ('picking', 'Picking'),
    ('muelle', 'Muelle'),
    ('crossdock', 'Cross-dock')
) as z(code, name) on true
where w.organization_id = '018f0000-0000-7000-8000-000000000001'
on conflict (warehouse_id, code) do nothing;

insert into public.wms_roles (id, code, name) values
  ('018f0000-0000-7000-8000-000000000101', 'ADMIN', 'Administrador'),
  ('018f0000-0000-7000-8000-000000000102', 'WAREHOUSE_MANAGER', 'Jefe de almacén'),
  ('018f0000-0000-7000-8000-000000000103', 'SUPERVISOR', 'Supervisor'),
  ('018f0000-0000-7000-8000-000000000104', 'RECEIVING', 'Recepción'),
  ('018f0000-0000-7000-8000-000000000105', 'PICKER', 'Picker'),
  ('018f0000-0000-7000-8000-000000000106', 'PACKER', 'Packer'),
  ('018f0000-0000-7000-8000-000000000107', 'SHIPPER', 'Expedición'),
  ('018f0000-0000-7000-8000-000000000108', 'FORKLIFT_OPERATOR', 'Carretillero'),
  ('018f0000-0000-7000-8000-000000000109', 'INVENTORY_CONTROLLER', 'Inventario'),
  ('018f0000-0000-7000-8000-000000000110', 'AUDITOR', 'Auditor'),
  ('018f0000-0000-7000-8000-000000000111', 'VIEWER', 'Consulta')
on conflict (code) do update set name = excluded.name;

insert into public.wms_permissions (id, code, name) values
  ('018f0000-0000-7000-8000-000000000201', 'stock.read', 'Leer stock'),
  ('018f0000-0000-7000-8000-000000000202', 'stock.write', 'Escribir stock'),
  ('018f0000-0000-7000-8000-000000000203', 'wave.assign', 'Asignar ola'),
  ('018f0000-0000-7000-8000-000000000204', 'pick', 'Picar'),
  ('018f0000-0000-7000-8000-000000000205', 'pack', 'Embalar'),
  ('018f0000-0000-7000-8000-000000000206', 'ship', 'Expedir'),
  ('018f0000-0000-7000-8000-000000000207', 'receive', 'Recibir'),
  ('018f0000-0000-7000-8000-000000000208', 'putaway', 'Ubicar'),
  ('018f0000-0000-7000-8000-000000000209', 'replenish', 'Reponer'),
  ('018f0000-0000-7000-8000-000000000210', 'count', 'Contar'),
  ('018f0000-0000-7000-8000-000000000211', 'adjust', 'Ajustar'),
  ('018f0000-0000-7000-8000-000000000212', 'audit.read', 'Leer auditoría'),
  ('018f0000-0000-7000-8000-000000000213', 'copilot.recommend', 'Copilot recomendar'),
  ('018f0000-0000-7000-8000-000000000214', 'copilot.execute', 'Copilot ejecutar'),
  ('018f0000-0000-7000-8000-000000000215', 'org.admin', 'Administrar org'),
  ('018f0000-0000-7000-8000-000000000216', 'warehouse.manage', 'Gestionar almacén')
on conflict (code) do update set name = excluded.name;

-- Matriz rol × permiso (misma que src/lib/wms/rbac.ts).
insert into public.wms_role_permissions (role_id, permission_id)
select r.id, p.id
from public.wms_roles r
join public.wms_permissions p on
  (r.code = 'ADMIN')
  or (r.code = 'WAREHOUSE_MANAGER' and p.code <> 'org.admin')
  or (r.code = 'SUPERVISOR' and p.code in (
    'stock.read','stock.write','wave.assign','pick','pack','ship','receive',
    'putaway','replenish','count','audit.read','copilot.recommend','warehouse.manage'
  ))
  or (r.code = 'RECEIVING' and p.code in ('stock.read','stock.write','receive','putaway'))
  or (r.code = 'PICKER' and p.code in ('stock.read','stock.write','pick'))
  or (r.code = 'PACKER' and p.code in ('stock.read','pack'))
  or (r.code = 'SHIPPER' and p.code in ('stock.read','pack','ship'))
  or (r.code = 'FORKLIFT_OPERATOR' and p.code in ('stock.read','stock.write','putaway','replenish'))
  or (r.code = 'INVENTORY_CONTROLLER' and p.code in ('stock.read','stock.write','count','adjust','audit.read'))
  or (r.code = 'AUDITOR' and p.code in ('stock.read','audit.read'))
  or (r.code = 'VIEWER' and p.code in ('stock.read','audit.read','copilot.recommend'))
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS: el frontend no basta. El permiso se chequea en Postgres.
-- ---------------------------------------------------------------------------
create or replace function public.wms_has_permission(
  p_org uuid,
  p_warehouse uuid,
  p_perm text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wms_user_roles ur
    join public.wms_role_permissions rp on rp.role_id = ur.role_id
    join public.wms_permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and ur.organization_id = p_org
      and p.code = p_perm
      and (ur.warehouse_id is null or ur.warehouse_id = p_warehouse)
  )
  or public.mps_is_admin();
$$;

create or replace function public.wms_is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wms_users u
    where u.id = auth.uid() and u.organization_id = p_org and u.active
  )
  or public.mps_is_team();
$$;

alter table public.wms_organizations enable row level security;
alter table public.wms_warehouses enable row level security;
alter table public.wms_warehouse_zones enable row level security;
alter table public.wms_warehouse_locations enable row level security;
alter table public.wms_roles enable row level security;
alter table public.wms_permissions enable row level security;
alter table public.wms_role_permissions enable row level security;
alter table public.wms_users enable row level security;
alter table public.wms_user_roles enable row level security;
alter table public.wms_ledgers enable row level security;

drop policy if exists wms_organizations_select on public.wms_organizations;
create policy wms_organizations_select on public.wms_organizations
  for select using (public.wms_is_org_member(id) or public.mps_is_team());

drop policy if exists wms_warehouses_select on public.wms_warehouses;
create policy wms_warehouses_select on public.wms_warehouses
  for select using (public.wms_is_org_member(organization_id));

drop policy if exists wms_zones_select on public.wms_warehouse_zones;
create policy wms_zones_select on public.wms_warehouse_zones
  for select using (
    exists (
      select 1 from public.wms_warehouses w
      where w.id = warehouse_id and public.wms_is_org_member(w.organization_id)
    )
  );

drop policy if exists wms_locations_select on public.wms_warehouse_locations;
create policy wms_locations_select on public.wms_warehouse_locations
  for select using (
    exists (
      select 1 from public.wms_warehouses w
      where w.id = warehouse_id and public.wms_is_org_member(w.organization_id)
    )
  );

drop policy if exists wms_roles_select on public.wms_roles;
create policy wms_roles_select on public.wms_roles for select using (public.mps_is_team());
drop policy if exists wms_permissions_select on public.wms_permissions;
create policy wms_permissions_select on public.wms_permissions for select using (public.mps_is_team());
drop policy if exists wms_role_permissions_select on public.wms_role_permissions;
create policy wms_role_permissions_select on public.wms_role_permissions for select using (public.mps_is_team());

drop policy if exists wms_users_select on public.wms_users;
create policy wms_users_select on public.wms_users
  for select using (id = auth.uid() or public.wms_is_org_member(organization_id));

drop policy if exists wms_user_roles_select on public.wms_user_roles;
create policy wms_user_roles_select on public.wms_user_roles
  for select using (user_id = auth.uid() or public.wms_is_org_member(organization_id));

drop policy if exists wms_user_roles_write on public.wms_user_roles;
create policy wms_user_roles_write on public.wms_user_roles
  for insert with check (public.wms_has_permission(organization_id, warehouse_id, 'org.admin'));

drop policy if exists wms_ledgers_select on public.wms_ledgers;
create policy wms_ledgers_select on public.wms_ledgers
  for select using (public.wms_is_org_member(organization_id));

drop policy if exists wms_ledgers_insert on public.wms_ledgers;
create policy wms_ledgers_insert on public.wms_ledgers
  for insert with check (public.wms_has_permission(organization_id, null, 'stock.write'));

drop policy if exists wms_ledgers_update on public.wms_ledgers;
create policy wms_ledgers_update on public.wms_ledgers
  for update
  using (public.wms_has_permission(organization_id, null, 'stock.write'))
  with check (public.wms_has_permission(organization_id, null, 'stock.write'));

-- Lock optimista: una transacción, una revisión.
create or replace function public.save_wms_ledger(
  p_org_code text,
  p_expected integer,
  p_payload jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
  n integer;
  next_rev integer;
begin
  select id into org from public.wms_organizations where code = p_org_code;
  if org is null then
    raise exception 'org_missing';
  end if;
  if not public.wms_has_permission(org, null, 'stock.write') then
    raise exception 'forbidden';
  end if;

  insert into public.wms_ledgers (organization_id, org_code, revision, payload, created_by, updated_by)
  values (org, p_org_code, 0, p_payload, auth.uid(), auth.uid())
  on conflict (organization_id) do nothing;

  update public.wms_ledgers
  set
    payload = p_payload,
    revision = revision + 1,
    updated_by = auth.uid()
  where organization_id = org and revision = p_expected;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'revision_conflict';
  end if;

  select revision into next_rev from public.wms_ledgers where organization_id = org;
  return next_rev;
end;
$$;

comment on table public.wms_organizations is
  'Tenant WMS. Un solo org sembrado: org-camponorte.';
comment on table public.wms_user_roles is
  'RBAC real. warehouse_id null = todos los almacenes del org.';
comment on table public.wms_ledgers is
  'Fuente de verdad del snapshot en producción. Lock por revision.';
comment on function public.save_wms_ledger is
  'Única vía de escritura del ledger: chequeo RBAC + transacción + revisión.';

-- Storage: etiquetas / adjuntos de ASN. Privado. Sin secretos.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'wms-docs',
      'wms-docs',
      false,
      5242880,
      array['application/pdf', 'image/png', 'image/jpeg']
    )
    on conflict (id) do nothing;
  end if;
exception when others then
  null;
end $$;

-- Realtime: la torre escucha revisión del ledger. Solo si aporta valor.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.wms_ledgers';
  end if;
exception when duplicate_object then
  null;
when others then
  null;
end $$;
