begin;
-- The preview is privileged, read-only and shares the session lock used by all
-- selection/RSVP/capacity writes. VOLATILE gives fresh reads after lock waits.
create function public.get_selection_publish_preview(p_session_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_session public.sessions; v_result jsonb; v_basis jsonb;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select * into v_session from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if v_session.status='closed' then raise exception using errcode='22023',message='Rouvrez le bilan avant de modifier cette séance.'; end if;
  select jsonb_build_object('capacity',v_session.capacity,'status',v_session.status,
    'publication', (select id from public.selection_publications where session_id=p_session_id order by version desc limit 1),
    'draft',exists(select 1 from public.selection_drafts where session_id=p_session_id),
    'draft_rows',coalesce((select jsonb_agg(jsonb_build_array(member_id,state,updated_at) order by member_id) from public.selection_draft where session_id=p_session_id),'[]'::jsonb),
    'responses',coalesce((select jsonb_agg(jsonb_build_array(member_id,rsvp,rsvp_revision) order by member_id) from public.session_participations where session_id=p_session_id),'[]'::jsonb)) into v_basis;
  select jsonb_build_object('publication_version',coalesce(max(c.publication_version),0),'capacity',v_session.capacity,
    'rows',coalesce(jsonb_agg(jsonb_build_object('member_id',c.member_id,'first_name',c.first_name,'last_name',c.last_name,'published_state',c.state,
      'draft_state',case when c.rsvp not in ('yes','maybe') then 'none'
        when exists(select 1 from public.selection_drafts where session_id=p_session_id) then coalesce(d.state::text,'waiting')
        when c.state in ('selected','declined') then c.state else 'waiting' end) order by c.last_name,c.first_name,c.member_id),'[]'::jsonb)) into v_result
    from public.get_current_selection(p_session_id) c left join public.selection_draft d on d.session_id=p_session_id and d.member_id=c.member_id;
  -- Empty populations still report an existing publication's version.
  v_result:=jsonb_set(v_result,'{publication_version}',to_jsonb(coalesce((select max(version) from public.selection_publications where session_id=p_session_id),0)));
  return v_result || jsonb_build_object('fingerprint',md5((v_basis || v_result)::text));
end;
$$;
create function public.publish_selection_checked(p_session_id uuid,p_expected_fingerprint text) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare v_preview jsonb;
begin
  -- The preview authorizes and locks before any write; the lock remains held
  -- through the existing transactional publication and audit implementation.
  v_preview:=public.get_selection_publish_preview(p_session_id);
  if p_expected_fingerprint is null or p_expected_fingerprint<>v_preview->>'fingerprint' then
    raise exception using errcode='40001',message='SELECTION_PREVIEW_STALE';
  end if;
  return public.publish_selection(p_session_id);
end;
$$;
revoke all on function public.get_selection_publish_preview(uuid),public.publish_selection_checked(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.get_selection_publish_preview(uuid),public.publish_selection_checked(uuid,text) to authenticated;
comment on function public.get_selection_publish_preview(uuid) is 'Admin-only read-only nominal publication comparison; no private draft is exposed to members.';
commit;
