begin;
create function public.get_session_card_summaries(p_start_year integer)
returns table(session_id uuid,capacity integer,publication_version integer,confirmed_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_member_id() is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  if p_start_year is null or p_start_year<2019 or p_start_year>2100 then raise exception using errcode='22023',message='Saison invalide.'; end if;
  return query select s.id,s.capacity,coalesce(pub.version,0),
    (select count(*) from public.current_selected_ids(s.id))
  from public.sessions s left join lateral (
    select p.version from public.selection_publications p where p.session_id=s.id order by p.version desc limit 1
  ) pub on true
  where s.date>=make_date(p_start_year,9,1) and s.date<make_date(p_start_year+1,9,1)
  order by s.date,s.start_time,s.id;
end;
$$;
revoke all on function public.get_session_card_summaries(integer) from public,anon,authenticated,service_role;
grant execute on function public.get_session_card_summaries(integer) to authenticated;
commit;
