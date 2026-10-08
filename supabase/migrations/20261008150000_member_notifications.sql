begin;
-- No retrospective mail, secrets, network call or activation in a migration.
create table public.member_notification_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  environment text check(environment in ('preview','production')),
  project_ref text,
  staging_recipients text[] not null default '{}',
  check(not enabled or (environment is not null and project_ref is not null and ((environment='preview' and project_ref='btpojwwwsxrepsehmxbm') or (environment='production' and project_ref='qjrpxuatsnvrqxhzklzq'))))
);
insert into public.member_notification_settings(singleton) values(true);
create table public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audit_events(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  kind text not null check(kind in ('welcome','deactivated','reactivated','admin_granted','admin_revoked','presidency_received','presidency_departed')),
  recipient_email text not null,
  first_name text not null,
  occurred_at timestamptz not null,
  status text not null check(status in ('pending','processing','accepted','suppressed','disabled','failed','uncertain')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_code text,
  provider_message_id text check(char_length(provider_message_id)<=500),
  updated_at timestamptz not null default now(),
  unique(audit_id,kind)
);
create index member_notifications_pending on public.member_notifications(next_attempt_at,occurred_at) where status='pending';
alter table public.member_notifications enable row level security;
alter table public.member_notification_settings enable row level security;
revoke all on public.member_notifications,public.member_notification_settings from public,anon,authenticated,service_role;
grant select on public.member_notifications,public.member_notification_settings to service_role;

create function public.enqueue_member_notification(p_event public.audit_events,p_member_id uuid,p_kind text) returns void
language plpgsql security definer set search_path='' as $$
declare m public.members; u auth.users; s public.member_notification_settings; v_status text;
begin
  select * into m from public.members where id=p_member_id;
  if not found then return; end if;
  select * into u from auth.users where id=m.auth_user_id;
  select * into s from public.member_notification_settings where singleton;
  v_status:=case
    when m.email ~ '(@|\.)(invalid|test|example|localhost)$|@([^@]+\.)?example\.(com|net|org)$'
      or u.raw_app_meta_data ? 'ifosse_staging_seed'
      or exists(select 1 from public.staging_seed_runs r where m.id=any(r.member_ids)) then 'suppressed'
    when not s.enabled then 'disabled'
    when s.environment='preview' and not(m.email=any(s.staging_recipients)) then 'suppressed'
    else 'pending' end;
  insert into public.member_notifications(audit_id,member_id,kind,recipient_email,first_name,occurred_at,status,last_code)
    values(p_event.id,m.id,p_kind,m.email,m.first_name,p_event.created_at,v_status,
      case when v_status='suppressed' then 'recipient_blocked' when v_status='disabled' then 'not_enabled' end)
    on conflict(audit_id,kind) do nothing;
end;
$$;
create function public.queue_member_audit_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Only application operations: never bootstrap, imports, seeds, recovery,
  -- self-profile edits, payment or medical data. No historical backfill.
  if new.actor_member_id is null then return new; end if;
  case new.event_type
    when 'member_created_by_president' then perform public.enqueue_member_notification(new,new.target_member_id,'welcome');
    when 'member_deactivated' then perform public.enqueue_member_notification(new,new.target_member_id,'deactivated');
    when 'member_reactivated' then perform public.enqueue_member_notification(new,new.target_member_id,'reactivated');
    when 'member_role_changed' then
      if new.payload->>'role'='admin' then perform public.enqueue_member_notification(new,new.target_member_id,'admin_granted');
      elsif new.payload->>'role'='member' then perform public.enqueue_member_notification(new,new.target_member_id,'admin_revoked'); end if;
    when 'presidency_transferred' then
      perform public.enqueue_member_notification(new,new.target_member_id,'presidency_received');
      perform public.enqueue_member_notification(new,new.actor_member_id,'presidency_departed');
    else null;
  end case;
  return new;
end;
$$;
revoke all on function public.enqueue_member_notification(public.audit_events,uuid,text),public.queue_member_audit_notifications() from public,anon,authenticated,service_role;
create trigger audit_queue_member_notifications after insert on public.audit_events for each row execute function public.queue_member_audit_notifications();

create function public.claim_member_notifications(p_environment text,p_project_ref text,p_limit integer default 10)
returns table(id uuid,lease_token uuid,recipient_email text,first_name text,kind text,occurred_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare s public.member_notification_settings;
begin
  select * into s from public.member_notification_settings where singleton;
  if not s.enabled or s.environment is distinct from p_environment or s.project_ref is distinct from p_project_ref then
    raise exception using errcode='42501',message='Notification environment not enabled or mismatched.';
  end if;
  if p_limit is null or p_limit not between 1 and 10 then raise exception using errcode='22023',message='Batch size must be 1..10.'; end if;
  -- Never resend an expired lease: the provider may already have accepted it.
  update public.member_notifications n set status='uncertain',last_code='lease_expired',updated_at=now()
    where n.status='processing' and n.lease_until<now();
  update public.member_notifications n set status='suppressed',last_code='recipient_blocked',updated_at=now()
    where n.status='pending' and (n.occurred_at<now()-interval '7 days'
      or (s.environment='preview' and not(n.recipient_email=any(s.staging_recipients)))
      or not exists(select 1 from public.members m join auth.users u on u.id=m.auth_user_id
        where m.id=n.member_id and m.email=n.recipient_email and lower(btrim(u.email))=n.recipient_email
          and u.deleted_at is null and u.email_confirmed_at is not null
          and not(u.raw_app_meta_data ? 'ifosse_staging_seed')
          and not exists(select 1 from public.staging_seed_runs r where m.id=any(r.member_ids))
          and (n.kind<>'welcome' or (m.disabled_at is null and (u.banned_until is null or u.banned_until<=now())))));
  delete from public.member_notifications n where n.status in ('accepted','suppressed','disabled','failed') and n.updated_at<now()-interval '90 days';
  return query
    with candidates as (select n.id from public.member_notifications n where n.status='pending' and n.next_attempt_at<=now()
      order by n.occurred_at,n.id limit p_limit for update skip locked),
    claimed as (update public.member_notifications n set status='processing',attempts=n.attempts+1,
      lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now()
      from candidates c where n.id=c.id returning n.*)
    select c.id,c.lease_token,c.recipient_email,c.first_name,c.kind,c.occurred_at from claimed c;
end;
$$;
create function public.complete_member_notification(p_id uuid,p_lease_token uuid,p_outcome text,p_code text,p_message_id text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare n public.member_notifications;
begin
  if p_outcome not in ('accepted','suppressed','retry','failed','uncertain') or p_outcome is null
    or p_code not in ('provider_accepted','provider_deduplicated','recipient_blocked','rate_limited','provider_rejected','provider_uncertain') or p_code is null then
    raise exception using errcode='22023',message='Invalid notification outcome.';
  end if;
  select * into n from public.member_notifications where id=p_id and lease_token=p_lease_token and status in ('processing','uncertain') for update;
  if not found then return false; end if;
  update public.member_notifications set status=case when p_outcome='retry' then case when n.attempts<5 then 'pending' else 'failed' end else p_outcome end,
    next_attempt_at=now()+make_interval(mins=>power(2,n.attempts-1)::integer),last_code=p_code,
    provider_message_id=p_message_id,updated_at=now() where id=p_id;
  return true;
end;
$$;
create function public.retry_member_notification(p_id uuid,p_verified_not_accepted boolean,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_verified_not_accepted is distinct from true or p_reason is null or char_length(btrim(p_reason)) not between 10 and 500 then
    raise exception using errcode='22023',message='Provider verification and reason required.';
  end if;
  update public.member_notifications set status='pending',attempts=0,next_attempt_at=now(),lease_token=null,lease_until=null,updated_at=now()
    where id=p_id and status in ('failed','uncertain') and occurred_at>=now()-interval '7 days';
  if not found then raise exception using errcode='22023',message='Only recent failed or uncertain notifications can be reviewed.'; end if;
  insert into public.audit_events(event_type,payload) values('member_notification_retry_reviewed',jsonb_build_object('notification_id',p_id,'reason',btrim(p_reason)));
end;
$$;
revoke all on function public.claim_member_notifications(text,text,integer),public.complete_member_notification(uuid,uuid,text,text,text),public.retry_member_notification(uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.claim_member_notifications(text,text,integer),public.complete_member_notification(uuid,uuid,text,text,text),public.retry_member_notification(uuid,boolean,text) to service_role;

create function public.configure_member_notifications(p_enabled boolean,p_environment text,p_project_ref text,p_staging_recipients text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' or auth.jwt()->>'ref' is distinct from p_project_ref
    or p_environment is null or p_project_ref is null
    or not ((p_environment='preview' and p_project_ref='btpojwwwsxrepsehmxbm') or (p_environment='production' and p_project_ref='qjrpxuatsnvrqxhzklzq')) then
    raise exception using errcode='42501',message='Pinned service-role project required.';
  end if;
  if p_enabled is null or p_staging_recipients is null or (p_enabled and p_environment='preview' and cardinality(p_staging_recipients)=0)
    or exists(select 1 from unnest(p_staging_recipients) e where e is null or e<>lower(btrim(e)) or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or e ~ '(@|\.)(invalid|test|example|localhost)$|@([^@]+\.)?example\.(com|net|org)$') then
    raise exception using errcode='22023',message='Explicit normalized real test recipients required.';
  end if;
  update public.member_notification_settings set enabled=p_enabled,environment=p_environment,project_ref=p_project_ref,staging_recipients=p_staging_recipients where singleton;
end;
$$;
revoke all on function public.configure_member_notifications(boolean,text,text,text[]) from public,anon,authenticated,service_role;
grant execute on function public.configure_member_notifications(boolean,text,text,text[]) to service_role;

-- A bounded receipt, never recipients/bodies/provider responses. Only the
-- active administrator who performed this operation can inspect its result.
create function public.member_notification_status(p_member_id uuid,p_event_type text) returns text
language plpgsql stable security definer set search_path='' as $$
declare v_event uuid; v_status text;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Active administrator required.'; end if;
  select a.id into v_event from public.audit_events a where a.actor_member_id=public.current_member_id()
    and a.target_member_id=p_member_id and a.event_type=p_event_type order by a.created_at desc,a.id desc limit 1;
  select n.status into v_status from public.member_notifications n where n.audit_id=v_event
    order by case n.status when 'uncertain' then 1 when 'failed' then 2 when 'pending' then 3 when 'processing' then 3 when 'disabled' then 4 when 'suppressed' then 5 else 6 end limit 1;
  return coalesce(v_status,'unavailable');
end;
$$;
revoke all on function public.member_notification_status(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.member_notification_status(uuid,text) to authenticated;
commit;
