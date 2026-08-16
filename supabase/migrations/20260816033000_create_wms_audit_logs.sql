-- Brief 28. audit_logs — append-only.
-- No se aplica en producción desde este repo. Idempotente.
-- La UI no tiene DELETE. Esta tabla tampoco concede delete a roles de app.

create table if not exists public.wms_audit_logs (
  id text primary key,
  actor_id text,
  organization_id text not null,
  warehouse_id text,
  action text not null,
  entity text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  timestamp timestamptz not null default now(),
  reason text not null default '',
  device_id text,
  correlation_id text not null
);

create index if not exists wms_audit_logs_org_ts_idx
  on public.wms_audit_logs (organization_id, timestamp desc);

create index if not exists wms_audit_logs_entity_idx
  on public.wms_audit_logs (entity, entity_id);

create index if not exists wms_audit_logs_correlation_idx
  on public.wms_audit_logs (correlation_id);

alter table public.wms_audit_logs enable row level security;

drop policy if exists wms_audit_logs_select on public.wms_audit_logs;
create policy wms_audit_logs_select
  on public.wms_audit_logs
  for select
  using (public.mps_is_team());

drop policy if exists wms_audit_logs_insert on public.wms_audit_logs;
create policy wms_audit_logs_insert
  on public.wms_audit_logs
  for insert
  with check (public.mps_is_team());

-- Sin policy de update/delete: nadie borra auditoría desde la app.
comment on table public.wms_audit_logs is
  'WMS audit trail. Append-only. Never delete from UI.';
