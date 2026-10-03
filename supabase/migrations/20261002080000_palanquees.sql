begin;
alter table public.selection_publications add constraint selection_publication_session_unique unique(id,session_id);
create table public.palanquee_drafts (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  selection_publication_id uuid not null,
  foreign key(selection_publication_id,session_id) references public.selection_publications(id,session_id) on delete cascade
);
create table public.palanquee_draft (
  session_id uuid not null references public.palanquee_drafts(session_id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  group_number integer not null check(group_number between 1 and 8),
  is_leader boolean not null default false,
  updated_by uuid references public.members(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(session_id,member_id)
);
create table public.palanquee_publications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  version integer not null check(version>0),
  published_by uuid references public.members(id) on delete set null,
  published_at timestamptz not null default now(),
  selection_publication_id uuid not null,
  foreign key(selection_publication_id,session_id) references public.selection_publications(id,session_id) on delete cascade,
  unique(session_id,version)
);
create table public.palanquee_publication_members (
  publication_id uuid not null references public.palanquee_publications(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  group_number integer not null check(group_number between 1 and 8),
  is_leader boolean not null,
  primary key(publication_id,member_id)
);
alter table public.palanquee_drafts enable row level security;
alter table public.palanquee_draft enable row level security;
alter table public.palanquee_publications enable row level security;
alter table public.palanquee_publication_members enable row level security;
create policy palanquee_drafts_admin_read on public.palanquee_drafts for select to authenticated using(public.is_admin());
create policy palanquee_draft_admin_read on public.palanquee_draft for select to authenticated using(public.is_admin());
create policy palanquee_publications_member_read on public.palanquee_publications for select to authenticated using(public.current_member_id() is not null);
create policy palanquee_publication_member_read on public.palanquee_publication_members for select to authenticated using(public.current_member_id() is not null);
grant select on public.palanquee_drafts,public.palanquee_draft,public.palanquee_publications,public.palanquee_publication_members to authenticated,service_role;
create trigger immutable_palanquee_member before update on public.palanquee_publication_members for each row execute function public.reject_publication_content_update();
create function public.guard_palanquee_header_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Only the FK's actor anonymization during trusted member erasure is allowed.
  if new.id=old.id and new.session_id=old.session_id and new.version=old.version and new.published_at=old.published_at and new.selection_publication_id=old.selection_publication_id
    and old.published_by is not null and new.published_by is null and not exists(select 1 from public.members where id=old.published_by) then return new; end if;
  raise exception using errcode='23514',message='Une publication est immuable. Publiez une nouvelle version.';
end;
$$;
create trigger immutable_palanquee_header before update on public.palanquee_publications for each row execute function public.guard_palanquee_header_update();
create function public.guard_palanquee_publication_delete() returns trigger language plpgsql security definer set search_path='' as $$
declare v_session uuid;
begin
  if tg_table_name='palanquee_publications' then v_session:=old.session_id;
  else
    if not exists(select 1 from public.members where id=old.member_id) then return old; end if;
    select session_id into v_session from public.palanquee_publications where id=old.publication_id;
  end if;
  if exists(select 1 from public.sessions where id=v_session) then raise exception using errcode='23514',message='Une publication est immuable. Supprimez la séance pour effacer son historique.'; end if;
  return old;
end;
$$;
create trigger immutable_palanquee_header_delete before delete on public.palanquee_publications for each row execute function public.guard_palanquee_publication_delete();
create trigger immutable_palanquee_member_delete before delete on public.palanquee_publication_members for each row execute function public.guard_palanquee_publication_delete();

-- Internal helpers are called only after the authorized RPC acquires the session lock.
create function public.ensure_palanquee_draft(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_selection uuid; v_group_publication uuid;
begin
  select id into v_selection from public.selection_publications where session_id=p_session_id order by version desc limit 1;
  if v_selection is null then raise exception using errcode='22023',message='Publiez d’abord la sélection.'; end if;
  insert into public.palanquee_drafts(session_id,selection_publication_id) values(p_session_id,v_selection) on conflict do nothing;
  if not found then return; end if;
  select id into v_group_publication from public.palanquee_publications where session_id=p_session_id order by version desc limit 1;
  insert into public.palanquee_draft(session_id,member_id,group_number,is_leader,updated_by)
    select p_session_id,pm.member_id,pm.group_number,pm.is_leader,public.current_member_id() from public.palanquee_publication_members pm
    join public.palanquee_publications previous on previous.id=pm.publication_id
    join public.selection_publication_members source on source.publication_id=previous.selection_publication_id and source.member_id=pm.member_id
    join public.session_participations current_response on current_response.session_id=p_session_id and current_response.member_id=pm.member_id and current_response.rsvp_revision=source.rsvp_revision
    join public.current_selected_ids(p_session_id) e on e.member_id=pm.member_id where pm.publication_id=v_group_publication;
end;
$$;
create function public.guard_palanquee_draft() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.sessions where id=new.session_id for update;
  if not exists(select 1 from public.current_selected_ids(new.session_id) e where e.member_id=new.member_id) then raise exception using errcode='22023',message='Seuls les participants confirmés publiés peuvent être affectés.'; end if;
  return new;
end;
$$;
create trigger palanquee_draft_selected before insert or update of session_id,member_id,group_number,is_leader on public.palanquee_draft for each row execute function public.guard_palanquee_draft();

create function public.set_draft_palanquee(p_session_id uuid,p_member_id uuid,p_group_number integer default null,p_is_leader boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare v_status public.session_status; v_source uuid; v_latest uuid;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select status into v_status from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if v_status='closed' then raise exception using errcode='22023',message='Rouvrez le bilan avant de modifier les palanquées.'; end if;
  perform public.ensure_palanquee_draft(p_session_id);
  select selection_publication_id into v_source from public.palanquee_drafts where session_id=p_session_id;
  select id into v_latest from public.selection_publications where session_id=p_session_id order by version desc limit 1;
  if v_source<>v_latest then raise exception using errcode='22023',message='La sélection a changé. Abandonnez le brouillon avant de le reprendre.'; end if;
  if p_group_number is null then delete from public.palanquee_draft where session_id=p_session_id and member_id=p_member_id; return; end if;
  insert into public.palanquee_draft(session_id,member_id,group_number,is_leader,updated_by) values(p_session_id,p_member_id,p_group_number,p_is_leader,public.current_member_id())
  on conflict(session_id,member_id) do update set group_number=excluded.group_number,is_leader=excluded.is_leader,updated_by=excluded.updated_by,updated_at=now();
end;
$$;
create function public.discard_palanquee_draft(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_status public.session_status;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select status into v_status from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if v_status='closed' then raise exception using errcode='22023',message='Rouvrez le bilan avant de modifier les palanquées.'; end if;
  delete from public.palanquee_drafts where session_id=p_session_id;
end;
$$;
create function public.publish_palanquees(p_session_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_status public.session_status; v_source uuid; v_latest uuid; v_id uuid; v_version integer;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select status into v_status from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if v_status='closed' then raise exception using errcode='22023',message='Rouvrez le bilan avant de modifier les palanquées.'; end if;
  perform public.ensure_palanquee_draft(p_session_id);
  select selection_publication_id into v_source from public.palanquee_drafts where session_id=p_session_id;
  select id into v_latest from public.selection_publications where session_id=p_session_id order by version desc limit 1;
  if v_source<>v_latest or exists(select 1 from public.palanquee_draft d where d.session_id=p_session_id and not exists(select 1 from public.current_selected_ids(p_session_id) e where e.member_id=d.member_id)) then
    raise exception using errcode='22023',message='La sélection a changé. Abandonnez puis vérifiez le brouillon.';
  end if;
  select coalesce(max(version),0)+1 into v_version from public.palanquee_publications where session_id=p_session_id;
  insert into public.palanquee_publications(session_id,version,published_by,selection_publication_id) values(p_session_id,v_version,public.current_member_id(),v_source) returning id into v_id;
  insert into public.palanquee_publication_members(publication_id,member_id,group_number,is_leader) select v_id,member_id,group_number,is_leader from public.palanquee_draft where session_id=p_session_id;
  insert into public.audit_events(actor_member_id,session_id,event_type,payload) values(public.current_member_id(),p_session_id,'palanquees_published',jsonb_build_object('version',v_version,'selection_publication_id',v_source));
  delete from public.palanquee_drafts where session_id=p_session_id;
  return v_id;
end;
$$;
create function public.get_palanquee_state(p_session_id uuid)
returns table(publication_id uuid,publication_version integer,selection_publication_id uuid,selection_version integer,needs_review boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_member_id() is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  return query select g.id,g.version,g.selection_publication_id,s.version,
    g.selection_publication_id<>(select id from public.selection_publications where session_id=p_session_id order by version desc limit 1)
    or coalesce((select array_agg(pm.member_id order by pm.member_id) from public.selection_publication_members pm where pm.publication_id=g.selection_publication_id and pm.state='selected'),'{}'::uuid[]) <> coalesce((select array_agg(e.member_id order by e.member_id) from public.current_selected_ids(p_session_id) e),'{}'::uuid[])
    from public.palanquee_publications g join public.selection_publications s on s.id=g.selection_publication_id where g.session_id=p_session_id order by g.version desc limit 1;
end;
$$;
create function public.get_current_palanquees(p_session_id uuid)
returns table(member_id uuid,first_name text,last_name text,current_level text,preparing_level text,group_number integer,is_leader boolean,publication_id uuid,publication_version integer,selection_publication_id uuid,selection_version integer,needs_review boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_member_id() is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  return query select m.id,m.first_name,m.last_name,m.current_level,m.preparing_level,pm.group_number,pm.is_leader,g.publication_id,g.publication_version,g.selection_publication_id,g.selection_version,g.needs_review
    from public.get_palanquee_state(p_session_id) g join public.palanquee_publication_members pm on pm.publication_id=g.publication_id
    join public.members m on m.id=pm.member_id join public.session_participations p on p.session_id=p_session_id and p.member_id=m.id
    join public.selection_publication_members source on source.publication_id=g.selection_publication_id and source.member_id=m.id and source.rsvp_revision=p.rsvp_revision
    join public.current_selected_ids(p_session_id) e on e.member_id=m.id order by pm.group_number,m.last_name,m.first_name;
end;
$$;
revoke all on function public.guard_palanquee_header_update(),public.guard_palanquee_publication_delete(),public.ensure_palanquee_draft(uuid),public.guard_palanquee_draft(),public.set_draft_palanquee(uuid,uuid,integer,boolean),public.discard_palanquee_draft(uuid),public.publish_palanquees(uuid),public.get_palanquee_state(uuid),public.get_current_palanquees(uuid) from public,anon,authenticated,service_role;
grant execute on function public.set_draft_palanquee(uuid,uuid,integer,boolean),public.discard_palanquee_draft(uuid),public.publish_palanquees(uuid),public.get_palanquee_state(uuid),public.get_current_palanquees(uuid) to authenticated;
commit;
