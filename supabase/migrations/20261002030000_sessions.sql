begin;
create type public.session_status as enum ('open','closed');
create type public.rsvp_state as enum ('unanswered','yes','maybe','no');
create type public.payment_state as enum ('unpaid','paid','free');
create type public.attendance_state as enum ('unknown','dived','absent','not_dived');
create type public.transport_state as enum ('unset','needs','own','driver','passenger');
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null check(date between date '2020-01-01' and date '2100-12-31'),
  start_time time not null check(start_time < time '24:00'),
  end_time time not null check(end_time > start_time and end_time < time '24:00'),
  title text not null default 'Séance de fosse' check(char_length(btrim(title)) between 1 and 100),
  venue text not null default '' check(char_length(venue)<=150),
  address text not null default '' check(char_length(address)<=250),
  notes text not null default '' check(char_length(notes)<=1500),
  capacity integer not null default 20 check(capacity between 1 and 100),
  registration_open boolean not null default true,
  school_holiday boolean not null default false,
  status public.session_status not null default 'open',
  end_time_estimated boolean not null default false,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(status <> 'closed' or not registration_open)
);
create index sessions_date_idx on public.sessions(date);
create trigger sessions_touch_updated_at before update on public.sessions for each row execute function public.touch_updated_at();
create table public.session_participations (
  session_id uuid not null references public.sessions(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  rsvp public.rsvp_state not null default 'unanswered',
  rsvp_revision integer not null default 0 check(rsvp_revision>=0),
  payment_status public.payment_state not null default 'unpaid',
  attendance_status public.attendance_state not null default 'unknown',
  transport_mode public.transport_state not null default 'unset',
  updated_at timestamptz not null default now(),
  primary key(session_id,member_id)
);
create index participations_member_idx on public.session_participations(member_id);
create trigger participation_touch_updated_at before update on public.session_participations for each row execute function public.touch_updated_at();
alter table public.audit_events add constraint audit_session_fk foreign key(session_id) references public.sessions(id) on delete set null;
alter table public.sessions enable row level security;
alter table public.session_participations enable row level security;
create policy sessions_read on public.sessions for select to authenticated using(public.current_member_id() is not null);
create policy participation_private_read on public.session_participations for select to authenticated using(member_id=public.current_member_id() or public.is_admin());
grant select on public.sessions, public.session_participations to authenticated,service_role;

create function public.save_session(p_date date,p_start_time time,p_end_time time,p_title text,p_venue text,p_address text,p_notes text,p_capacity integer,p_registration_open boolean,p_school_holiday boolean,p_end_time_estimated boolean,p_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old public.sessions;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  if p_id is null then
    insert into public.sessions(date,start_time,end_time,title,venue,address,notes,capacity,registration_open,school_holiday,end_time_estimated,created_by)
    values(p_date,p_start_time,p_end_time,btrim(p_title),btrim(p_venue),btrim(p_address),btrim(p_notes),p_capacity,p_registration_open,p_school_holiday,p_end_time_estimated,public.current_member_id()) returning id into v_id;
    insert into public.audit_events(actor_member_id,session_id,event_type,payload) values(public.current_member_id(),v_id,'session_created',jsonb_build_object('date',p_date,'capacity',p_capacity));
  else
    select * into v_old from public.sessions where id=p_id for update;
    if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
    -- Selection/attendance slices extend this locked capacity check.
    update public.sessions set date=p_date,start_time=p_start_time,end_time=p_end_time,title=btrim(p_title),venue=btrim(p_venue),address=btrim(p_address),notes=btrim(p_notes),capacity=p_capacity,
      registration_open=case when status='closed' then false else p_registration_open end,school_holiday=p_school_holiday,end_time_estimated=p_end_time_estimated where id=p_id;
    v_id:=p_id;
    insert into public.audit_events(actor_member_id,session_id,event_type,payload) values(public.current_member_id(),v_id,'session_updated',jsonb_build_object('previous_capacity',v_old.capacity,'capacity',p_capacity));
  end if;
  return v_id;
end;
$$;
create function public.delete_session(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_date date;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select date into v_date from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  insert into public.audit_events(actor_member_id,session_id,event_type,payload) values(public.current_member_id(),p_session_id,'session_deleted',jsonb_build_object('session_id',p_session_id,'date',v_date));
  delete from public.sessions where id=p_session_id;
end;
$$;
create function public.set_session_rsvp(p_session_id uuid,p_rsvp public.rsvp_state,p_member_id uuid default null,p_confirm_caci_warning boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.current_member_id(); v_target uuid:=coalesce(p_member_id,v_actor); v_session public.sessions; v_caci date;
begin
  if v_actor is null or (v_target<>v_actor and not public.is_admin()) then raise exception using errcode='42501',message='Modification de réponse refusée.'; end if;
  select * into v_session from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if v_session.status='closed' then raise exception using errcode='22023',message='Rouvrez le bilan avant de modifier cette séance.'; end if;
  if not v_session.registration_open and not public.is_admin() and p_rsvp<>'no' then raise exception using errcode='22023',message='Inscriptions fermées.'; end if;
  if p_rsvp is null or p_rsvp='unanswered' then raise exception using errcode='22023',message='Réponse invalide.'; end if;
  select caci_expiry_date into v_caci from public.members where id=v_target;
  if not found then raise exception using errcode='22023',message='Adhérent introuvable.'; end if;
  if p_rsvp='yes' and not public.is_admin() and (v_caci is null or v_caci<v_session.date) and not coalesce(p_confirm_caci_warning,false) then
    raise exception using errcode='P0001',message='CACI_WARNING';
  end if;
  insert into public.session_participations(session_id,member_id,rsvp,rsvp_revision) values(p_session_id,v_target,p_rsvp,1)
  on conflict(session_id,member_id) do update set rsvp=excluded.rsvp,rsvp_revision=public.session_participations.rsvp_revision+case when public.session_participations.rsvp<>excluded.rsvp then 1 else 0 end;
  -- Later transport/selection slices attach withdrawal cleanup in this same transaction.
  if v_target<>v_actor then
    insert into public.audit_events(actor_member_id,session_id,target_member_id,event_type,payload) values(v_actor,p_session_id,v_target,'admin_rsvp_changed',jsonb_build_object('rsvp',p_rsvp));
  end if;
end;
$$;
create function public.get_session_responses(p_session_id uuid)
returns table(member_id uuid,first_name text,last_name text,current_level text,preparing_level text,rsvp public.rsvp_state)
language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_member_id() is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  return query select m.id,m.first_name,m.last_name,m.current_level,m.preparing_level,p.rsvp from public.session_participations p join public.members m on m.id=p.member_id where p.session_id=p_session_id order by m.last_name,m.first_name;
end;
$$;
revoke all on function public.save_session(date,time,time,text,text,text,text,integer,boolean,boolean,boolean,uuid),public.delete_session(uuid),public.set_session_rsvp(uuid,public.rsvp_state,uuid,boolean),public.get_session_responses(uuid) from public,anon,authenticated,service_role;
grant execute on function public.save_session(date,time,time,text,text,text,text,integer,boolean,boolean,boolean,uuid),public.delete_session(uuid),public.set_session_rsvp(uuid,public.rsvp_state,uuid,boolean),public.get_session_responses(uuid) to authenticated;
commit;
