-- Phase 1: multi-tenant WMS + RBAC.
-- No toca tablas de inventario. El Hub CRM (mps_*) permanece.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

create table if not exists public.wms_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  slug text not null,
  billing_currency text not null default 'EUR',
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wms_organizations_slug_key unique (slug)
);

drop trigger if exists wms_organizations_updated_at on public.wms_organizations;
create trigger wms_organizations_updated_at
  before update on public.wms_organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------

create table if not exists public.wms_organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wms_organization_members_unique unique (organization_id, user_id)
);

create index if not exists wms_org_members_user_idx
  on public.wms_organization_members (user_id);

drop trigger if exists wms_organization_members_updated_at on public.wms_organization_members;
create trigger wms_organization_members_updated_at
  before update on public.wms_organization_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Roles & permissions
-- ---------------------------------------------------------------------------

create table if not exists public.wms_roles (
  code text primary key
    check (code in (
      'ADMIN',
      'WAREHOUSE_MANAGER',
      'SUPERVISOR',
      'RECEIVING',
      'PICKER',
      'PACKER',
      'SHIPPER',
      'FORKLIFT_OPERATOR',
      'INVENTORY_CONTROLLER',
      'AUDITOR',
      'VIEWER'
    )),
  label_es text not null,
  label_en text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wms_permissions (
  code text primary key,
  label_es text not null,
  label_en text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wms_role_permissions (
  role_code text not null references public.wms_roles (code) on delete cascade,
  permission_code text not null references public.wms_permissions (code) on delete cascade,
  primary key (role_code, permission_code)
);

create table if not exists public.wms_user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_code text not null references public.wms_roles (code),
  warehouse_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint wms_user_roles_unique unique (organization_id, user_id, role_code, warehouse_id)
);

create unique index if not exists wms_user_roles_org_user_role_wh_idx
  on public.wms_user_roles (
    organization_id,
    user_id,
    role_code,
    coalesce(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists wms_user_roles_user_idx
  on public.wms_user_roles (user_id, organization_id);

drop trigger if exists wms_user_roles_updated_at on public.wms_user_roles;
create trigger wms_user_roles_updated_at
  before update on public.wms_user_roles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed catalog (idempotent)
-- ---------------------------------------------------------------------------

insert into public.wms_roles (code, label_es, label_en) values
  ('ADMIN', 'Administrador', 'Administrator'),
  ('WAREHOUSE_MANAGER', 'Jefe de almacén', 'Warehouse manager'),
  ('SUPERVISOR', 'Supervisor', 'Supervisor'),
  ('RECEIVING', 'Recepción', 'Receiving'),
  ('PICKER', 'Picker', 'Picker'),
  ('PACKER', 'Embalador', 'Packer'),
  ('SHIPPER', 'Expedición', 'Shipper'),
  ('FORKLIFT_OPERATOR', 'Carretillero', 'Forklift operator'),
  ('INVENTORY_CONTROLLER', 'Control de inventario', 'Inventory controller'),
  ('AUDITOR', 'Auditor', 'Auditor'),
  ('VIEWER', 'Consulta', 'Viewer')
on conflict (code) do update
  set label_es = excluded.label_es,
      label_en = excluded.label_en;

insert into public.wms_permissions (code, label_es, label_en) values
  ('wms.tower.read', 'Ver torre de control', 'View control tower'),
  ('wms.warehouse.read', 'Ver centros y huecos', 'View warehouses and slots'),
  ('wms.warehouse.write', 'Alta de centros', 'Create warehouses'),
  ('wms.inventory.read', 'Ver stock y palets', 'View stock and pallets'),
  ('wms.inventory.adjust', 'Ajustar inventario / conteo', 'Adjust inventory / cycle count'),
  ('wms.catalog.write', 'Editar catálogo SKU', 'Edit SKU catalog'),
  ('wms.pick.confirm', 'Picar / RF / movimientos', 'Pick / RF / moves'),
  ('wms.receiving.confirm', 'Recepcionar ASN', 'Receive ASN'),
  ('wms.ship.dispatch', 'Embalar y expedir', 'Pack and ship'),
  ('wms.workforce.read', 'Ver operarios y flota', 'View operators and fleet'),
  ('wms.workforce.write', 'Editar operarios y flota', 'Edit operators and fleet'),
  ('wms.billing.read', 'Ver costes WMS', 'View WMS costs'),
  ('wms.audit.read', 'Ver auditoría', 'View audit'),
  ('wms.settings.admin', 'Administrar tenant y roles', 'Manage tenant and roles')
on conflict (code) do update
  set label_es = excluded.label_es,
      label_en = excluded.label_en;

-- Full grant helper
insert into public.wms_role_permissions (role_code, permission_code)
select r.code, p.code
from public.wms_roles r
cross join public.wms_permissions p
where r.code in ('ADMIN', 'WAREHOUSE_MANAGER')
on conflict do nothing;

insert into public.wms_role_permissions (role_code, permission_code)
select 'SUPERVISOR', code from public.wms_permissions
where code in (
  'wms.tower.read', 'wms.warehouse.read', 'wms.inventory.read',
  'wms.pick.confirm', 'wms.receiving.confirm', 'wms.ship.dispatch',
  'wms.workforce.read', 'wms.billing.read'
)
on conflict do nothing;

insert into public.wms_role_permissions (role_code, permission_code)
select 'RECEIVING', code from public.wms_permissions
where code in ('wms.tower.read', 'wms.warehouse.read', 'wms.inventory.read', 'wms.receiving.confirm')
on conflict do nothing;

insert into public.wms_role_permissions (role_code, permission_code)
select 'PICKER', code from public.wms_permissions
where code in ('wms.tower.read', 'wms.warehouse.read', 'wms.inventory.read', 'wms.pick.confirm')
on conflict do nothing;

insert into public.wms_role_permissions (role_code, permission_code)
select 'PACKER', code from public.wms_permissions
where code in ('wms.tower.read', 'wms.inventory.read', 'wms.ship.dispatch')
on conflict do nothing;

insert into public.wms_role_permissions (role_code, permission_code)
select 'SHIPPER', code from public.wms_permissions
where code in ('wms.tower.read', 'wms.inventory.read', 'wms.ship.dispatch', 'wms.warehouse.read')
on conflict do nothing;

insert into public.wms_role_permissions (role_code, permission_code)
select 'FORKLIFT_OPERATOR', code from public.wms_permissions
where code in ('wms.tower.read', 'wms.warehouse.read', 'wms.inventory.read', 'wms.pick.confirm', 'wms.receiving.confirm', 'wms.workforce.read')
on conflict do nothing;

insert into public.wms_role_permissions (role_code, permission_code)
select 'INVENTORY_CONTROLLER', code from public.wms_permissions
where code in ('wms.tower.read', 'wms.warehouse.read', 'wms.inventory.read', 'wms.inventory.adjust', 'wms.catalog.write')
on conflict do nothing;

insert into public.wms_role_permissions (role_code, permission_code)
select 'AUDITOR', code from public.wms_permissions
where code in (
  'wms.tower.read', 'wms.warehouse.read', 'wms.inventory.read',
  'wms.workforce.read', 'wms.billing.read', 'wms.audit.read'
)
on conflict do nothing;

insert into public.wms_role_permissions (role_code, permission_code)
select 'VIEWER', code from public.wms_permissions
where code in ('wms.tower.read', 'wms.warehouse.read', 'wms.inventory.read', 'wms.billing.read')
on conflict do nothing;

-- Demo org (fixed uuid). No users until Auth invites exist.
insert into public.wms_organizations (id, name, legal_name, slug, billing_currency, status)
values (
  'c0a1e000-0001-4000-8000-000000000001',
  'Campo Norte',
  'Campo Norte Logística, S.L.',
  'campo-norte',
  'EUR',
  'active'
)
on conflict (id) do update
  set name = excluded.name,
      legal_name = excluded.legal_name,
      slug = excluded.slug;

-- ---------------------------------------------------------------------------
-- RLS helpers (SECURITY DEFINER, sin recursión)
-- ---------------------------------------------------------------------------

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
    and status = 'active';
$$;

create or replace function public.wms_is_org_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wms_user_roles
    where user_id = auth.uid()
      and organization_id = p_org
      and role_code = 'ADMIN'
  );
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
    join public.wms_organization_members m
      on m.user_id = ur.user_id
     and m.organization_id = ur.organization_id
     and m.status = 'active'
    where ur.user_id = auth.uid()
      and rp.permission_code = p_permission
      and (p_org is null or ur.organization_id = p_org)
  );
$$;

-- Impide auto-promoción: solo un ADMIN de esa org cambia wms_user_roles ajenos.
create or replace function public.wms_guard_user_role_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  org := coalesce(new.organization_id, old.organization_id);
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if not public.wms_is_org_admin(org) then
    raise exception 'Solo un ADMIN de la organización puede asignar roles WMS';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists wms_user_roles_guard on public.wms_user_roles;
create trigger wms_user_roles_guard
  before insert or update or delete on public.wms_user_roles
  for each row execute function public.wms_guard_user_role_write();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.wms_organizations enable row level security;
alter table public.wms_organization_members enable row level security;
alter table public.wms_roles enable row level security;
alter table public.wms_permissions enable row level security;
alter table public.wms_role_permissions enable row level security;
alter table public.wms_user_roles enable row level security;

drop policy if exists "wms orgs read" on public.wms_organizations;
create policy "wms orgs read" on public.wms_organizations
  for select to authenticated
  using (id in (select public.wms_org_ids()));

drop policy if exists "wms orgs admin write" on public.wms_organizations;
create policy "wms orgs admin write" on public.wms_organizations
  for update to authenticated
  using (public.wms_is_org_admin(id))
  with check (public.wms_is_org_admin(id));

drop policy if exists "wms members read" on public.wms_organization_members;
create policy "wms members read" on public.wms_organization_members
  for select to authenticated
  using (organization_id in (select public.wms_org_ids()));

drop policy if exists "wms members admin write" on public.wms_organization_members;
create policy "wms members admin write" on public.wms_organization_members
  for all to authenticated
  using (public.wms_is_org_admin(organization_id))
  with check (public.wms_is_org_admin(organization_id));

drop policy if exists "wms roles read" on public.wms_roles;
create policy "wms roles read" on public.wms_roles
  for select to authenticated
  using (true);

drop policy if exists "wms permissions read" on public.wms_permissions;
create policy "wms permissions read" on public.wms_permissions
  for select to authenticated
  using (true);

drop policy if exists "wms role perms read" on public.wms_role_permissions;
create policy "wms role perms read" on public.wms_role_permissions
  for select to authenticated
  using (true);

drop policy if exists "wms user roles read" on public.wms_user_roles;
create policy "wms user roles read" on public.wms_user_roles
  for select to authenticated
  using (organization_id in (select public.wms_org_ids()));

drop policy if exists "wms user roles admin write" on public.wms_user_roles;
create policy "wms user roles admin write" on public.wms_user_roles
  for all to authenticated
  using (public.wms_is_org_admin(organization_id))
  with check (public.wms_is_org_admin(organization_id));
