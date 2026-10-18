begin;

-- Operator activation is deliberately separate from migration/application rollout.
create table public.app_notification_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into public.app_notification_settings(singleton) values (true);
alter table public.app_notification_settings enable row level security;
revoke all on public.app_notification_settings from public,anon,authenticated,service_role;

create table public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  kind text not null check (kind in ('selection_published','selection_changed','carpool_removed','carpool_updated','caci_updated')),
  session_id uuid references public.sessions(id) on delete cascade,
  source_id uuid not null,
  title text not null,
  message text not null,
  created_at timestamptz not null default clock_timestamp(),
  read_at timestamptz,
  unique (member_id,kind,source_id)
);
create index app_notifications_inbox on public.app_notifications(member_id,created_at desc,id desc);
create index app_notifications_unread on public.app_notifications(member_id) where read_at is null;
alter table public.app_notifications enable row level security;
revoke all on public.app_notifications from public,anon,authenticated,service_role;
grant select on public.app_notifications to authenticated;
create policy own_app_notifications on public.app_notifications for select to authenticated
using (member_id=public.current_member_id());

create function public.enqueue_app_notification(p_member uuid,p_kind text,p_session uuid,p_source uuid,p_title text,p_message text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not coalesce((select enabled from public.app_notification_settings where singleton),false)
    or public.current_member_id() is null or p_member=public.current_member_id() then return; end if;
  insert into public.app_notifications(member_id,kind,session_id,source_id,title,message)
  select p_member,p_kind,p_session,p_source,p_title,p_message
  from public.members m join auth.users u on u.id=m.auth_user_id
  where m.id=p_member and m.disabled_at is null and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=now())
  on conflict(member_id,kind,source_id) do nothing;
end;
$$;
revoke all on function public.enqueue_app_notification(uuid,text,uuid,uuid,text,text) from public,anon,authenticated,service_role;

-- Observe completed audit events, never private selection drafts.
create function public.notify_app_audit() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous_pub uuid; published uuid; session_key uuid; session_title text; item record; previous_state text; next_state text;
begin
  if not coalesce((select enabled from public.app_notification_settings where singleton),false)
    or public.current_member_id() is null then return new; end if;
  if new.event_type='caci_date_changed' then
    perform public.enqueue_app_notification(new.target_member_id,'caci_updated',null,new.id,
      'Votre CACI a été mis à jour','Un administrateur a mis à jour votre information CACI. Consultez votre profil.');
  elsif new.event_type='selection_published' then
    published := (new.payload->>'publication_id')::uuid;
    select pub.session_id,s.title into session_key,session_title from public.selection_publications pub
      join public.sessions s on s.id=pub.session_id where pub.id=published;
    select id into previous_pub from public.selection_publications where session_id=session_key
      and version<(select version from public.selection_publications where id=published) order by version desc limit 1;
    for item in select p.member_id,p.rsvp,p.rsvp_revision,n.state new_state,n.rsvp_revision new_revision,
        o.state old_state,o.rsvp_revision old_revision
      from public.session_participations p
      left join public.selection_publication_members n on n.publication_id=published and n.member_id=p.member_id
      left join public.selection_publication_members o on o.publication_id=previous_pub and o.member_id=p.member_id
      where p.session_id=session_key and p.rsvp in ('yes','maybe') loop
      -- Same effective-state rule as get_current_selection: a renewed Yes cannot
      -- resurrect a historical place, including in the previous publication.
      next_state := case when item.new_state='selected' and (item.rsvp<>'yes' or item.rsvp_revision<>item.new_revision)
        then 'waiting' else coalesce(item.new_state::text,'waiting') end;
      previous_state := case when item.old_state='selected' and (item.rsvp<>'yes' or item.rsvp_revision<>item.old_revision)
        then 'waiting' else coalesce(item.old_state::text,'waiting') end;
      if previous_pub is null or previous_state<>next_state then
        perform public.enqueue_app_notification(item.member_id,
          case when previous_pub is null then 'selection_published' else 'selection_changed' end,session_key,new.id,
          case when previous_pub is null then 'Sélection publiée' else 'Votre sélection a changé' end,
          session_title || ' — lors de cette publication : ' || case next_state when 'selected' then 'confirmé' when 'declined' then 'non retenu' else 'en attente' end || '.');
      end if;
    end loop;
  end if;
  return new;
exception when others then
  -- Only this optional side effect is rolled back. Do not leak provider/profile
  -- data in logs and never hide errors from the existing business transaction.
  raise warning 'In-app notification not recorded (SQLSTATE %)',SQLSTATE;
  return new;
end;
$$;
revoke all on function public.notify_app_audit() from public,anon,authenticated,service_role;
create trigger audit_app_notification after insert on public.audit_events for each row
when (new.event_type in ('selection_published','caci_date_changed')) execute function public.notify_app_audit();

create function public.notify_app_car() returns trigger
language plpgsql security definer set search_path='' as $$
declare passenger uuid; source uuid := gen_random_uuid(); label text;
begin
  if not coalesce((select enabled from public.app_notification_settings where singleton),false)
    or public.current_member_id() is null then return old; end if;
  if TG_OP='UPDATE' and new.meeting_point is not distinct from old.meeting_point
    and new.departure_time is not distinct from old.departure_time then return new; end if;
  -- A session deletion cascades its cars; it must not create dangling notices.
  select title into label from public.sessions where id=old.session_id;
  if not found then return old; end if;
  for passenger in select cp.member_id from public.car_passengers cp
    join public.session_participations p using(session_id,member_id)
    where cp.car_offer_id=old.id and p.rsvp='yes' loop
    perform public.enqueue_app_notification(passenger,
      case when TG_OP='DELETE' then 'carpool_removed' else 'carpool_updated' end,old.session_id,source,
      case when TG_OP='DELETE' then 'Votre voiture n’est plus disponible' else 'Votre covoiturage a changé' end,
      label || case when TG_OP='DELETE' then ' — consultez le covoiturage pour retrouver une voiture. Votre inscription est conservée.'
        else ' — le lieu de rendez-vous ou l’heure de départ a changé. Consultez le covoiturage.' end);
  end loop;
  if TG_OP='DELETE' then return old; else return new; end if;
exception when others then
  raise warning 'In-app notification not recorded (SQLSTATE %)',SQLSTATE;
  if TG_OP='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.notify_app_car() from public,anon,authenticated,service_role;
create trigger car_app_notification_removed before delete on public.car_offers for each row execute function public.notify_app_car();
create trigger car_app_notification_updated after update of meeting_point,departure_time on public.car_offers for each row execute function public.notify_app_car();

create function public.get_my_notifications(p_before_time timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := public.current_member_id(); result jsonb; active boolean;
begin
  if actor is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  if (p_before_time is null)<>(p_before_id is null) then raise exception using errcode='22023',message='Curseur incomplet.'; end if;
  select enabled into active from public.app_notification_settings where singleton;
  if not coalesce(active,false) then return jsonb_build_object('enabled',false,'unread_count',0,'items','[]'::jsonb,'has_more',false); end if;
  with page as (select * from public.app_notifications where member_id=actor
      and (p_before_time is null or (created_at,id)<(p_before_time,p_before_id)) order by created_at desc,id desc limit 21),
    visible as (select * from page order by created_at desc,id desc limit 20)
  select jsonb_build_object('enabled',true,'unread_count',(select count(*) from public.app_notifications where member_id=actor and read_at is null),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'session_id',session_id,'title',title,'message',message,'created_at',created_at,'read_at',read_at) order by created_at desc,id desc) from visible),'[]'::jsonb),
    'has_more',(select count(*)>20 from page)) into result;
  return result;
end;
$$;
create function public.mark_app_notifications_read(p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid := public.current_member_id();
begin
  if actor is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  if coalesce(cardinality(p_ids),0)>100 then raise exception using errcode='22023',message='Lot trop grand.'; end if;
  update public.app_notifications set read_at=coalesce(read_at,clock_timestamp()) where member_id=actor and id=any(p_ids);
end;
$$;
revoke all on function public.get_my_notifications(timestamptz,uuid),public.mark_app_notifications_read(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.get_my_notifications(timestamptz,uuid),public.mark_app_notifications_read(uuid[]) to authenticated;
commit;
