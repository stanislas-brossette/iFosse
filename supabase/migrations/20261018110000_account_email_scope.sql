begin;
-- Preserve earlier migration hashes/history: some staging operators may already
-- have applied them. CACI now belongs to the independent in-app inbox.
drop trigger if exists audit_queue_caci_notification on public.audit_events;
create function public.member_notification_email_kind(p_kind text) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(p_kind in ('welcome','deactivated','reactivated','admin_granted','admin_revoked','presidency_received','presidency_departed'),false);
$$;
revoke all on function public.member_notification_email_kind(text) from public,anon,authenticated,service_role;
-- Keep accepted/uncertain receipts and audit history; cancel only unsent CACI.
update public.member_notifications set status='suppressed',last_code='recipient_blocked',updated_at=now()
  where kind='caci_updated' and status in ('pending','disabled');
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
      or (s.environment='preview' and not(n.recipient_email=any(s.staging_recipients)))
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
