begin;
-- Stable import provenance permits retry without overwriting organizer edits.
alter table public.sessions add column import_source_key text unique check(import_source_key ~ '^apsap-fosses-2026-2027/[0-9]{4}-[0-9]{2}-[0-9]{2}$');
alter table public.sessions add column import_source_hash text check(import_source_hash ~ '^[0-9a-f]{64}$');
alter table public.sessions add constraint import_provenance_pair check((import_source_key is null)=(import_source_hash is null));
create function public.import_season_calendar(p_sessions jsonb)
returns table(source_key text,session_id uuid,created boolean)
language plpgsql security definer set search_path='' as $$
declare v_row jsonb; v_record record; v_key text; v_hash text; v_old_hash text; v_id uuid; v_keys text[]:='{}';
begin
  if p_sessions is null or jsonb_typeof(p_sessions)<>'array' or jsonb_array_length(p_sessions) not between 1 and 11 then raise exception using errcode='22023',message='Calendrier attendu : 1 à 11 séances réelles.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ifosse-calendar-2026-2027',0));
  for v_row in select value from jsonb_array_elements(p_sessions) loop
    if jsonb_typeof(v_row)<>'object' then raise exception using errcode='22023',message='Séance invalide.'; end if;
    if (select array_agg(key order by key) from jsonb_object_keys(v_row) key) <> array['address','date','end_time','end_time_estimated','notes','school_holiday','start_time','title','venue']::text[] then raise exception using errcode='22023',message='Champs du calendrier invalides.'; end if;
    select * into v_record from jsonb_to_record(v_row) as x(date date,start_time time,end_time time,end_time_estimated boolean,school_holiday boolean,title text,venue text,address text,notes text);
    if v_record.date is null or v_record.date not in(date '2026-10-28',date '2026-11-04',date '2026-12-09',date '2027-01-13',date '2027-02-10',date '2027-02-26',date '2027-03-16',date '2027-03-31',date '2027-04-07',date '2027-04-23',date '2027-05-12') then raise exception using errcode='22023',message='Date absente du calendrier réel 2026–2027.'; end if;
    v_key:='apsap-fosses-2026-2027/'||v_record.date::text;
    if v_key=any(v_keys) then raise exception using errcode='22023',message='Date dupliquée dans le calendrier.'; end if;
    v_keys:=array_append(v_keys,v_key);
    v_hash:=encode(sha256(convert_to(v_row::text,'UTF8')),'hex');
    select id,import_source_hash into v_id,v_old_hash from public.sessions where import_source_key=v_key for update;
    if found then
      if v_hash<>v_old_hash then raise exception using errcode='22023',message='Une source importée a changé. Faites vérifier les corrections sans écraser la séance.'; end if;
      return query select v_key,v_id,false;
    else
      if exists(select 1 from public.sessions s where s.date=v_record.date and s.start_time=v_record.start_time) then raise exception using errcode='22023',message='Une séance existe déjà à cette date/heure. Vérifiez-la avant l’import.'; end if;
      insert into public.sessions(date,start_time,end_time,end_time_estimated,school_holiday,title,venue,address,notes,capacity,registration_open,import_source_key,import_source_hash)
        values(v_record.date,v_record.start_time,v_record.end_time,v_record.end_time_estimated,v_record.school_holiday,btrim(v_record.title),btrim(v_record.venue),btrim(v_record.address),btrim(v_record.notes),20,true,v_key,v_hash) returning id into v_id;
      insert into public.audit_events(session_id,event_type,payload) values(v_id,'calendar_imported',jsonb_build_object('source_key',v_key,'source_hash',v_hash));
      return query select v_key,v_id,true;
    end if;
  end loop;
end;
$$;
revoke all on function public.import_season_calendar(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.import_season_calendar(jsonb) to service_role;

-- Extend immutable selection headers to IDs/provenance, allowing only actor
-- anonymization during trusted member erasure (matching palanquée snapshots).
create function public.guard_selection_header_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.id=old.id and new.session_id=old.session_id and new.version=old.version and new.published_at=old.published_at
    and old.published_by is not null and new.published_by is null and not exists(select 1 from public.members where id=old.published_by) then return new; end if;
  raise exception using errcode='23514',message='Une publication est immuable. Publiez une nouvelle version.';
end;
$$;
drop trigger immutable_selection_header on public.selection_publications;
create trigger immutable_selection_header before update on public.selection_publications for each row execute function public.guard_selection_header_update();
revoke all on function public.guard_selection_header_update() from public,anon,authenticated,service_role;
commit;
