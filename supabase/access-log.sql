-- Analítica propia de accesos (alternativa gratis a Vercel Analytics)
-- Ejecutar UNA vez en el SQL Editor de Supabase del proyecto demo Campo Norte.

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
-- Inserts solo con SUPABASE_SERVICE_ROLE_KEY (API /api/auth/access-log).
