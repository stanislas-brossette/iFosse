begin;
alter table public.members add constraint caci_finite_calendar_date check (
  caci_expiry_date is null or caci_expiry_date between date '0001-01-01' and date '9999-12-31'
);

create function public.update_own_profile(
  p_first_name text, p_last_name text, p_phone text, p_current_level text,
  p_preparing_level text, p_has_usual_car boolean, p_usual_passenger_seats integer,
  p_usual_meeting_point text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.current_member_id();
begin
  if v_actor is null then raise exception using errcode='42501', message='Adhérent actif requis.'; end if;
  if p_first_name is null or p_last_name is null or p_current_level is null
    or char_length(btrim(p_first_name)) not between 1 and 100
    or char_length(btrim(p_last_name)) not between 1 and 100
    or char_length(coalesce(p_phone, '')) > 40 or char_length(p_current_level) > 40
    or char_length(coalesce(p_preparing_level, '')) > 40
    or char_length(coalesce(p_usual_meeting_point, '')) > 200
    or p_has_usual_car is null
    or (p_has_usual_car and (p_usual_passenger_seats is null or p_usual_passenger_seats not between 1 and 8)) then
    raise exception using errcode='22023', message='Champs du profil invalides.';
  end if;
  update public.members set first_name=btrim(p_first_name), last_name=btrim(p_last_name),
    phone=nullif(btrim(p_phone), ''), current_level=btrim(p_current_level),
    preparing_level=nullif(btrim(p_preparing_level), ''), has_usual_car=p_has_usual_car,
    usual_passenger_seats=case when p_has_usual_car then p_usual_passenger_seats else 0 end,
    usual_meeting_point=case when p_has_usual_car then btrim(coalesce(p_usual_meeting_point, '')) else '' end
  where id=v_actor;
end;
$$;

create function public.set_member_caci(p_member_id uuid, p_expiry_date date default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_previous date;
begin
  if not public.is_admin() then raise exception using errcode='42501', message='Droits administrateur requis.'; end if;
  select caci_expiry_date into v_previous from public.members where id=p_member_id for update;
  if not found then raise exception using errcode='22023', message='Adhérent introuvable.'; end if;
  if v_previous is not distinct from p_expiry_date then return; end if;
  update public.members set caci_expiry_date=p_expiry_date where id=p_member_id;
  insert into public.audit_events(actor_member_id, target_member_id, event_type, payload)
  values(public.current_member_id(), p_member_id, 'caci_date_changed', jsonb_build_object('previous_date',v_previous,'date',p_expiry_date));
end;
$$;

revoke all on function public.update_own_profile(text,text,text,text,text,boolean,integer,text),
  public.set_member_caci(uuid,date) from public, anon, authenticated, service_role;
grant execute on function public.update_own_profile(text,text,text,text,text,boolean,integer,text),
  public.set_member_caci(uuid,date) to authenticated;
commit;
