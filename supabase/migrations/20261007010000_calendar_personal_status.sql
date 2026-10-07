begin;
drop function public.get_session_card_summaries(integer);
create function public.get_session_card_summaries(p_start_year integer)
returns table(session_id uuid,capacity integer,publication_version integer,confirmed_count bigint,
  my_rsvp public.rsvp_state,my_selection_state text,my_transport_mode public.transport_state,
  my_transport_provisional boolean,my_payment_status public.payment_state)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := public.current_member_id();
begin
  if actor is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  if p_start_year is null or p_start_year<2019 or p_start_year>2100 then raise exception using errcode='22023',message='Saison invalide.'; end if;
  return query select s.id,s.capacity,coalesce(pub.version,0),
    (select count(*) from public.current_selected_ids(s.id)),
    coalesce(own.rsvp,'unanswered'::public.rsvp_state),coalesce(sel.state,'none'),
    coalesce(tr.mode,'unset'::public.transport_state),
    coalesce(tr.mode in ('driver','passenger') and not exists (
      select 1 from public.current_selected_ids(s.id) selected where selected.member_id=car.driver_member_id
    ),false),
    case when own.rsvp in ('yes','maybe') then own.payment_status else null end
  from public.sessions s
  left join public.session_participations own on own.session_id=s.id and own.member_id=actor
  left join lateral (select p.version from public.selection_publications p where p.session_id=s.id order by p.version desc limit 1) pub on true
  left join lateral (select p.state from public.get_current_selection(s.id) p where p.member_id=actor) sel on true
  left join lateral (select p.mode,p.car_offer_id from public.get_session_transport(s.id) p where p.member_id=actor) tr on true
  left join public.car_offers car on car.id=tr.car_offer_id
  where s.date>=make_date(p_start_year,9,1) and s.date<make_date(p_start_year+1,9,1)
  order by s.date,s.start_time,s.id;
end;
$$;
revoke all on function public.get_session_card_summaries(integer) from public,anon,authenticated,service_role;
grant execute on function public.get_session_card_summaries(integer) to authenticated;
commit;
