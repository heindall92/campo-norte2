-- Harden WMS helpers: search_path fijo + anon no puede llamar DEFINER por RPC.

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

create or replace function public.wms_stable_uuid(p_text text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select (
    substr(md5(p_text), 1, 8) || '-' ||
    substr(md5(p_text), 9, 4) || '-' ||
    '4' || substr(md5(p_text), 13, 3) || '-' ||
    '8' || substr(md5(p_text), 17, 3) || '-' ||
    substr(md5(p_text), 21, 12)
  )::uuid;
$$;

revoke all on function public.wms_guard_user_role_write() from public, anon;
revoke all on function public.wms_has(text, uuid) from public, anon;
revoke all on function public.wms_has_stock_write(uuid) from public, anon;
revoke all on function public.wms_is_org_admin(uuid) from public, anon;
revoke all on function public.wms_org_ids() from public, anon;
revoke all on function public.wms_stable_uuid(text) from public, anon;
revoke all on function public.wms_save_floor(uuid, jsonb) from public, anon;
revoke all on function public.wms_commit_stock(uuid, jsonb, jsonb) from public, anon;

grant execute on function public.wms_has(text, uuid) to authenticated;
grant execute on function public.wms_has_stock_write(uuid) to authenticated;
grant execute on function public.wms_is_org_admin(uuid) to authenticated;
grant execute on function public.wms_org_ids() to authenticated;
grant execute on function public.wms_stable_uuid(text) to authenticated;
grant execute on function public.wms_guard_user_role_write() to authenticated;
grant execute on function public.wms_save_floor(uuid, jsonb) to authenticated;
grant execute on function public.wms_commit_stock(uuid, jsonb, jsonb) to authenticated;
