-- Campo Norte Growth OS — Data Hub + Auth (Postgres / Supabase)
-- Ejecutar en el SQL Editor de Supabase

create table if not exists public.mps_hub_meta (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.mps_leads (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.mps_clients (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.mps_reservations (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.mps_invoices (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Perfiles del equipo. IMPORTANTE: el rol por defecto es 'pending' (sin acceso).
-- Un alta nueva en Supabase Auth NO concede acceso a los datos: un admin
-- tiene que promover el rol explícitamente. Antes el default era 'ops', lo que
-- convertía cualquier registro en miembro del equipo con acceso total.
create table if not exists public.mps_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'pending'
    check (role in ('pending', 'admin', 'ops', 'booking', 'guide')),
  updated_at timestamptz not null default now()
);

-- Migración desde el esquema anterior (default 'ops' y sin check).
alter table public.mps_profiles alter column role set default 'pending';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mps_profiles_role_check'
  ) then
    alter table public.mps_profiles
      add constraint mps_profiles_role_check
      check (role in ('pending', 'admin', 'ops', 'booking', 'guide'));
  end if;
end $$;

create index if not exists mps_leads_origin_idx
  on public.mps_leads ((payload->>'origin'));
create index if not exists mps_leads_email_idx
  on public.mps_leads ((payload->>'email'));
create index if not exists mps_clients_email_idx
  on public.mps_clients ((payload->>'email'));
create index if not exists mps_clients_segment_idx
  on public.mps_clients ((payload->>'segment'));
create index if not exists mps_reservations_status_idx
  on public.mps_reservations ((payload->>'status'));

alter table public.mps_hub_meta enable row level security;
alter table public.mps_leads enable row level security;
alter table public.mps_clients enable row level security;
alter table public.mps_reservations enable row level security;
alter table public.mps_invoices enable row level security;
alter table public.mps_profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Funciones de rol
--
-- SECURITY DEFINER a propósito: leen mps_profiles saltándose la RLS del que
-- llama. Sin eso, una política sobre mps_profiles que consultase mps_profiles
-- entraría en recursión infinita.
-- ---------------------------------------------------------------------------

create or replace function public.mps_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.mps_profiles where id = auth.uid()),
    'pending'
  );
$$;

/** Miembro del equipo con acceso concedido (rol distinto de 'pending'). */
create or replace function public.mps_is_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mps_role() in ('admin', 'ops', 'booking', 'guide');
$$;

/** Puede crear y modificar registros operativos. El guía solo lee. */
create or replace function public.mps_can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mps_role() in ('admin', 'ops', 'booking');
$$;

/** Solo admin: borrado y datos financieros. */
create or replace function public.mps_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mps_role() = 'admin';
$$;

/** Acceso a facturación: admin y booking. Ops y guías no ven importes. */
create or replace function public.mps_can_bill()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mps_role() in ('admin', 'booking');
$$;

-- ---------------------------------------------------------------------------
-- Políticas RLS
--
-- ANTES: `for all to authenticated using (true)` — cualquier usuario
-- autenticado del proyecto leía y escribía la base de clientes completa.
-- Combinado con el alta abierta de Supabase, eso permitía a un tercero
-- registrarse y descargarse leads, clientes, reservas y facturas.
--
-- AHORA: lectura solo para equipo con rol asignado; escritura por rol;
-- borrado solo admin; facturación segregada.
-- ---------------------------------------------------------------------------

drop policy if exists "mps hub meta all" on public.mps_hub_meta;
drop policy if exists "mps hub meta auth" on public.mps_hub_meta;
create policy "mps hub meta read" on public.mps_hub_meta
  for select to authenticated using (public.mps_is_team());
create policy "mps hub meta write" on public.mps_hub_meta
  for insert to authenticated with check (public.mps_can_write());
create policy "mps hub meta update" on public.mps_hub_meta
  for update to authenticated using (public.mps_can_write()) with check (public.mps_can_write());
create policy "mps hub meta delete" on public.mps_hub_meta
  for delete to authenticated using (public.mps_is_admin());

drop policy if exists "mps leads all" on public.mps_leads;
drop policy if exists "mps leads auth" on public.mps_leads;
create policy "mps leads read" on public.mps_leads
  for select to authenticated using (public.mps_is_team());
create policy "mps leads write" on public.mps_leads
  for insert to authenticated with check (public.mps_can_write());
create policy "mps leads update" on public.mps_leads
  for update to authenticated using (public.mps_can_write()) with check (public.mps_can_write());
create policy "mps leads delete" on public.mps_leads
  for delete to authenticated using (public.mps_is_admin());

drop policy if exists "mps clients all" on public.mps_clients;
drop policy if exists "mps clients auth" on public.mps_clients;
create policy "mps clients read" on public.mps_clients
  for select to authenticated using (public.mps_is_team());
create policy "mps clients write" on public.mps_clients
  for insert to authenticated with check (public.mps_can_write());
create policy "mps clients update" on public.mps_clients
  for update to authenticated using (public.mps_can_write()) with check (public.mps_can_write());
create policy "mps clients delete" on public.mps_clients
  for delete to authenticated using (public.mps_is_admin());

drop policy if exists "mps reservations all" on public.mps_reservations;
drop policy if exists "mps reservations auth" on public.mps_reservations;
create policy "mps reservations read" on public.mps_reservations
  for select to authenticated using (public.mps_is_team());
create policy "mps reservations write" on public.mps_reservations
  for insert to authenticated with check (public.mps_can_write());
create policy "mps reservations update" on public.mps_reservations
  for update to authenticated using (public.mps_can_write()) with check (public.mps_can_write());
create policy "mps reservations delete" on public.mps_reservations
  for delete to authenticated using (public.mps_is_admin());

-- Facturación: segregada. Un guía no tiene por qué ver importes ni DNIs.
drop policy if exists "mps invoices all" on public.mps_invoices;
drop policy if exists "mps invoices auth" on public.mps_invoices;
create policy "mps invoices read" on public.mps_invoices
  for select to authenticated using (public.mps_can_bill());
create policy "mps invoices write" on public.mps_invoices
  for insert to authenticated with check (public.mps_can_bill());
create policy "mps invoices update" on public.mps_invoices
  for update to authenticated using (public.mps_can_bill()) with check (public.mps_can_bill());
create policy "mps invoices delete" on public.mps_invoices
  for delete to authenticated using (public.mps_is_admin());

-- Perfiles: el equipo se ve entre sí (directorio de usuarios del CRM);
-- cada uno edita solo su nombre; los roles los cambia únicamente un admin.
drop policy if exists "mps profiles self" on public.mps_profiles;
drop policy if exists "mps profiles upsert self" on public.mps_profiles;

create policy "mps profiles read team" on public.mps_profiles
  for select to authenticated
  using (auth.uid() = id or public.mps_is_team());

create policy "mps profiles insert self" on public.mps_profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy "mps profiles update self" on public.mps_profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "mps profiles admin manage" on public.mps_profiles
  for update to authenticated
  using (public.mps_is_admin())
  with check (public.mps_is_admin());

-- La RLS decide QUÉ filas se tocan, pero no QUÉ columnas. Para que nadie pueda
-- ascenderse a sí mismo editando su propio perfil, el cambio de `role` se
-- bloquea en un trigger salvo que quien lo hace sea admin.
create or replace function public.mps_guard_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() es NULL en el SQL Editor y con la service_role key: son
  -- contextos de administración de confianza y ahí sí se permite (es como se
  -- promueve al primer admin, cuando todavía no existe ninguno).
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.mps_is_admin() then
    raise exception 'Solo un administrador puede cambiar el rol de un usuario';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mps_profiles_guard_role on public.mps_profiles;
create trigger mps_profiles_guard_role
  before update on public.mps_profiles
  for each row execute function public.mps_guard_role_change();

create policy "mps profiles admin delete" on public.mps_profiles
  for delete to authenticated
  using (public.mps_is_admin());

-- ESCALADA DE PRIVILEGIOS CORREGIDA:
-- la versión anterior hacía `coalesce(new.raw_user_meta_data->>'role', 'ops')`.
-- raw_user_meta_data lo controla el cliente en el propio signUp, así que
-- bastaba con registrarse enviando { role: 'admin' } para nacer como admin.
-- Ahora el rol de alta es siempre 'pending' y solo un admin lo promueve.
create or replace function public.mps_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mps_profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'pending'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- PUESTA EN MARCHA (una sola vez, desde el SQL Editor de Supabase)
--
-- 1) Desactiva el alta pública:
--      Dashboard → Authentication → Providers → Email → "Allow new users to
--      sign up" = OFF. El equipo se crea a mano por invitación.
--
-- 2) Promueve al primer administrador (sin esto nadie ve nada):
--      update public.mps_profiles set role = 'admin' where email = 'sofia@camponorte.demo';
--
-- 3) Asigna el resto de roles:
--      update public.mps_profiles set role = 'booking' where email = 'marta@camponorte.demo';
--      update public.mps_profiles set role = 'ops'     where email = 'luis@camponorte.demo';
--      update public.mps_profiles set role = 'guide'   where email = 'jorge@camponorte.demo';
--
-- 4) Comprueba que no queda nadie colgado con acceso:
--      select email, role from public.mps_profiles order by role;
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.mps_handle_new_user();

-- ---------------------------------------------------------------------------
-- Libro de resultados y bitácora de ejecuciones
--
-- Estas dos tablas son las que convierten el CRM en un sistema que se puede
-- auditar y cobrar por resultado:
--
--   mps_lead_outcomes → qué pasó de verdad con cada lead. Sin esta columna no
--     se puede medir si el scoring acierta ni decir "de 40 leads, 5 reservaron".
--   mps_run_log       → qué ha ejecutado el sistema y cuándo. Es la prueba de
--     vida: si la ingesta lleva 24 h muda, aquí se ve.
--
-- Las escriben las funciones de servidor con la service role key (que se salta
-- la RLS a propósito). El equipo solo lee.
-- ---------------------------------------------------------------------------

create table if not exists public.mps_lead_outcomes (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  outcome text not null
    check (outcome in ('reservado', 'perdido', 'sin_respuesta', 'descartado')),
  reservation_id text,
  amount numeric,
  note text,
  decided_by text,
  created_at timestamptz not null default now()
);

create index if not exists mps_lead_outcomes_lead_idx
  on public.mps_lead_outcomes (lead_id);
create index if not exists mps_lead_outcomes_created_idx
  on public.mps_lead_outcomes (created_at desc);

create table if not exists public.mps_run_log (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  status text not null check (status in ('ok', 'warn', 'error')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mps_run_log_job_idx
  on public.mps_run_log (job, created_at desc);

alter table public.mps_lead_outcomes enable row level security;
alter table public.mps_run_log enable row level security;

drop policy if exists "mps lead outcomes read" on public.mps_lead_outcomes;
create policy "mps lead outcomes read" on public.mps_lead_outcomes
  for select to authenticated using (public.mps_is_team());
drop policy if exists "mps lead outcomes write" on public.mps_lead_outcomes;
create policy "mps lead outcomes write" on public.mps_lead_outcomes
  for insert to authenticated with check (public.mps_can_write());

-- La bitácora es solo de lectura para el equipo: la escribe el servidor.
drop policy if exists "mps run log read" on public.mps_run_log;
create policy "mps run log read" on public.mps_run_log
  for select to authenticated using (public.mps_is_team());

-- ---------------------------------------------------------------------------
-- Analítica propia de accesos (alternativa gratis a Vercel Analytics)
--
-- Quién entró, a qué hora, desde qué IP real (cabecera de Vercel) y si abrió
-- la propuesta / el producto. La escribe solo el servidor con service_role.
-- ---------------------------------------------------------------------------

create table if not exists public.mps_access_log (
  id uuid primary key default gen_random_uuid(),
  event text not null
    check (event in ('login', 'view_proposal', 'view_product', 'session')),
  email text not null,
  name text not null default '',
  user_id text not null default '',
  provider text not null default 'unknown',
  section text,
  ip text not null default 'unknown',
  user_agent text not null default '',
  org_tag text not null default 'Externo',
  created_at timestamptz not null default now()
);

create index if not exists mps_access_log_created_idx
  on public.mps_access_log (created_at desc);
create index if not exists mps_access_log_email_idx
  on public.mps_access_log (email, created_at desc);
create index if not exists mps_access_log_event_idx
  on public.mps_access_log (event, created_at desc);

alter table public.mps_access_log enable row level security;

drop policy if exists "mps access log read" on public.mps_access_log;
create policy "mps access log read" on public.mps_access_log
  for select to authenticated using (public.mps_is_team());
-- Sin políticas de insert/update para authenticated: solo service_role.
