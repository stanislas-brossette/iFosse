begin;

alter table public.members add column disabled_at timestamptz;
alter table public.members add constraint members_president_active
  check (role <> 'president' or disabled_at is null);
comment on column public.members.disabled_at is
  'President-managed access suspension. History and roles retained; NULL is active.';

create or replace function public.current_member_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.members m join auth.users u on u.id = m.auth_user_id
  where m.auth_user_id = auth.uid() and m.disabled_at is null
    and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
$$;

-- Auth calls this before EVERY token issuance (magic link and refresh). RLS
-- independently denies old access tokens as soon as disabled_at is committed.
-- Preserve the original claims; no role claims or public signup are introduced.
create function public.member_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.members where auth_user_id = (event->>'user_id')::uuid and disabled_at is not null) then
    return jsonb_build_object('error', jsonb_build_object('http_code',403,'message','Compte désactivé. Contactez le président du club.'));
  end if;
  return event;
end;
$$;
revoke all on function public.member_access_token_hook(jsonb) from public, anon, authenticated, service_role;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.member_access_token_hook(jsonb) to supabase_auth_admin;

create function public.set_member_active(p_member_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_member public.members%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse:identity',0));
  v_actor := public.current_member_id();
  if not public.is_president() then
    raise exception using errcode='42501', message='Seul le président peut gérer les accès.';
  end if;
  if p_member_id is null or p_active is null then
    raise exception using errcode='22023', message='Adhérent et état requis.';
  end if;
  select * into v_member from public.members where id=p_member_id for update;
  if not found then raise exception using errcode='22023', message='Adhérent introuvable.'; end if;
  if v_member.role='president' and not p_active then
    raise exception using errcode='23514', message='Transférez la présidence avant toute désactivation.';
  end if;
  if (v_member.disabled_at is null)=p_active then return; end if;
  update public.members set disabled_at=case when p_active then null else now() end where id=p_member_id;
  insert into public.audit_events(actor_member_id,target_member_id,event_type,payload)
    values(v_actor,p_member_id,case when p_active then 'member_reactivated' else 'member_deactivated' end,
      jsonb_build_object('previous_disabled_at',v_member.disabled_at));
end;
$$;
revoke all on function public.set_member_active(uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.set_member_active(uuid,boolean) to authenticated;

-- Finalize the Auth Admin operation under the caller's JWT. Auth app_metadata is
-- writable only by the privileged Auth API; browser user_metadata is irrelevant.
create function public.create_member_from_identity(p_auth_user_id uuid,p_request_id uuid,p_first_name text,p_last_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_user auth.users%rowtype; v_member uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse:identity',0));
  v_actor := public.current_member_id();
  if not public.is_president() then raise exception using errcode='42501',message='Seul le président peut créer un adhérent.'; end if;
  select * into v_user from auth.users where id=p_auth_user_id;
  if not found or p_request_id is null or v_user.email_confirmed_at is null or v_user.deleted_at is not null
    or (v_user.banned_until is not null and v_user.banned_until>now())
    or v_user.raw_app_meta_data->>'ifosse_creation_actor' is distinct from auth.uid()::text
    or v_user.raw_app_meta_data->>'ifosse_creation_request' is distinct from p_request_id::text then
    raise exception using errcode='42501',message='Identité de création non autorisée.';
  end if;
  select id into v_member from public.members where auth_user_id=p_auth_user_id or email=lower(btrim(v_user.email));
  if found then
    if exists(select 1 from public.audit_events where event_type='member_created_by_president'
      and actor_member_id=v_actor and target_member_id=v_member and payload->>'request_id'=p_request_id::text) then return v_member; end if;
    raise exception using errcode='23505',message='Email déjà utilisé.';
  end if;
  if p_first_name is null or p_last_name is null or p_first_name ~ '[[:cntrl:]]' or p_last_name ~ '[[:cntrl:]]' then
    raise exception using errcode='22023',message='Nom invalide.';
  end if;
  v_member := public.provision_member(p_auth_user_id,p_first_name,p_last_name);
  insert into public.audit_events(actor_member_id,target_member_id,event_type,payload)
    values(v_actor,v_member,'member_created_by_president',jsonb_build_object('request_id',p_request_id));
  return v_member;
end;
$$;
revoke all on function public.create_member_from_identity(uuid,uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.create_member_from_identity(uuid,uuid,text,text) to authenticated;

commit;
