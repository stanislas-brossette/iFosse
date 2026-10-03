begin;
-- Shared visibility follows D007/D026; own status and administrator correction
-- remain available without exposing No/unanswered identities to other members.
create function public.can_read_session_participant(p_session_id uuid,p_member_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.current_member_id() is not null and (p_member_id=public.current_member_id() or public.is_admin() or exists(select 1 from public.session_participations p where p.session_id=p_session_id and p.member_id=p_member_id and p.rsvp in('yes','maybe')))
$$;
create function public.get_rsvp_change_consequences(p_session_id uuid,p_member_id uuid default null)
returns table(selected boolean,passengers bigint) language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=public.current_member_id(); v_target uuid:=coalesce(p_member_id,v_actor);
begin
  if v_actor is null or (v_target<>v_actor and not public.is_admin()) then raise exception using errcode='42501',message='Modification de réponse refusée.'; end if;
  return query select exists(select 1 from public.current_selected_ids(p_session_id) s where s.member_id=v_target),
    (select count(*) from public.car_passengers seat join public.car_offers car on car.id=seat.car_offer_id where car.session_id=p_session_id and car.driver_member_id=v_target);
end;
$$;
drop function public.set_session_rsvp(uuid,public.rsvp_state,uuid,boolean);
create function public.set_session_rsvp(p_session_id uuid,p_rsvp public.rsvp_state,p_member_id uuid default null,p_confirm_caci_warning boolean default false,p_confirm_withdrawal boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.current_member_id(); v_target uuid:=coalesce(p_member_id,v_actor); v_session public.sessions; v_caci date;
begin
  if v_actor is null or (v_target<>v_actor and not public.is_admin()) then raise exception using errcode='42501',message='Modification de réponse refusée.'; end if;
  select * into v_session from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if v_session.status='closed' then raise exception using errcode='22023',message='Rouvrez le bilan avant de modifier cette séance.'; end if;
  if not v_session.registration_open and not public.is_admin() and p_rsvp<>'no' then raise exception using errcode='22023',message='Inscriptions fermées.'; end if;
  if p_rsvp is null or p_rsvp='unanswered' then raise exception using errcode='22023',message='Réponse invalide.'; end if;
  select caci_expiry_date into v_caci from public.members where id=v_target;
  if not found then raise exception using errcode='22023',message='Adhérent introuvable.'; end if;
  if p_rsvp='yes' and not public.is_admin() and (v_caci is null or v_caci<v_session.date) and not coalesce(p_confirm_caci_warning,false) then
    raise exception using errcode='P0001',message='CACI_WARNING';
  end if;
  if p_rsvp<>'yes' and not coalesce(p_confirm_withdrawal,false) and exists(select 1 from public.get_rsvp_change_consequences(p_session_id,v_target) c where c.selected or c.passengers>0) then
    raise exception using errcode='P0001',message='RSVP_WITHDRAWAL_WARNING';
  end if;
  insert into public.session_participations(session_id,member_id,rsvp,rsvp_revision) values(p_session_id,v_target,p_rsvp,1)
  on conflict(session_id,member_id) do update set rsvp=excluded.rsvp,rsvp_revision=public.session_participations.rsvp_revision+case when public.session_participations.rsvp<>excluded.rsvp then 1 else 0 end;
  -- Later transport/selection slices attach withdrawal cleanup in this same transaction.
  if v_target<>v_actor then
    insert into public.audit_events(actor_member_id,session_id,target_member_id,event_type,payload) values(v_actor,p_session_id,v_target,'admin_rsvp_changed',jsonb_build_object('rsvp',p_rsvp));
  end if;
end;
$$;
create or replace function public.get_session_responses(p_session_id uuid)
returns table(member_id uuid,first_name text,last_name text,current_level text,preparing_level text,rsvp public.rsvp_state)
language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_member_id() is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  return query select m.id,m.first_name,m.last_name,m.current_level,m.preparing_level,p.rsvp from public.session_participations p join public.members m on m.id=p.member_id where p.session_id=p_session_id and p.rsvp in('yes','maybe') order by m.last_name,m.first_name;
end;
$$;
create function public.get_admin_session_responses(p_session_id uuid)
returns table(member_id uuid,first_name text,last_name text,current_level text,preparing_level text,rsvp public.rsvp_state)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  return query select m.id,m.first_name,m.last_name,m.current_level,m.preparing_level,p.rsvp from public.session_participations p join public.members m on m.id=p.member_id where p.session_id=p_session_id order by m.last_name,m.first_name;
end;
$$;
create or replace function public.get_current_selection(p_session_id uuid)
returns table(member_id uuid,first_name text,last_name text,current_level text,preparing_level text,rsvp public.rsvp_state,state text,publication_id uuid,publication_version integer)
language plpgsql stable security definer set search_path='' as $$
declare v_pub uuid; v_version integer;
begin
  if public.current_member_id() is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  select id,version into v_pub,v_version from public.selection_publications where session_id=p_session_id order by version desc limit 1;
  return query select m.id,m.first_name,m.last_name,m.current_level,m.preparing_level,coalesce(p.rsvp,'unanswered'::public.rsvp_state),
    case when p.rsvp='no' then case when pm.state='selected' then 'withdrawn' else 'none' end
      when p.rsvp is null or p.rsvp='unanswered' then 'none'
      when pm.state='selected' and (p.rsvp<>'yes' or p.rsvp_revision<>pm.rsvp_revision) then 'waiting'
      else coalesce(pm.state::text,case when v_pub is null then 'pending' else 'waiting' end) end,v_pub,coalesce(v_version,0)
  from public.members m left join public.session_participations p on p.session_id=p_session_id and p.member_id=m.id
  left join public.selection_publication_members pm on pm.publication_id=v_pub and pm.member_id=m.id
  where (pm.member_id is not null or p.member_id is not null) and public.can_read_session_participant(p_session_id,m.id) order by m.last_name,m.first_name;
end;
$$;

alter policy selection_publication_members_read on public.selection_publication_members using (
  exists(select 1 from public.selection_publications pub where pub.id=publication_id and public.can_read_session_participant(pub.session_id,member_id))
);
alter policy palanquee_publication_member_read on public.palanquee_publication_members using (
  exists(select 1 from public.palanquee_publications pub where pub.id=publication_id and public.can_read_session_participant(pub.session_id,member_id))
);
revoke all on function public.can_read_session_participant(uuid,uuid),public.get_rsvp_change_consequences(uuid,uuid),public.set_session_rsvp(uuid,public.rsvp_state,uuid,boolean,boolean),public.get_admin_session_responses(uuid) from public,anon,authenticated,service_role;
grant execute on function public.can_read_session_participant(uuid,uuid),public.get_rsvp_change_consequences(uuid,uuid),public.set_session_rsvp(uuid,public.rsvp_state,uuid,boolean,boolean),public.get_admin_session_responses(uuid) to authenticated;
commit;
