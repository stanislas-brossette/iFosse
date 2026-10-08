begin;
-- Retain the original API and operator recovery. Reauthorize AFTER the common
-- identity lock, never from cached JWT roles. Failure rolls back both roles.
create or replace function public.transfer_presidency(p_member_id uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid; v_previous_role public.member_role;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse:identity',0));
  v_actor:=public.current_member_id();
  if not public.is_president() then
    raise exception using errcode='42501',message='Seul le président peut transférer la présidence.';
  end if;
  if p_member_id is null or p_member_id=v_actor then
    raise exception using errcode='22023',message='Choisissez un autre adhérent.';
  end if;
  select m.role into v_previous_role from public.members m join auth.users u on u.id=m.auth_user_id
    where m.id=p_member_id and m.email=lower(btrim(u.email)) and m.email not like '%.invalid' and m.disabled_at is null and u.deleted_at is null
      and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
    for update of m,u;
  if not found then raise exception using errcode='22023',message='SUCCESSOR_UNAVAILABLE'; end if;
  update public.members set role='admin' where id=v_actor;
  update public.members set role='president' where id=p_member_id;
  insert into public.audit_events(actor_member_id,target_member_id,event_type,payload)
    values(v_actor,p_member_id,'presidency_transferred',jsonb_build_object(
      'previous_president_role','admin','previous_target_role',v_previous_role,'role','president'));
end;
$$;
-- Pin the displayed member snapshot until deliberate reconfirmation. The UI
-- passes this timestamp verbatim, preserving its sub-millisecond precision.
create function public.transfer_presidency_if_current(p_member_id uuid,p_expected_updated_at timestamptz) returns void
language plpgsql volatile security definer set search_path='' as $$
declare v_updated_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse:identity',0));
  if not public.is_president() then
    raise exception using errcode='42501',message='Seul le président peut transférer la présidence.';
  end if;
  if p_member_id is null or p_member_id=public.current_member_id() or p_expected_updated_at is null then
    raise exception using errcode='22023',message='Choisissez un autre adhérent.';
  end if;
  select updated_at into v_updated_at from public.members where id=p_member_id for update;
  if not found then raise exception using errcode='22023',message='SUCCESSOR_UNAVAILABLE'; end if;
  if v_updated_at is distinct from p_expected_updated_at then
    raise exception using errcode='40001',message='SUCCESSOR_CHANGED';
  end if;
  perform public.transfer_presidency(p_member_id);
end;
$$;
revoke all on function public.transfer_presidency(uuid),public.transfer_presidency_if_current(uuid,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.transfer_presidency(uuid),public.transfer_presidency_if_current(uuid,timestamptz) to authenticated;
comment on function public.transfer_presidency_if_current(uuid,timestamptz) is 'Current-President-only checked atomic audited handover; former President remains admin. Operator recovery stays separate.';
commit;
