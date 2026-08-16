-- Alta pública cerrada: solo emails invitados pueden nacer en auth.users.
-- Crear un operario: insertar aquí el email y luego el usuario Auth.

create table if not exists public.wms_allowed_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.wms_allowed_emails enable row level security;
revoke all on public.wms_allowed_emails from public, anon, authenticated;

insert into public.wms_allowed_emails (email)
values (lower('yoandy@campo-norte.es'))
on conflict (email) do nothing;

create or replace function public.wms_guard_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null
     or not exists (
       select 1 from public.wms_allowed_emails
       where email = lower(new.email)
     ) then
    raise exception 'signup_disabled';
  end if;
  return new;
end;
$$;

revoke all on function public.wms_guard_signup() from public, anon, authenticated;

drop trigger if exists wms_guard_signup on auth.users;
create trigger wms_guard_signup
  before insert on auth.users
  for each row execute function public.wms_guard_signup();

-- Centros reales (código = id del snapshot para que el RPC de stock coincida).
insert into public.wms_warehouses (id, organization_id, code, name, city, region, country, sqm, timezone, status)
values
  (
    public.wms_stable_uuid('c0a1e000-0001-4000-8000-000000000001:wh:site-sev'),
    'c0a1e000-0001-4000-8000-000000000001',
    'site-sev',
    'Hub Campo Norte Sevilla',
    'Sevilla',
    'Andalucía',
    'ES',
    42000,
    'Europe/Madrid',
    'active'
  ),
  (
    public.wms_stable_uuid('c0a1e000-0001-4000-8000-000000000001:wh:site-hue'),
    'c0a1e000-0001-4000-8000-000000000001',
    'site-hue',
    'Cámara fría Huelva',
    'Huelva',
    'Andalucía',
    'ES',
    18500,
    'Europe/Madrid',
    'active'
  )
on conflict (organization_id, code) do update
  set name = excluded.name,
      city = excluded.city,
      region = excluded.region,
      sqm = excluded.sqm;
