begin;
-- Store only the opted-in convenience fields, never a stale whole profile.
create function public.save_own_car_defaults(p_passenger_seats integer,p_meeting_point text) returns void
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.current_member_id();
begin
  if v_actor is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  if p_passenger_seats is null or p_passenger_seats not between 1 and 8 or char_length(coalesce(p_meeting_point,''))>200 then raise exception using errcode='22023',message='Habitudes de voiture invalides.'; end if;
  update public.members set has_usual_car=true,usual_passenger_seats=p_passenger_seats,usual_meeting_point=btrim(coalesce(p_meeting_point,'')) where id=v_actor;
end;
$$;

drop function public.get_admin_readiness(uuid);
create function public.get_admin_readiness(p_session_id uuid)
returns table(member_id uuid,selection_state text,caci_status text,transport_mode public.transport_state,payment_status public.payment_state,selection_ready boolean,caci_ready boolean,transport_ready boolean,payment_ready boolean,selection_basis text,transport_provisional boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  return query with basis as (
    select exists(select 1 from public.selection_drafts where session_id=p_session_id) as draft
  ), source as (
    select m.id,
      case when b.draft then coalesce(d.state::text,'waiting') else c.state end as selection,
      case when m.caci_expiry_date is null then 'missing' when m.caci_expiry_date<s.date then 'expired' when m.caci_expiry_date<=s.date+60 then 'soon' else 'valid' end as caci,
      t.mode,p.payment_status as payment,b.draft,
      coalesce(case when b.draft then driver_draft.state::text else driver_current.state end,'waiting')='selected' as driver_ready
    from public.sessions s join public.session_participations p on p.session_id=s.id and p.rsvp in('yes','maybe')
    join public.members m on m.id=p.member_id
    join public.get_current_selection(p_session_id) c on c.member_id=m.id
    join public.get_session_transport(p_session_id) t on t.member_id=m.id
    cross join basis b
    left join public.selection_draft d on d.session_id=s.id and d.member_id=m.id
    left join public.car_offers car on car.id=t.car_offer_id and car.session_id=s.id
    left join public.selection_draft driver_draft on driver_draft.session_id=s.id and driver_draft.member_id=car.driver_member_id
    left join public.get_current_selection(p_session_id) driver_current on driver_current.member_id=car.driver_member_id
    where s.id=p_session_id
  ) select id,selection,caci,mode,payment,selection='selected',caci in('valid','soon'),
    mode='own' or (mode in('driver','passenger') and driver_ready),payment in('paid','free'),
    case when draft then 'draft' else 'published' end,mode in('driver','passenger') and not driver_ready from source;
end;
$$;
revoke all on function public.save_own_car_defaults(integer,text),public.get_admin_readiness(uuid) from public,anon,authenticated,service_role;
grant execute on function public.save_own_car_defaults(integer,text),public.get_admin_readiness(uuid) to authenticated;
commit;
