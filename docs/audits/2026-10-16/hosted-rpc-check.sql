-- Read-only audit of every RPC/argument combination used by master f01b189.
-- Run in the SQL Editor of the project used by the site. Does not mutate anything.
begin read only;
set local search_path=pg_catalog;
with expected(name,args,expected_result,expected_signature) as (values
('close_session_bilan',array['p_session_id']::text[],'void','p_session_id uuid'),
('create_member_from_identity',array['p_auth_user_id','p_first_name','p_last_name','p_request_id']::text[],'uuid','p_auth_user_id uuid, p_request_id uuid, p_first_name text, p_last_name text'),
('delete_session',array['p_session_id']::text[],'void','p_session_id uuid'),
('discard_palanquee_draft',array['p_session_id']::text[],'void','p_session_id uuid'),
('discard_selection_draft',array['p_session_id']::text[],'void','p_session_id uuid'),
('get_admin_readiness',array['p_session_id']::text[],'TABLE(member_id uuid, selection_state text, caci_status text, transport_mode public.transport_state, payment_status public.payment_state, selection_ready boolean, caci_ready boolean, transport_ready boolean, payment_ready boolean, selection_basis text, transport_provisional boolean)','p_session_id uuid'),
('get_admin_session_responses',array['p_session_id']::text[],'TABLE(member_id uuid, first_name text, last_name text, current_level text, preparing_level text, rsvp public.rsvp_state)','p_session_id uuid'),
('get_attendance_batch_preview',array['p_session_id']::text[],'jsonb','p_session_id uuid'),
('get_bilan_state',array['p_session_id']::text[],'TABLE(session_ended boolean, dived_count bigint, unknown_selected_count bigint)','p_session_id uuid'),
('get_car_offers',array['p_session_id']::text[],'TABLE(id uuid, driver_member_id uuid, first_name text, last_name text, passenger_capacity integer, occupied bigint, meeting_point text, departure_time time without time zone, note text)','p_session_id uuid'),
('get_current_palanquees',array['p_session_id']::text[],'TABLE(member_id uuid, first_name text, last_name text, current_level text, preparing_level text, group_number integer, is_leader boolean, publication_id uuid, publication_version integer, selection_publication_id uuid, selection_version integer, needs_review boolean)','p_session_id uuid'),
('get_current_selection',array['p_session_id']::text[],'TABLE(member_id uuid, first_name text, last_name text, current_level text, preparing_level text, rsvp public.rsvp_state, state text, publication_id uuid, publication_version integer, registered_at timestamp with time zone)','p_session_id uuid'),
('get_palanquee_state',array['p_session_id']::text[],'TABLE(publication_id uuid, publication_version integer, selection_publication_id uuid, selection_version integer, needs_review boolean)','p_session_id uuid'),
('get_rsvp_change_consequences',array['p_member_id','p_session_id']::text[],'TABLE(selected boolean, passengers bigint)','p_session_id uuid, p_member_id uuid'),
('get_season_counts',array['p_start_year']::text[],'TABLE(member_id uuid, first_name text, last_name text, completed_count bigint)','p_start_year integer'),
('get_selection_publish_preview',array['p_session_id']::text[],'jsonb','p_session_id uuid'),
('get_session_attendance',array['p_session_id']::text[],'TABLE(member_id uuid, first_name text, last_name text, attendance_status public.attendance_state)','p_session_id uuid'),
('get_session_card_summaries',array['p_start_year']::text[],'TABLE(session_id uuid, capacity integer, publication_version integer, confirmed_count bigint, my_rsvp public.rsvp_state, my_selection_state text, my_transport_mode public.transport_state, my_transport_provisional boolean, my_payment_status public.payment_state)','p_start_year integer'),
('get_session_responses',array['p_session_id']::text[],'TABLE(member_id uuid, first_name text, last_name text, current_level text, preparing_level text, rsvp public.rsvp_state)','p_session_id uuid'),
('get_session_transport',array['p_session_id']::text[],'TABLE(member_id uuid, first_name text, last_name text, mode public.transport_state, car_offer_id uuid)','p_session_id uuid'),
('is_president',array[]::text[],'boolean',''),
('join_car',array['p_car_offer_id','p_session_id']::text[],'void','p_session_id uuid, p_car_offer_id uuid'),
('mark_confirmed_attendance',array['p_expected_fingerprint','p_session_id']::text[],'integer','p_session_id uuid, p_expected_fingerprint text'),
('offer_car',array['p_departure_time','p_meeting_point','p_note','p_passenger_capacity','p_session_id']::text[],'uuid','p_session_id uuid, p_passenger_capacity integer, p_meeting_point text, p_note text, p_departure_time time without time zone'),
('publish_palanquees',array['p_session_id']::text[],'uuid','p_session_id uuid'),
('publish_selection_checked',array['p_expected_fingerprint','p_session_id']::text[],'uuid','p_session_id uuid, p_expected_fingerprint text'),
('reopen_session_bilan',array['p_session_id']::text[],'void','p_session_id uuid'),
('save_own_car_defaults',array['p_meeting_point','p_passenger_seats']::text[],'void','p_passenger_seats integer, p_meeting_point text'),
('save_session',array['p_address','p_capacity','p_date','p_end_time','p_end_time_estimated','p_id','p_notes','p_registration_open','p_school_holiday','p_start_time','p_title','p_venue']::text[],'uuid','p_date date, p_start_time time without time zone, p_end_time time without time zone, p_title text, p_venue text, p_address text, p_notes text, p_capacity integer, p_registration_open boolean, p_school_holiday boolean, p_end_time_estimated boolean, p_id uuid'),
('set_attendance',array['p_member_id','p_session_id','p_status']::text[],'void','p_session_id uuid, p_member_id uuid, p_status public.attendance_state'),
('set_draft_palanquee',array['p_group_number','p_is_leader','p_member_id','p_session_id']::text[],'void','p_session_id uuid, p_member_id uuid, p_group_number integer, p_is_leader boolean'),
('set_draft_selection',array['p_member_id','p_session_id','p_state']::text[],'void','p_session_id uuid, p_member_id uuid, p_state public.selection_state'),
('set_member_active',array['p_active','p_member_id']::text[],'void','p_member_id uuid, p_active boolean'),
('set_member_caci_if_current',array['p_expected_expiry_date','p_expiry_date','p_member_id']::text[],'void','p_member_id uuid, p_expiry_date date, p_expected_expiry_date date'),
('set_member_role',array['p_member_id','p_role']::text[],'void','p_member_id uuid, p_role public.member_role'),
('set_own_transport',array['p_mode','p_session_id']::text[],'void','p_session_id uuid, p_mode public.transport_state'),
('set_payment_status',array['p_member_id','p_session_id','p_status']::text[],'void','p_session_id uuid, p_member_id uuid, p_status public.payment_state'),
('set_session_rsvp',array['p_confirm_caci_warning','p_confirm_withdrawal','p_member_id','p_rsvp','p_session_id']::text[],'void','p_session_id uuid, p_rsvp public.rsvp_state, p_member_id uuid, p_confirm_caci_warning boolean, p_confirm_withdrawal boolean'),
('transfer_presidency_if_current',array['p_expected_updated_at','p_member_id']::text[],'void','p_member_id uuid, p_expected_updated_at timestamp with time zone'),
('update_own_profile',array['p_current_level','p_first_name','p_has_usual_car','p_last_name','p_phone','p_preparing_level','p_usual_meeting_point','p_usual_passenger_seats']::text[],'void','p_first_name text, p_last_name text, p_phone text, p_current_level text, p_preparing_level text, p_has_usual_car boolean, p_usual_passenger_seats integer, p_usual_meeting_point text')
), contract as (select e.*,p.oid,p.prosecdef,p.proconfig,pg_get_function_result(p.oid) as server_result,pg_get_function_identity_arguments(p.oid) as server_signature from expected e left join pg_proc p on p.pronamespace='public'::regnamespace and p.proname=e.name and e.args <@ coalesce(p.proargnames[1:p.pronargs],array[]::text[]) and coalesce(p.proargnames[1:p.pronargs-p.pronargdefaults],array[]::text[]) <@ e.args)
select '1_RPC' as category,name as object_name,
 case when oid is null then 'MISSING_OR_WRONG_ARGUMENTS'
      when server_signature<>expected_signature then 'INCOMPATIBLE_ARGUMENT_TYPES'
      when server_result<>expected_result then 'INCOMPATIBLE_RETURN_TYPE'
      when not has_function_privilege('authenticated',oid,'EXECUTE') then 'AUTHENTICATED_EXECUTE_MISSING'
      when has_function_privilege('anon',oid,'EXECUTE') then 'UNEXPECTED_ANON_EXECUTE'
      else 'OK' end as status,
 jsonb_build_object('frontend_arguments',args,'expected_signature',expected_signature,'server_signature',server_signature,'expected_result',expected_result,'server_result',server_result) as details
from contract
union all
select '2_RLS',c.relname,
 case when c.relrowsecurity then 'OK' else 'RLS_DISABLED' end,
 jsonb_build_object('rls_enabled',c.relrowsecurity)
from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r'
union all
-- Trigger/event-trigger functions are infrastructure, not directly callable RPCs.
-- In particular, Supabase's rls_auto_enable() returns event_trigger.
-- Filter by return type, never by name: a normal callable function with that
-- name must still be reported if anonymously executable.
select '3_ANONYMOUS',p.proname,'UNEXPECTED_ANON_EXECUTE',
 jsonb_build_object('signature',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid))
from pg_proc p where p.pronamespace='public'::regnamespace
 and p.prorettype not in ('trigger'::regtype,'event_trigger'::regtype)
 and has_function_privilege('anon',p.oid,'EXECUTE')
order by category,object_name;
commit;
