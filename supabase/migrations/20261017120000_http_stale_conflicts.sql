begin;
-- Application stale-state conflicts are not PostgreSQL serialization failures.
-- Preserve the existing HTTP JSON code/messages while returning 409 without
-- triggering PostgREST 14 transaction retries. Locks, guards and writes stay intact.

create or replace function public.set_member_caci_if_current(p_member_id uuid,p_expiry_date date default null,p_expected_expiry_date date default null) returns void
language plpgsql security definer set search_path='' as $$
declare v_current date;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Droits administrateur requis.'; end if;
  select caci_expiry_date into v_current from public.members where id=p_member_id for update;
  if not found then raise exception using errcode='22023',message='Adhérent introuvable.'; end if;
  if v_current is distinct from p_expected_expiry_date then
    raise sqlstate 'PGRST' using
      message=jsonb_build_object('code','40001','message','CACI_EDIT_CONFLICT','details',null,'hint',null)::text,
      detail='{"status":409,"headers":{}}';
  end if;
  perform public.set_member_caci(p_member_id,p_expiry_date);
end;
$$;

create or replace function public.publish_selection_checked(p_session_id uuid,p_expected_fingerprint text) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare v_preview jsonb;
begin
  -- The preview authorizes and locks before any write; the lock remains held
  -- through the existing transactional publication and audit implementation.
  v_preview:=public.get_selection_publish_preview(p_session_id);
  if p_expected_fingerprint is null or p_expected_fingerprint<>v_preview->>'fingerprint' then
    raise sqlstate 'PGRST' using
      message=jsonb_build_object('code','40001','message','SELECTION_PREVIEW_STALE','details',null,'hint',null)::text,
      detail='{"status":409,"headers":{}}';
  end if;
  return public.publish_selection(p_session_id);
end;
$$;

create or replace function public.mark_confirmed_attendance(p_session_id uuid,p_expected_fingerprint text) returns integer
language plpgsql volatile security definer set search_path='' as $$
declare v_preview jsonb; v_row jsonb;
begin
  -- Authorization, open/ended checks and lock precede every write. The preview
  -- and mutations share one transaction; audit failures roll back the full lot.
  v_preview:=public.get_attendance_batch_preview(p_session_id);
  if p_expected_fingerprint is null or p_expected_fingerprint<>v_preview->>'fingerprint' then
    raise sqlstate 'PGRST' using
      message=jsonb_build_object('code','40001','message','ATTENDANCE_PREVIEW_STALE','details',null,'hint',null)::text,
      detail='{"status":409,"headers":{}}';
  end if;
  for v_row in select value from jsonb_array_elements(v_preview->'rows') loop
    perform public.set_attendance(p_session_id,(v_row->>'member_id')::uuid,'dived');
  end loop;
  -- No automatic closure: the existing closure checks every confirmed
  -- attendance and total diver capacity, including individual replacements.
  return (v_preview->>'member_count')::integer;
end;
$$;

create or replace function public.transfer_presidency_if_current(p_member_id uuid,p_expected_updated_at timestamptz) returns void
language plpgsql volatile security definer set search_path='' as $$
declare v_updated_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifosse:identity',0));
  if not public.is_president() then
    raise exception using errcode='42501',message='Seul le président peut transférer la présidence.';
  end if;
  if p_member_id is null or p_member_id=public.current_member_id() or p_expected_updated_at is null then
    raise exception using errcode='22023',message='Choisissez un autre adhérent.';
  end if;
  select updated_at into v_updated_at from public.members where id=p_member_id for update;
  if not found then raise exception using errcode='22023',message='SUCCESSOR_UNAVAILABLE'; end if;
  if v_updated_at is distinct from p_expected_updated_at then
    raise sqlstate 'PGRST' using
      message=jsonb_build_object('code','40001','message','SUCCESSOR_CHANGED','details',null,'hint',null)::text,
      detail='{"status":409,"headers":{}}';
  end if;
  perform public.transfer_presidency(p_member_id);
end;
$$;

commit;
