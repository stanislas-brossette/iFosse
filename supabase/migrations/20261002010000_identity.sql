-- Identity is provisioned by a trusted operator, never by browser metadata.
-- Profiles remain private to their owner and administrators. Normal profile
-- editing and CACI updates are introduced by the next slice.
begin;

create type public.member_role as enum ('member', 'admin', 'president');

create table public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 100),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 100),
  email text not null unique check (
    email = lower(btrim(email)) and position('@' in email) > 1 and char_length(email) <= 254
  ),
  phone text,
  current_level text not null default '',
  preparing_level text,
  role public.member_role not null default 'member',
  caci_expiry_date date,
  has_usual_car boolean not null default false,
  usual_passenger_seats integer not null default 0
    check (usual_passenger_seats between 0 and 8),
  usual_meeting_point text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A missing president may be bootstrapped/recovered by the trusted operator,
-- but there can never be two presidents, even during concurrent requests.
create unique index members_one_president on public.members ((role))
  where role = 'president';

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_member_id uuid references public.members(id) on delete set null,
  session_id uuid,
  target_member_id uuid references public.members(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 100),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

comment on column public.audit_events.session_id is
  'Session foreign key is added with the sessions migration; no sessions exist yet.';

alter table public.members enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.members, public.audit_events from anon, authenticated, service_role;
grant select on public.members, public.audit_events to authenticated, service_role;
-- Trusted operator/test cleanup only; normal application writes use RPCs.
grant delete on public.members to service_role;

create function public.current_member_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.id
  from public.members m
  join auth.users u on u.id = m.auth_user_id
  where m.auth_user_id = auth.uid()
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
$$;

create function public.current_member_role() returns public.member_role
language sql stable security definer set search_path = ''
as $$
  select m.role from public.members m where m.id = public.current_member_id()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_member_role() in ('admin', 'president'), false)
$$;

create function public.is_president() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_member_role() = 'president', false)
$$;

revoke all on function public.current_member_id(), public.current_member_role(),
  public.is_admin(), public.is_president() from public, anon, authenticated, service_role;
grant execute on function public.current_member_id(), public.current_member_role(),
  public.is_admin(), public.is_president() to authenticated, service_role;

create policy members_read_own_or_admin on public.members
  for select to authenticated
  using (id = public.current_member_id() or public.is_admin());

create policy audit_events_read_admin on public.audit_events
  for select to authenticated using (public.is_admin());

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger members_touch_updated_at before update on public.members
  for each row execute function public.touch_updated_at();

create function public.guard_president_deletion() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.role = 'president' then
    raise exception using errcode = '23514',
      message = 'Transférez ou récupérez la présidence avant de supprimer ce profil.';
  end if;
  return old;
end;
$$;

create trigger members_guard_president_deletion before delete on public.members
  for each row execute function public.guard_president_deletion();

create function public.provision_member(
  p_auth_user_id uuid, p_first_name text, p_last_name text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
  v_member public.members%rowtype;
begin
  if p_auth_user_id is null or p_first_name is null or p_last_name is null
    or char_length(btrim(p_first_name)) not between 1 and 100
    or char_length(btrim(p_last_name)) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Identité d’adhérent invalide.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse:identity', 0));

  select lower(btrim(u.email)) into v_email from auth.users u
    where u.id = p_auth_user_id and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now());
  if v_email is null or position('@' in v_email) <= 1 or char_length(v_email) > 254 then
    raise exception using errcode = '22023', message = 'Compte Auth actif avec email requis.';
  end if;

  select * into v_member from public.members
    where auth_user_id = p_auth_user_id or email = v_email for update;
  if found then
    if v_member.email <> v_email
      or (v_member.auth_user_id is not null and v_member.auth_user_id <> p_auth_user_id) then
      raise exception using errcode = '23505', message = 'Email déjà lié à une autre identité.';
    end if;
    if v_member.auth_user_id is null then
      update public.members set auth_user_id = p_auth_user_id where id = v_member.id;
      insert into public.audit_events (target_member_id, event_type)
        values (v_member.id, 'member_identity_linked');
    end if;
    -- Re-importing never overwrites profile edits or privileged roles.
    return v_member.id;
  end if;

  insert into public.members (auth_user_id, first_name, last_name, email)
    values (p_auth_user_id, btrim(p_first_name), btrim(p_last_name), v_email)
    returning id into v_member.id;
  insert into public.audit_events (target_member_id, event_type)
    values (v_member.id, 'member_provisioned');
  return v_member.id;
end;
$$;

create function public.bootstrap_president(p_member_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_previous_role public.member_role;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse:identity', 0));
  if exists (select 1 from public.members where role = 'president')
    or exists (select 1 from public.audit_events where event_type = 'president_bootstrapped') then
    raise exception using errcode = '23514', message = 'La présidence a déjà été initialisée.';
  end if;
  select m.role into v_previous_role from public.members m
    join auth.users u on u.id = m.auth_user_id
    where m.id = p_member_id and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now()) for update of m;
  if not found then
    raise exception using errcode = '22023', message = 'Adhérent actif requis pour la présidence.';
  end if;
  update public.members set role = 'president' where id = p_member_id;
  insert into public.audit_events (target_member_id, event_type, payload)
    values (p_member_id, 'president_bootstrapped',
      jsonb_build_object('previous_role', v_previous_role, 'role', 'president'));
end;
$$;

create function public.set_member_role(p_member_id uuid, p_role public.member_role) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid;
  v_previous_role public.member_role;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse:identity', 0));
  v_actor := public.current_member_id();
  if not public.is_president() then
    raise exception using errcode = '42501', message = 'Seul le président peut modifier les droits.';
  end if;
  if p_member_id is null or p_role is null or p_role = 'president' then
    raise exception using errcode = '22023', message = 'Choisissez adhérent ou administrateur.';
  end if;
  select role into v_previous_role from public.members where id = p_member_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Adhérent introuvable.';
  end if;
  if v_previous_role = 'president' then
    raise exception using errcode = '23514', message = 'La présidence nécessite un transfert explicite.';
  end if;
  if v_previous_role = p_role then
    return;
  end if;
  update public.members set role = p_role where id = p_member_id;
  insert into public.audit_events (actor_member_id, target_member_id, event_type, payload)
    values (v_actor, p_member_id, 'member_role_changed',
      jsonb_build_object('previous_role', v_previous_role, 'role', p_role));
end;
$$;

create function public.transfer_presidency(p_member_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse:identity', 0));
  v_actor := public.current_member_id();
  if not public.is_president() then
    raise exception using errcode = '42501', message = 'Seul le président peut transférer la présidence.';
  end if;
  if p_member_id = v_actor then
    raise exception using errcode = '22023', message = 'Choisissez un autre adhérent.';
  end if;
  perform 1 from public.members m join auth.users u on u.id = m.auth_user_id
    where m.id = p_member_id and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now()) for update of m;
  if not found then
    raise exception using errcode = '22023', message = 'Adhérent actif requis pour la présidence.';
  end if;
  update public.members set role = 'admin' where id = v_actor;
  update public.members set role = 'president' where id = p_member_id;
  insert into public.audit_events (actor_member_id, target_member_id, event_type, payload)
    values (v_actor, p_member_id, 'presidency_transferred',
      jsonb_build_object('previous_president_role', 'admin'));
end;
$$;

create function public.recover_president(p_member_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_previous_president uuid;
begin
  if p_reason is null or char_length(btrim(p_reason)) not between 20 and 500 then
    raise exception using errcode = '22023', message = 'Une raison de reprise explicite est requise (20 à 500 caractères).';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse:identity', 0));
  perform 1 from public.members m join auth.users u on u.id = m.auth_user_id
    where m.id = p_member_id and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now()) for update of m;
  if not found then
    raise exception using errcode = '22023', message = 'Adhérent actif requis pour la présidence.';
  end if;
  select id into v_previous_president from public.members where role = 'president' for update;
  if v_previous_president is distinct from p_member_id then
    update public.members set role = 'admin' where id = v_previous_president;
    update public.members set role = 'president' where id = p_member_id;
  end if;
  insert into public.audit_events (target_member_id, event_type, payload)
    values (p_member_id, 'presidency_recovered',
      jsonb_build_object('previous_president', v_previous_president, 'reason', btrim(p_reason)));
end;
$$;

revoke all on function public.provision_member(uuid, text, text),
  public.bootstrap_president(uuid), public.recover_president(uuid, text),
  public.set_member_role(uuid, public.member_role), public.transfer_presidency(uuid),
  public.touch_updated_at(), public.guard_president_deletion()
  from public, anon, authenticated, service_role;
grant execute on function public.provision_member(uuid, text, text),
  public.bootstrap_president(uuid), public.recover_president(uuid, text) to service_role;
grant execute on function public.set_member_role(uuid, public.member_role),
  public.transfer_presidency(uuid) to authenticated;

commit;
