begin;

-- updated_at also tracks payments/transport, so it cannot order registrations.
-- Existing responses have no reliable timestamp: leave them NULL, never infer it.
alter table public.session_participations add column registered_at timestamptz;
comment on column public.session_participations.registered_at is
  'First Yes/Maybe response after timestamp tracking began. NULL for legacy/never registered rows.';
create function public.track_first_registration() returns trigger
language plpgsql set search_path='' as $$
begin
  if TG_OP='INSERT' then
    new.registered_at := case when new.rsvp in ('yes','maybe') then clock_timestamp() else null end;
  else
    new.registered_at := old.registered_at;
    if old.registered_at is null and old.rsvp not in ('yes','maybe') and new.rsvp in ('yes','maybe') then
      new.registered_at := clock_timestamp();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.track_first_registration() from public,anon,authenticated,service_role;
create trigger participation_first_registration before insert or update on public.session_participations
for each row execute function public.track_first_registration();

-- Only extend the existing safe projection; retain its population and effective
-- publication logic, and restore the original authenticated-only permission.
drop function public.get_current_selection(uuid);
create function public.get_current_selection(p_session_id uuid)
returns table(member_id uuid,first_name text,last_name text,current_level text,preparing_level text,rsvp public.rsvp_state,state text,publication_id uuid,publication_version integer,registered_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_pub uuid; v_version integer;
begin
  if public.current_member_id() is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  select id,version into v_pub,v_version from public.selection_publications where session_id=p_session_id order by version desc limit 1;
  return query select m.id,m.first_name,m.last_name,m.current_level,m.preparing_level,coalesce(p.rsvp,'unanswered'::public.rsvp_state),
    case when p.rsvp='no' then case when pm.state='selected' then 'withdrawn' else 'none' end
      when p.rsvp is null or p.rsvp='unanswered' then 'none'
      when pm.state='selected' and (p.rsvp<>'yes' or p.rsvp_revision<>pm.rsvp_revision) then 'waiting'
      else coalesce(pm.state::text,case when v_pub is null then 'pending' else 'waiting' end) end,v_pub,coalesce(v_version,0),p.registered_at
  from public.members m left join public.session_participations p on p.session_id=p_session_id and p.member_id=m.id
  left join public.selection_publication_members pm on pm.publication_id=v_pub and pm.member_id=m.id
  where (pm.member_id is not null or p.member_id is not null) and public.can_read_session_participant(p_session_id,m.id) order by m.last_name,m.first_name;
end;
$$;

revoke all on function public.get_current_selection(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_current_selection(uuid) to authenticated;
commit;
