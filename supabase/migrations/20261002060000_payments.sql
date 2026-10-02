begin;
create function public.set_payment_status(p_session_id uuid,p_member_id uuid,p_status public.payment_state) returns void language plpgsql security definer set search_path='' as $$
declare v_previous public.payment_state;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  perform 1 from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if p_status is null or not exists(select 1 from public.members where id=p_member_id) then raise exception using errcode='22023',message='Adhérent ou statut invalide.'; end if;
  select payment_status into v_previous from public.session_participations where session_id=p_session_id and member_id=p_member_id;
  v_previous:=coalesce(v_previous,'unpaid');
  if v_previous=p_status then return; end if;
  insert into public.session_participations(session_id,member_id,payment_status) values(p_session_id,p_member_id,p_status)
  on conflict(session_id,member_id) do update set payment_status=excluded.payment_status;
  insert into public.audit_events(actor_member_id,session_id,target_member_id,event_type,payload) values(public.current_member_id(),p_session_id,p_member_id,'payment_changed',jsonb_build_object('previous_status',v_previous,'status',p_status));
end;
$$;
create function public.get_admin_readiness(p_session_id uuid)
returns table(member_id uuid,selection_state text,caci_status text,transport_mode public.transport_state,payment_status public.payment_state,selection_ready boolean,caci_ready boolean,transport_ready boolean,payment_ready boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  return query with source as (
    select m.id,
      case when exists(select 1 from public.selection_drafts where session_id=p_session_id) then coalesce(d.state::text,'waiting') else c.state end as selection,
      case when m.caci_expiry_date is null then 'missing' when m.caci_expiry_date<s.date then 'expired' when m.caci_expiry_date<=s.date+60 then 'soon' else 'valid' end as caci,
      t.mode,p.payment_status as payment
    from public.sessions s join public.session_participations p on p.session_id=s.id and p.rsvp in('yes','maybe')
    join public.members m on m.id=p.member_id
    join public.get_current_selection(p_session_id) c on c.member_id=m.id
    join public.get_session_transport(p_session_id) t on t.member_id=m.id
    left join public.selection_draft d on d.session_id=s.id and d.member_id=m.id
    where s.id=p_session_id
  ) select id,selection,caci,mode,payment,selection='selected',caci in('valid','soon'),mode in('own','driver','passenger'),payment in('paid','free') from source;
end;
$$;
revoke all on function public.set_payment_status(uuid,uuid,public.payment_state),public.get_admin_readiness(uuid) from public,anon,authenticated,service_role;
grant execute on function public.set_payment_status(uuid,uuid,public.payment_state),public.get_admin_readiness(uuid) to authenticated;
commit;
