begin;

-- Only ordinary identity/qualification fields are editable here. Auth identity,
-- permissions, access, CACI and car defaults retain their dedicated workflows.
create function public.update_member_profile_if_current(
  p_member_id uuid, p_expected_updated_at timestamptz,
  p_first_name text, p_last_name text, p_phone text,
  p_current_level text, p_preparing_level text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_previous public.members%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse:identity',0));
  if not public.is_admin() then
    raise exception using errcode='42501', message='Droits administrateur requis.';
  end if;
  select * into v_previous from public.members where id=p_member_id for update;
  if not found then raise exception using errcode='22023', message='Adhérent introuvable.'; end if;
  if p_expected_updated_at is null or v_previous.updated_at is distinct from p_expected_updated_at then
    raise sqlstate 'PGRST' using
      message=jsonb_build_object('code','40001','message','PROFILE_EDIT_CONFLICT','details',null,'hint',null)::text,
      detail='{"status":409,"headers":{}}';
  end if;
  if p_first_name is null or p_last_name is null or p_current_level is null
    or char_length(btrim(p_first_name)) not between 1 and 100
    or char_length(btrim(p_last_name)) not between 1 and 100
    or char_length(coalesce(p_phone,'')) > 40
    or char_length(p_current_level) > 40
    or char_length(coalesce(p_preparing_level,'')) > 40 then
    raise exception using errcode='22023', message='Champs du profil invalides.';
  end if;
  update public.members set first_name=btrim(p_first_name), last_name=btrim(p_last_name),
    phone=nullif(btrim(p_phone),''), current_level=btrim(p_current_level),
    preparing_level=nullif(btrim(p_preparing_level),'') where id=p_member_id;
  insert into public.audit_events(actor_member_id,target_member_id,event_type,payload)
    values(public.current_member_id(),p_member_id,'member_profile_changed',
      jsonb_build_object('fields',jsonb_build_array('first_name','last_name','phone','current_level','preparing_level')));
end;
$$;
revoke all on function public.update_member_profile_if_current(uuid,timestamptz,text,text,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.update_member_profile_if_current(uuid,timestamptz,text,text,text,text,text)
  to authenticated;
commit;
