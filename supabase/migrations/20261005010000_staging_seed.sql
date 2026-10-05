begin;
-- Operator-only provenance. No reset/reseed path: tester edits are retained.
create table public.staging_seed_runs (
  seed text primary key check(seed='ifosse-staging-v1'),
  anchor date not null,
  auth_ids uuid[] not null check(cardinality(auth_ids)=30),
  member_ids uuid[] not null check(cardinality(member_ids)=30),
  session_ids uuid[] not null check(cardinality(session_ids)=7),
  created_at timestamptz not null default now()
);
alter table public.staging_seed_runs enable row level security;
revoke all on public.staging_seed_runs from public,anon,authenticated,service_role;

create function public.staging_seed_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_run public.staging_seed_runs; v_ids uuid[]:='{}'; v_user auth.users; v_email text; i integer;
begin
  -- The gateway verifies this signed service-role JWT. A URL flag alone is not
  -- enough. Opaque keys without a project ref fail closed, even on staging.
  if auth.role() is distinct from 'service_role' or auth.jwt()->>'ref' is distinct from 'btpojwwwsxrepsehmxbm' then
    raise exception using errcode='42501',message='Pinned staging service-role identity required.';
  end if;
  select * into v_run from public.staging_seed_runs where seed='ifosse-staging-v1';
  if found then
    if (select count(*) from public.members where id=any(v_run.member_ids))<>30
      or (select count(*) from public.sessions where id=any(v_run.session_ids))<>7
      or (select count(*) from auth.users where id=any(v_run.auth_ids) and deleted_at is null and raw_app_meta_data->>'ifosse_staging_seed'='ifosse-staging-v1')<>30 then
      raise exception using errcode='22023',message='Seed-owned records missing; inspect without resetting tester data.';
    end if;
    return jsonb_build_object('seed',v_run.seed,'project_ref','btpojwwwsxrepsehmxbm','initialized',true,'anchor',v_run.anchor,'auth_ids',v_run.auth_ids);
  end if;
  -- Refuse to adopt even a same-email profile. The atomic apply creates all
  -- profiles; only marked orphan Auth identities from a failed apply may resume.
  for i in 1..30 loop
    v_email:='plongeur-'||lpad(i::text,2,'0')||'@ifosse-seed.invalid';
    if exists(select 1 from public.members where email=v_email) then
      raise exception using errcode='23505',message='Synthetic email collides with an existing profile.';
    end if;
    select * into v_user from auth.users where lower(email)=v_email;
    if found and (v_user.deleted_at is not null or v_user.banned_until>now() or v_user.raw_app_meta_data->>'ifosse_staging_seed' is distinct from 'ifosse-staging-v1') then
      raise exception using errcode='23505',message='Synthetic email collides with an unowned/inactive Auth identity.';
    end if;
    v_ids:=array_append(v_ids,v_user.id);
  end loop;
  return jsonb_build_object('seed','ifosse-staging-v1','project_ref','btpojwwwsxrepsehmxbm','initialized',false,'auth_ids',v_ids);
end;
$$;

create function public.apply_staging_seed(p_auth_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_status jsonb; v_anchor date:=(now() at time zone 'Europe/Paris')::date;
  v_original_claims text:=current_setting('request.jwt.claims',true);
  v_original_sub text:=current_setting('request.jwt.claim.sub',true);
  v_original_role text:=current_setting('request.jwt.claim.role',true);
  v_members uuid[]:='{}'; v_sessions uuid[]:='{}'; v_member uuid; v_session uuid; v_car uuid;
  i integer; j integer; v_selected integer; v_yes integer; v_capacity integer;
  v_names jsonb:='[["Camille","Bréval"],["Lucien","Montfauvet"],["Élise","Valroche"],["Noémie","Riveclair"],["Bastien","Fontelune"],["Maëlle","Desbrumes"],["Hugo","Vallonnet"],["Inès","Rocbelin"],["Louis","Prévalin"],["Chloé","Bellecombe"],["Gaspard","Aubrelac"],["Léa","Fleurotin"],["Jules","Vauxdoré"],["Manon","Boisréal"],["Arthur","Clairvalet"],["Anna","Merlefont"],["Paul","Verdeline"],["Zoé","Chantelac"],["Gabriel","Ormelune"],["Louise","Rivemer"],["Raphaël","Noirvalet"],["Alice","Brumecourt"],["Martin","Fauvelac"],["Jeanne","Landeval"],["Émile","Roselac"],["Sarah","Montelune"],["Tom","Aubrevaux"],["Nina","Valdorine"],["Adrien","Belorme"],["Clara","Rochebrune"]]';
  v_titles text[]:=array['Historique : reprise','Historique : progression','Bilan récent','20 places, 22 volontaires','Désistement et trajets à reprendre','Sélection republiée','Inscriptions sans publication'];
  v_offsets integer[]:=array[-35,-14,-2,7,21,42,70];
  v_capacities integer[]:=array[18,20,16,20,20,24,12];
  v_volunteers integer[]:=array[20,22,18,22,22,25,16];
  v_confirmed integer[]:=array[16,18,14,20,18,22,12];
begin
  -- Serialize competing operators; recheck every identity before DB writes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse-staging-v1',0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse:identity',0));
  v_status:=public.staging_seed_status();
  if (v_status->>'initialized')::boolean then
    return jsonb_build_object('retained',true,'writes',0,'anchor',v_status->>'anchor');
  end if;
  if p_auth_ids is null or cardinality(p_auth_ids)<>30 or (select count(distinct id) from unnest(p_auth_ids) id)<>30 then
    raise exception using errcode='22023',message='Exactly 30 distinct synthetic identities required.';
  end if;
  for i in 1..30 loop
    if not exists(select 1 from auth.users where id=p_auth_ids[i]
      and email='plongeur-'||lpad(i::text,2,'0')||'@ifosse-seed.invalid'
      and deleted_at is null and (banned_until is null or banned_until<=now())
      and raw_app_meta_data->>'ifosse_staging_seed'='ifosse-staging-v1') then
      raise exception using errcode='22023',message='Seed identity ownership mismatch.';
    end if;
  end loop;
  for i in 1..30 loop
    v_member:=public.provision_member(p_auth_ids[i],v_names->(i-1)->>0,(v_names->(i-1)->>1)||' (fictif)');
    v_members:=array_append(v_members,v_member);
  end loop;
  -- Only this newly created synthetic profile is promoted. Never bootstrap or
  -- transfer the existing presidency, and never adopt a tester's profile.
  update public.members set role='admin' where id=v_members[1];
  insert into public.audit_events(target_member_id,event_type,payload)
    values(v_members[1],'staging_seed_admin_created',jsonb_build_object('seed','ifosse-staging-v1'));
  for i in 1..30 loop
    perform set_config('request.jwt.claim.sub',p_auth_ids[i]::text,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',p_auth_ids[i],'role','authenticated')::text,true);
    perform public.update_own_profile(v_names->(i-1)->>0,(v_names->(i-1)->>1)||' (fictif)',null,
      case when i=1 then 'E3' when i=2 then 'E2' when i%3=0 then 'N2' else 'N1' end,
      case when i%3=1 and i>2 then 'N2' else null end,i<=3,case when i<=3 then i+1 else 0 end,
      case when i<=3 then 'Parvis de la gare — rendez-vous fictif' else '' end);
  end loop;
  perform set_config('request.jwt.claim.sub',p_auth_ids[1]::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_auth_ids[1],'role','authenticated')::text,true);
  for i in 1..30 loop
    perform public.set_member_caci(v_members[i],case i%4 when 0 then null when 1 then v_anchor+365 when 2 then v_anchor+30 else v_anchor-30 end);
  end loop;
  for j in 1..7 loop
    v_capacity:=v_capacities[j]; v_yes:=v_volunteers[j]; v_selected:=v_confirmed[j];
    v_session:=public.save_session(v_anchor+v_offsets[j],'20:00','21:00','[FICTIF] '||v_titles[j],
      'Fosse des Rives — lieu fictif','Adresse fictive : parvis de la fosse',
      'Jeu synthétique ifosse-staging-v1. Aucun adhérent réel. Les inscriptions ne sont pas plafonnées.',v_capacity,true,j=5,false);
    v_sessions:=array_append(v_sessions,v_session);
    for i in 1..30 loop
      perform public.set_session_rsvp(v_session,case when i<=v_yes then 'yes'::public.rsvp_state when i<=v_yes+3 then 'maybe'::public.rsvp_state else 'no'::public.rsvp_state end,v_members[i],true,true);
      perform public.set_payment_status(v_session,v_members[i],case when i<=2 then 'free'::public.payment_state when i%3=0 then 'paid'::public.payment_state else 'unpaid'::public.payment_state end);
      if i<=v_yes+3 then
        perform public.set_draft_selection(v_session,v_members[i],case when i<=v_selected then 'selected'::public.selection_state when i=v_yes then 'declined'::public.selection_state else 'waiting'::public.selection_state end);
      end if;
    end loop;
    if j<>7 then perform public.publish_selection(v_session); end if;
    if j=6 then
      perform public.set_draft_selection(v_session,v_members[22],'waiting');
      perform public.set_draft_selection(v_session,v_members[23],'selected');
      perform public.publish_selection(v_session);
    end if;
    if j=4 then
      for i in 1..20 loop
        perform public.set_draft_palanquee(v_session,v_members[i],1+(i-1)/4,i in(1,5,9,13,17));
      end loop;
      perform public.publish_palanquees(v_session);
      -- Current draft differs without leaking into published occupancy/groups.
      perform public.set_draft_selection(v_session,v_members[20],'waiting');
      perform public.set_draft_selection(v_session,v_members[21],'selected');
      for i in 1..3 loop
        perform set_config('request.jwt.claim.sub',p_auth_ids[i]::text,true);
        perform set_config('request.jwt.claims',jsonb_build_object('sub',p_auth_ids[i],'role','authenticated')::text,true);
        v_car:=public.offer_car(v_session,case i when 1 then 3 when 2 then 4 else 2 end,
          (array['Gare des Rives','Parking du Parc','Place des Tilleuls'])[i]||' — fictif','Trajet synthétique, modifiable pour les essais','18:45');
        for v_member in select unnest(case i when 1 then p_auth_ids[4:6] when 2 then p_auth_ids[7:9] else p_auth_ids[10:10] end) loop
          perform set_config('request.jwt.claim.sub',v_member::text,true);
          perform set_config('request.jwt.claims',jsonb_build_object('sub',v_member,'role','authenticated')::text,true);
          perform public.join_car(v_session,v_car);
        end loop;
      end loop;
    end if;
    if j=5 then
      perform set_config('request.jwt.claim.sub',p_auth_ids[18]::text,true);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',p_auth_ids[18],'role','authenticated')::text,true);
      v_car:=public.offer_car(v_session,2,'Gare du Canal — fictif','Voiture retirée dans le scénario','18:30');
      for i in 19..20 loop
        perform set_config('request.jwt.claim.sub',p_auth_ids[i]::text,true);
        perform set_config('request.jwt.claims',jsonb_build_object('sub',p_auth_ids[i],'role','authenticated')::text,true);
        perform public.join_car(v_session,v_car);
      end loop;
    end if;
    perform set_config('request.jwt.claim.sub',p_auth_ids[1]::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',p_auth_ids[1],'role','authenticated')::text,true);
    if j=5 then perform public.set_session_rsvp(v_session,'no',v_members[18],true,true); end if;
    if j<=3 then
      for i in 1..v_selected loop
        perform public.set_attendance(v_session,v_members[i],case when i=v_selected then 'absent'::public.attendance_state else 'dived'::public.attendance_state end);
      end loop;
      perform public.close_session_bilan(v_session);
    end if;
  end loop;
  insert into public.staging_seed_runs(seed,anchor,auth_ids,member_ids,session_ids)
    values('ifosse-staging-v1',v_anchor,p_auth_ids,v_members,v_sessions);
  insert into public.audit_events(actor_member_id,event_type,payload)
    values(v_members[1],'staging_seed_initialized',jsonb_build_object('seed','ifosse-staging-v1','members',30,'sessions',7,'anchor',v_anchor));
  -- Context switching is confined to owned synthetic actors in this operator
  -- transaction. Restore caller claims before returning; no tokens are issued.
  perform set_config('request.jwt.claims',coalesce(v_original_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(v_original_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(v_original_role,''),true);
  return jsonb_build_object('retained',false,'initialized',true,'anchor',v_anchor);
end;
$$;
revoke all on function public.staging_seed_status(),public.apply_staging_seed(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.staging_seed_status(),public.apply_staging_seed(uuid[]) to service_role;
commit;
