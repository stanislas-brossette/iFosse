begin;
-- VOLATILE queries read fresh state after the session lock is acquired. All
-- application selection, attendance and closure writes use this same lock.
create function public.get_attendance_batch_preview(p_session_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_session public.sessions; v_rows jsonb; v_basis jsonb;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select * into v_session from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  if v_session.status='closed' then raise exception using errcode='22023',message='Rouvrez le bilan avant de corriger les présences.'; end if;
  if not public.session_has_ended(v_session.date,v_session.end_time) then raise exception using errcode='22023',message='Les présences se renseignent après la séance.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('member_id',m.id,'first_name',m.first_name,'last_name',m.last_name) order by m.last_name,m.first_name,m.id),'[]'::jsonb) into v_rows
    from public.current_selected_ids(p_session_id) c join public.members m on m.id=c.member_id
    left join public.session_participations p on p.session_id=p_session_id and p.member_id=c.member_id
    where coalesce(p.attendance_status,'unknown')='unknown';
  select jsonb_build_object('date',v_session.date,'end_time',v_session.end_time,'status',v_session.status,'capacity',v_session.capacity,
    'publication',(select id from public.selection_publications where session_id=p_session_id order by version desc limit 1),
    'confirmed',coalesce((select jsonb_agg(member_id order by member_id) from public.current_selected_ids(p_session_id)),'[]'::jsonb),
    'attendance',coalesce((select jsonb_agg(jsonb_build_array(member_id,attendance_status,rsvp,rsvp_revision) order by member_id) from public.session_participations where session_id=p_session_id),'[]'::jsonb),
    -- Detect corrections/close-reopen even if the values later return to their
    -- earlier state. Payment values and private draft values are excluded;
    -- a newly created participation row conservatively requires a new preview.
    'attendance_revision',(select count(*) from public.audit_events where session_id=p_session_id and event_type in ('attendance_changed','bilan_closed','bilan_reopened')),
    'rows',v_rows) into v_basis;
  return jsonb_build_object('rows',v_rows,'member_count',jsonb_array_length(v_rows),'fingerprint',md5(v_basis::text));
end;
$$;
create function public.mark_confirmed_attendance(p_session_id uuid,p_expected_fingerprint text) returns integer
language plpgsql volatile security definer set search_path='' as $$
declare v_preview jsonb; v_row jsonb;
begin
  -- Authorization, open/ended checks and lock precede every write. The preview
  -- and mutations share one transaction; audit failures roll back the full lot.
  v_preview:=public.get_attendance_batch_preview(p_session_id);
  if p_expected_fingerprint is null or p_expected_fingerprint<>v_preview->>'fingerprint' then
    raise exception using errcode='40001',message='ATTENDANCE_PREVIEW_STALE';
  end if;
  for v_row in select value from jsonb_array_elements(v_preview->'rows') loop
    perform public.set_attendance(p_session_id,(v_row->>'member_id')::uuid,'dived');
  end loop;
  -- No automatic closure: the existing closure checks every confirmed
  -- attendance and total diver capacity, including individual replacements.
  return (v_preview->>'member_count')::integer;
end;
$$;
revoke all on function public.get_attendance_batch_preview(uuid),public.mark_confirmed_attendance(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.get_attendance_batch_preview(uuid),public.mark_confirmed_attendance(uuid,text) to authenticated;
comment on function public.mark_confirmed_attendance(uuid,text) is 'Admin-only atomic attendance for unknown effectively published confirmations; explicit preview, audit, no automatic closure.';
commit;
