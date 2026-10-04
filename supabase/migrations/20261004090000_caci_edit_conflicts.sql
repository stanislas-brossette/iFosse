begin;
-- Lock and compare the editor's original value before the existing audited write.
create function public.set_member_caci_if_current(p_member_id uuid,p_expiry_date date default null,p_expected_expiry_date date default null) returns void
language plpgsql security definer set search_path='' as $$
declare v_current date;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select caci_expiry_date into v_current from public.members where id=p_member_id for update;
  if not found then raise exception using errcode='22023',message='Adhérent introuvable.'; end if;
  if v_current is distinct from p_expected_expiry_date then
    raise exception using errcode='40001',message='CACI_EDIT_CONFLICT';
  end if;
  perform public.set_member_caci(p_member_id,p_expiry_date);
end;
$$;
revoke all on function public.set_member_caci_if_current(uuid,date,date) from public,anon,authenticated,service_role;
grant execute on function public.set_member_caci_if_current(uuid,date,date) to authenticated;
commit;
