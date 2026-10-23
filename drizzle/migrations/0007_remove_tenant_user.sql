create or replace function public.remove_tenant_user(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare t uuid := public.get_user_tenant_id(auth.uid());
begin
  if auth.uid() is null or not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'owner')) then
    raise exception 'Only admins can remove users';
  end if;
  if p_user_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  if public.is_tenant_owner(p_user_id, t) then raise exception 'The business owner cannot be removed'; end if;
  delete from user_branches where user_id = p_user_id;
  delete from user_roles where user_id = p_user_id;
  delete from tenant_users where user_id = p_user_id and tenant_id = t;
end $$;
revoke all on function public.remove_tenant_user(uuid) from public, anon;
grant execute on function public.remove_tenant_user(uuid) to authenticated;