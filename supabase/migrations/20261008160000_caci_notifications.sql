begin;
-- Extend the existing private outbox; never copy the audit's medical dates.
alter table public.member_notifications drop constraint member_notifications_kind_check;
alter table public.member_notifications add constraint member_notifications_kind_check
  check(kind in ('welcome','deactivated','reactivated','admin_granted','admin_revoked','presidency_received','presidency_departed','caci_updated'));

create function public.queue_caci_audit_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- set_member_caci authorizes/locks, skips identical values and audits only a
  -- successful change. Its compare-and-write wrapper retains conflict checks.
  if new.actor_member_id is not null then
    perform public.enqueue_member_notification(new,new.target_member_id,'caci_updated');
  end if;
  return new;
end;
$$;
revoke all on function public.queue_caci_audit_notification() from public,anon,authenticated,service_role;
create trigger audit_queue_caci_notification after insert on public.audit_events
  for each row when (new.event_type='caci_date_changed') execute function public.queue_caci_audit_notification();
commit;
