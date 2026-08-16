-- anon no llama helpers DEFINER por RPC. Los triggers siguen disparándose como owner.

revoke all on function public.mps_role() from public, anon;
revoke all on function public.mps_is_team() from public, anon;
revoke all on function public.mps_can_write() from public, anon;
revoke all on function public.mps_is_admin() from public, anon;
revoke all on function public.mps_can_bill() from public, anon;
revoke all on function public.mps_guard_role_change() from public, anon, authenticated;
revoke all on function public.mps_handle_new_user() from public, anon, authenticated;
revoke all on function public.wms_guard_user_role_write() from public, anon, authenticated;

grant execute on function public.mps_role() to authenticated;
grant execute on function public.mps_is_team() to authenticated;
grant execute on function public.mps_can_write() to authenticated;
grant execute on function public.mps_is_admin() to authenticated;
grant execute on function public.mps_can_bill() to authenticated;
