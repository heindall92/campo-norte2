-- Brief 35. Aislamiento tenant + almacén.
-- No se aplica en producción desde este repo. Idempotente.
-- Un solo tenant real: org-camponorte. No se inserta una segunda empresa.
-- Las credenciales demo (sofia@ / norte2026) NO se siembran aquí.

create table if not exists public.wms_site_members (
  org_id text not null,
  warehouse_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'ops', 'booking', 'guide')),
  primary key (org_id, warehouse_id, user_id)
);

create index if not exists wms_site_members_user_idx
  on public.wms_site_members (user_id);

alter table public.wms_site_members enable row level security;

create or replace function public.wms_can_access_warehouse(p_org text, p_wh text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mps_is_team()
     and (
       public.mps_is_admin()
       or exists (
         select 1
         from public.wms_site_members m
         where m.org_id = p_org
           and m.warehouse_id = p_wh
           and m.user_id = auth.uid()
       )
     );
$$;

drop policy if exists wms_site_members_select on public.wms_site_members;
create policy wms_site_members_select
  on public.wms_site_members
  for select
  using (public.mps_is_team() and (public.mps_is_admin() or user_id = auth.uid()));

drop policy if exists wms_site_members_write on public.wms_site_members;
create policy wms_site_members_write
  on public.wms_site_members
  for insert
  with check (public.mps_is_admin());

-- Auditoría: el insert sigue siendo de equipo; delete no existe.
drop policy if exists wms_audit_logs_wh on public.wms_audit_logs;
create policy wms_audit_logs_wh
  on public.wms_audit_logs
  for select
  using (
    warehouse_id is null
    or public.wms_can_access_warehouse(organization_id, warehouse_id)
  );

comment on table public.wms_site_members is
  'WMS warehouse membership. Server-side RLS. Demo passwords must not be used in production.';
