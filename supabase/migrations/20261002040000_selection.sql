begin;
create type public.selection_state as enum ('waiting','selected','declined');
create table public.selection_drafts (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.selection_draft (
  session_id uuid not null references public.selection_drafts(session_id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  state public.selection_state not null default 'waiting',
  updated_by uuid references public.members(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(session_id,member_id)
);
create table public.selection_publications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  version integer not null check(version>0),
  published_by uuid references public.members(id) on delete set null,
  published_at timestamptz not null default now(),
  unique(session_id,version)
);
create table public.selection_publication_members (
  publication_id uuid not null references public.selection_publications(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  state public.selection_state not null,
  rsvp_revision integer not null check(rsvp_revision>=0),
  primary key(publication_id,member_id)
);
alter table public.selection_drafts enable row level security;
alter table public.selection_draft enable row level security;
alter table public.selection_publications enable row level security;
alter table public.selection_publication_members enable row level security;
create policy selection_drafts_admin on public.selection_drafts for select to authenticated using(public.is_admin());
create policy selection_draft_admin on public.selection_draft for select to authenticated using(public.is_admin());
create policy selection_publications_read on public.selection_publications for select to authenticated using(public.current_member_id() is not null);
create policy selection_publication_members_read on public.selection_publication_members for select to authenticated using(public.current_member_id() is not null);
grant select on public.selection_drafts,public.selection_draft,public.selection_publications,public.selection_publication_members to authenticated,service_role;

-- Always interpreted together with current RSVP and its revision. Historical
-- selected snapshots stay immutable while withdrawal releases the current place.
create function public.current_selected_ids(p_session_id uuid) returns table(member_id uuid)
language sql stable security definer set search_path='' as $$
  select pm.member_id from public.selection_publication_members pm
  join public.session_participations p on p.session_id=p_session_id and p.member_id=pm.member_id
  where pm.publication_id=(select id from public.selection_publications where session_id=p_session_id order by version desc limit 1)
    and pm.state='selected' and p.rsvp='yes' and p.rsvp_revision=pm.rsvp_revision
$$;
-- Private internal helper: called only inside an authorized session lock.
create function public.ensure_selection_draft(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.selection_drafts(session_id,created_by) values(p_session_id,public.current_member_id()) on conflict do nothing;
  if not found then return; end if;
  insert into public.selection_draft(session_id,member_id,state,updated_by)
  select p_session_id,pm.member_id,case when pm.state='selected' and not exists(select 1 from public.current_selected_ids(p_session_id) e where e.member_id=pm.member_id) then 'waiting'::public.selection_state else pm.state end,public.current_member_id()
  from public.selection_publication_members pm
  where pm.publication_id=(select id from public.selection_publications where session_id=p_session_id order by version desc limit 1);
  insert into public.selection_draft(session_id,member_id,state,updated_by)
  select p_session_id,member_id,'waiting',public.current_member_id() from public.session_participations where session_id=p_session_id and rsvp in('yes','maybe') on conflict do nothing;
end;
$$;
create function public.guard_draft_selection() returns trigger language plpgsql security definer set search_path='' as $$
declare v_capacity integer;
begin
  select capacity into v_capacity from public.sessions where id=new.session_id for update;
  if new.state='selected' then
    if not exists(select 1 from public.session_participations where session_id=new.session_id and member_id=new.member_id and rsvp='yes') then
      raise exception using errcode='22023',message='Seuls les adhérents ayant répondu Oui peuvent être sélectionnés.';
    end if;
    if (select count(*) from public.selection_draft where session_id=new.session_id and state='selected' and member_id<>new.member_id)>=v_capacity then
      raise exception using errcode='22023',message='Capacité de sélection dépassée. Modifiez la séance pour l’augmenter.';
    end if;
  end if;
  return new;
end;
$$;
create trigger selection_draft_capacity before insert or update on public.selection_draft for each row execute function public.guard_draft_selection();
create function public.guard_session_capacity() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.capacity<(select count(*) from public.selection_draft where session_id=new.id and state='selected') or new.capacity<(select count(*) from public.current_selected_ids(new.id))
    or new.capacity<(select count(*) from public.session_participations where session_id=new.id and attendance_status='dived') then
    raise exception using errcode='22023',message='La capacité est inférieure à la sélection ou aux présences.';
  end if;
  return new;
end;
$$;
create trigger sessions_capacity before update of capacity on public.sessions for each row execute function public.guard_session_capacity();
create function public.selection_withdrawal() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.rsvp<>'yes' then update public.selection_draft set state='waiting',updated_at=now(),updated_by=public.current_member_id() where session_id=new.session_id and member_id=new.member_id and state='selected'; end if;
  return new;
end;
$$;
create trigger participation_selection_withdrawal after update of rsvp on public.session_participations for each row execute function public.selection_withdrawal();
create function public.reject_publication_content_update() returns trigger language plpgsql set search_path='' as $$
begin
  raise exception using errcode='23514',message='Une publication est immuable. Publiez une nouvelle version.';
end;
$$;
-- Identity cleanup may set published_by to NULL; content is never editable.
create trigger immutable_selection_member before update on public.selection_publication_members for each row execute function public.reject_publication_content_update();
create trigger immutable_selection_header before update of session_id,version,published_at on public.selection_publications for each row execute function public.reject_publication_content_update();

create function public.guard_selection_publication_delete() returns trigger language plpgsql security definer set search_path='' as $$
declare v_session uuid;
begin
  if tg_table_name='selection_publications' then v_session:=old.session_id;
  else
    -- A trusted member erasure may cascade its historical identifiers.
    if not exists(select 1 from public.members where id=old.member_id) then return old; end if;
    select session_id into v_session from public.selection_publications where id=old.publication_id;
  end if;
  if exists(select 1 from public.sessions where id=v_session) then raise exception using errcode='23514',message='Une publication est immuable. Supprimez la séance pour effacer son historique.'; end if;
  return old;
end;
$$;
create trigger immutable_selection_header_delete before delete on public.selection_publications for each row execute function public.guard_selection_publication_delete();
create trigger immutable_selection_member_delete before delete on public.selection_publication_members for each row execute function public.guard_selection_publication_delete();

create function public.set_draft_selection(p_session_id uuid,p_member_id uuid,p_state public.selection_state) returns void language plpgsql security definer set search_path='' as $$
declare v_status public.session_status;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select status into v_status from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if v_status='closed' then raise exception using errcode='22023',message='Rouvrez le bilan avant de modifier cette séance.'; end if;
  perform public.ensure_selection_draft(p_session_id);
  insert into public.selection_draft(session_id,member_id,state,updated_by) values(p_session_id,p_member_id,p_state,public.current_member_id())
  on conflict(session_id,member_id) do update set state=excluded.state,updated_by=excluded.updated_by,updated_at=now();
end;
$$;
create function public.discard_selection_draft(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  perform 1 from public.sessions where id=p_session_id and status='open' for update;
  if not found then raise exception using errcode='22023',message='Séance ouverte requise.'; end if;
  delete from public.selection_drafts where session_id=p_session_id;
end;
$$;
create function public.publish_selection(p_session_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_session public.sessions; v_id uuid; v_version integer; v_count integer;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select * into v_session from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if v_session.status='closed' then raise exception using errcode='22023',message='Rouvrez le bilan avant de modifier cette séance.'; end if;
  perform public.ensure_selection_draft(p_session_id);
  select count(*) into v_count from public.selection_draft where session_id=p_session_id and state='selected';
  if v_count>v_session.capacity or exists(select 1 from public.selection_draft d where d.session_id=p_session_id and d.state='selected' and not exists(select 1 from public.session_participations p where p.session_id=d.session_id and p.member_id=d.member_id and p.rsvp='yes')) then
    raise exception using errcode='22023',message='Sélection incohérente ou capacité dépassée.';
  end if;
  select coalesce(max(version),0)+1 into v_version from public.selection_publications where session_id=p_session_id;
  insert into public.selection_publications(session_id,version,published_by) values(p_session_id,v_version,public.current_member_id()) returning id into v_id;
  insert into public.selection_publication_members(publication_id,member_id,state,rsvp_revision)
  select v_id,d.member_id,d.state,coalesce(p.rsvp_revision,0) from public.selection_draft d left join public.session_participations p on p.session_id=d.session_id and p.member_id=d.member_id where d.session_id=p_session_id;
  insert into public.audit_events(actor_member_id,session_id,event_type,payload) values(public.current_member_id(),p_session_id,'selection_published',jsonb_build_object('publication_id',v_id,'version',v_version,'selected_count',v_count));
  delete from public.selection_drafts where session_id=p_session_id;
  return v_id;
end;
$$;
create function public.get_current_selection(p_session_id uuid)
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
  where pm.member_id is not null or p.member_id is not null order by m.last_name,m.first_name;
end;
$$;
revoke all on function public.current_selected_ids(uuid),public.ensure_selection_draft(uuid),public.guard_draft_selection(),public.guard_session_capacity(),public.selection_withdrawal(),public.reject_publication_content_update(),public.guard_selection_publication_delete(),public.set_draft_selection(uuid,uuid,public.selection_state),public.discard_selection_draft(uuid),public.publish_selection(uuid),public.get_current_selection(uuid) from public,anon,authenticated,service_role;
grant execute on function public.set_draft_selection(uuid,uuid,public.selection_state),public.discard_selection_draft(uuid),public.publish_selection(uuid),public.get_current_selection(uuid) to authenticated;
commit;
