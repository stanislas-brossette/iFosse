begin;
-- Paris local session end is the authoritative boundary, including DST.
create function public.session_has_ended(p_date date,p_end_time time) returns boolean
language sql stable set search_path='' as $$select (p_date+p_end_time) at time zone 'Europe/Paris' <= statement_timestamp()$$;

create function public.set_attendance(p_session_id uuid,p_member_id uuid,p_status public.attendance_state) returns void
language plpgsql security definer set search_path='' as $$
declare v_session public.sessions; v_previous public.attendance_state;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select * into v_session from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if v_session.status='closed' then raise exception using errcode='22023',message='Rouvrez le bilan avant de corriger les présences.'; end if;
  if not public.session_has_ended(v_session.date,v_session.end_time) then raise exception using errcode='22023',message='Les présences se renseignent après la séance.'; end if;
  if p_status is null or not exists(select 1 from public.members where id=p_member_id) then raise exception using errcode='22023',message='Adhérent ou présence invalide.'; end if;
  select attendance_status into v_previous from public.session_participations where session_id=p_session_id and member_id=p_member_id;
  v_previous:=coalesce(v_previous,'unknown');
  if v_previous=p_status then return; end if;
  insert into public.session_participations(session_id,member_id,attendance_status) values(p_session_id,p_member_id,p_status)
  on conflict(session_id,member_id) do update set attendance_status=excluded.attendance_status;
  insert into public.audit_events(actor_member_id,session_id,target_member_id,event_type,payload) values(public.current_member_id(),p_session_id,p_member_id,'attendance_changed',jsonb_build_object('previous_status',v_previous,'status',p_status));
end;
$$;

create function public.close_session_bilan(p_session_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_session public.sessions; v_dived integer;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select * into v_session from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if v_session.status='closed' then return; end if;
  if not public.session_has_ended(v_session.date,v_session.end_time) then raise exception using errcode='22023',message='La séance n’est pas encore terminée.'; end if;
  if exists(select 1 from public.current_selected_ids(p_session_id) e left join public.session_participations p on p.session_id=p_session_id and p.member_id=e.member_id where coalesce(p.attendance_status,'unknown')='unknown') then
    raise exception using errcode='22023',message='Renseignez la présence de chaque participant confirmé.';
  end if;
  select count(*) into v_dived from public.session_participations where session_id=p_session_id and attendance_status='dived';
  if v_dived>v_session.capacity then raise exception using errcode='22023',message='Le nombre de plongeurs dépasse la capacité.'; end if;
  update public.sessions set status='closed',registration_open=false where id=p_session_id;
  delete from public.selection_drafts where session_id=p_session_id;
  insert into public.audit_events(actor_member_id,session_id,event_type,payload) values(public.current_member_id(),p_session_id,'bilan_closed',jsonb_build_object('dived_count',v_dived));
end;
$$;

create function public.reopen_session_bilan(p_session_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_session public.sessions;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select * into v_session from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if v_session.status='open' then return; end if;
  update public.sessions set status='open' where id=p_session_id;
  insert into public.audit_events(actor_member_id,session_id,event_type,payload) values(public.current_member_id(),p_session_id,'bilan_reopened','{}');
end;
$$;

create function public.get_session_attendance(p_session_id uuid)
returns table(member_id uuid,first_name text,last_name text,attendance_status public.attendance_state)
language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_member_id() is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  return query select m.id,m.first_name,m.last_name,p.attendance_status from public.session_participations p join public.members m on m.id=p.member_id join public.sessions s on s.id=p.session_id
  where s.id=p_session_id and (public.is_admin() or s.status='closed' or m.id=public.current_member_id()) order by m.last_name,m.first_name;
end;
$$;

create function public.get_bilan_state(p_session_id uuid)
returns table(session_ended boolean,dived_count bigint,unknown_selected_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  return query select public.session_has_ended(s.date,s.end_time),
    (select count(*) from public.session_participations p where p.session_id=s.id and p.attendance_status='dived'),
    (select count(*) from public.current_selected_ids(s.id) e left join public.session_participations p on p.session_id=s.id and p.member_id=e.member_id where coalesce(p.attendance_status,'unknown')='unknown')
    from public.sessions s where s.id=p_session_id;
end;
$$;

create function public.get_season_counts(p_start_year integer)
returns table(member_id uuid,first_name text,last_name text,completed_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_member_id() is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  if p_start_year is null or p_start_year<2019 or p_start_year>2100 then raise exception using errcode='22023',message='Saison invalide.'; end if;
  return query select m.id,m.first_name,m.last_name,count(s.id)
    from public.members m left join public.session_participations p on p.member_id=m.id and p.attendance_status='dived'
    left join public.sessions s on s.id=p.session_id and s.status='closed' and s.date>=make_date(p_start_year,9,1) and s.date<make_date(p_start_year+1,9,1)
    where public.is_admin() or m.id=public.current_member_id()
    group by m.id,m.first_name,m.last_name order by m.last_name,m.first_name;
end;
$$;
revoke all on function public.session_has_ended(date,time),public.set_attendance(uuid,uuid,public.attendance_state),public.close_session_bilan(uuid),public.reopen_session_bilan(uuid),public.get_session_attendance(uuid),public.get_bilan_state(uuid),public.get_season_counts(integer) from public,anon,authenticated,service_role;
grant execute on function public.set_attendance(uuid,uuid,public.attendance_state),public.close_session_bilan(uuid),public.reopen_session_bilan(uuid),public.get_session_attendance(uuid),public.get_bilan_state(uuid),public.get_season_counts(integer) to authenticated;
commit;
