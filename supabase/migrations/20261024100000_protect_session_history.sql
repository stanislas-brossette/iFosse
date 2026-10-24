begin;
-- D035: a session with history (closed bilan, published selection or recorded
-- attendance) is durable. Only sessions created by mistake can still be deleted.
create or replace function public.delete_session(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_session public.sessions;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select * into v_session from public.sessions where id=p_session_id for update;
  if not found then raise exception using errcode='22023',message='Séance introuvable.'; end if;
  -- The session row lock serializes against publication, attendance and closure,
  -- which all lock the same row before writing.
  if v_session.status='closed'
    or exists(select 1 from public.selection_publications where session_id=p_session_id)
    or exists(select 1 from public.session_participations where session_id=p_session_id and attendance_status<>'unknown') then
    raise exception using errcode='22023',message='Cette séance a un historique (sélection publiée ou présences). Elle ne peut plus être supprimée.';
  end if;
  insert into public.audit_events(actor_member_id,session_id,event_type,payload) values(public.current_member_id(),p_session_id,'session_deleted',jsonb_build_object('session_id',p_session_id,'date',v_session.date));
  delete from public.sessions where id=p_session_id;
end;
$$;
commit;
