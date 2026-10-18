begin;
-- Explicit operator opt-in only. Preserve receipts and independent in-app settings.
alter table public.member_notification_settings add column staging_recipient_mode text not null default 'allowlist'
 check(staging_recipient_mode in ('allowlist','registered'));
-- The existing operator RPC remains an explicit return to allowlist mode.
create or replace function public.configure_member_notifications(p_enabled boolean,p_environment text,p_project_ref text,p_staging_recipients text[]) returns void
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
  update public.member_notification_settings set enabled=p_enabled,environment=p_environment,project_ref=p_project_ref,staging_recipients=p_staging_recipients,staging_recipient_mode='allowlist' where singleton;
end;
$$;
create or replace function public.enqueue_member_notification(p_event public.audit_events,p_member_id uuid,p_kind text) returns void
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
    when s.environment='preview' and s.staging_recipient_mode='allowlist' and not(m.email=any(s.staging_recipients)) then 'suppressed'
    else 'pending' end;
  insert into public.member_notifications(audit_id,member_id,kind,recipient_email,first_name,occurred_at,status,last_code)
    values(p_event.id,m.id,p_kind,m.email,m.first_name,p_event.created_at,v_status,
      case when v_status='suppressed' then 'recipient_blocked' when v_status='disabled' then 'not_enabled' end)
    on conflict(audit_id,kind) do nothing;
end;
$$;
create or replace function public.claim_member_notifications(p_environment text,p_project_ref text,p_limit integer default 10)
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
    where n.status='pending' and (not public.member_notification_email_kind(n.kind) or n.occurred_at<now()-interval '7 days'
      or (s.environment='preview' and s.staging_recipient_mode='allowlist' and not(n.recipient_email=any(s.staging_recipients)))
      or n.recipient_email ~ '(@|\.)(invalid|test|example|localhost)$|@([^@]+\.)?example\.(com|net|org)$'
      or not exists(select 1 from public.members m join auth.users u on u.id=m.auth_user_id
        where m.id=n.member_id and m.email=n.recipient_email and lower(btrim(u.email))=n.recipient_email
          and u.deleted_at is null and u.email_confirmed_at is not null
          and not(u.raw_app_meta_data ? 'ifosse_staging_seed')
          and not exists(select 1 from public.staging_seed_runs r where m.id=any(r.member_ids))
          and (n.kind<>'welcome' or (m.disabled_at is null and (u.banned_until is null or u.banned_until<=now())))));
  delete from public.member_notifications n where n.status in ('accepted','suppressed','disabled','failed') and n.updated_at<now()-interval '90 days';
  return query
    with candidates as (select n.id from public.member_notifications n where n.status='pending' and public.member_notification_email_kind(n.kind) and n.next_attempt_at<=now()
      order by n.occurred_at,n.id limit p_limit for update skip locked),
    claimed as (update public.member_notifications n set status='processing',attempts=n.attempts+1,
      lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now()
      from candidates c where n.id=c.id returning n.*)
    select c.id,c.lease_token,c.recipient_email,c.first_name,c.kind,c.occurred_at from claimed c;
end;
$$;
commit;
