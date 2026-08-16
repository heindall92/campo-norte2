-- Phase 8–11: dock/yard, returns/quality, RF outbox, audit.

create table if not exists public.wms_docks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete cascade,
  code text not null,
  kind text not null default 'inout' check (kind in ('in', 'out', 'inout')),
  created_at timestamptz not null default now(),
  constraint wms_docks_code_unique unique (warehouse_id, code)
);

create table if not exists public.wms_dock_appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  dock_id uuid references public.wms_docks (id),
  warehouse_id uuid not null references public.wms_warehouses (id) on delete restrict,
  dock_code text not null,
  kind text not null check (kind in ('inbound', 'outbound')),
  order_id uuid,
  asn_id uuid,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'booked'
    check (status in ('booked', 'arrived', 'loading', 'done', 'no_show')),
  created_at timestamptz not null default now(),
  constraint wms_dock_window check (end_at > start_at)
);

create table if not exists public.wms_yard_visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete restrict,
  plate text not null,
  dock_code text,
  status text not null default 'in_yard' check (status in ('in_yard', 'at_dock', 'departed')),
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz
);

create table if not exists public.wms_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  warehouse_id uuid not null references public.wms_warehouses (id) on delete restrict,
  code text not null,
  customer_name text,
  product_id uuid references public.wms_products (id),
  qty numeric(18, 6) not null,
  status text not null default 'requested'
    check (status in ('requested', 'received', 'inspecting', 'restock', 'quarantine', 'scrap')),
  hu_id uuid references public.wms_handling_units (id),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.wms_quality_holds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  hu_id uuid not null references public.wms_handling_units (id) on delete restrict,
  reason text not null,
  held_at timestamptz not null default now(),
  released_at timestamptz
);

create table if not exists public.wms_rf_commands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  idempotency_key text not null,
  task_id text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'flushed', 'conflict')),
  conflict_reason text,
  queued_at timestamptz not null default now(),
  flushed_at timestamptz,
  constraint wms_rf_commands_idem unique (organization_id, idempotency_key)
);

create table if not exists public.wms_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete restrict,
  actor_id uuid references auth.users (id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  correlation_id text,
  before_json jsonb,
  after_json jsonb,
  at timestamptz not null default now()
);

create table if not exists public.wms_ai_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wms_organizations (id) on delete cascade,
  finding text not null,
  evidence jsonb not null default '[]'::jsonb,
  confidence numeric,
  recommendation text,
  optional_action text,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'wms_docks','wms_dock_appointments','wms_yard_visits','wms_returns',
    'wms_quality_holds','wms_rf_commands','wms_audit_logs','wms_ai_findings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ' read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id in (select public.wms_org_ids()))',
      t || ' read', t
    );
    if t <> 'wms_audit_logs' then
      execute format('drop policy if exists %I on public.%I', t || ' write', t);
      execute format(
        'create policy %I on public.%I for all to authenticated using (organization_id in (select public.wms_org_ids())) with check (organization_id in (select public.wms_org_ids()))',
        t || ' write', t
      );
    end if;
  end loop;
end $$;

-- Audit append-only: insert + select, nunca update/delete por RLS.
drop policy if exists "wms_audit_logs insert" on public.wms_audit_logs;
create policy "wms_audit_logs insert" on public.wms_audit_logs
  for insert to authenticated
  with check (organization_id in (select public.wms_org_ids()));
