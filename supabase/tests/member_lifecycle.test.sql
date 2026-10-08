begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(has_function_privilege('supabase_auth_admin','public.member_access_token_hook(jsonb)','EXECUTE'),'Only Auth service can use hook');
select ok(not has_function_privilege('service_role','public.member_access_token_hook(jsonb)','EXECUTE'),'Operator service API cannot invoke hook');
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('06000000-0000-4000-8000-000000000001','president.lifecycle@example.test',now(),'{}'),
 ('06000000-0000-4000-8000-000000000002','admin.lifecycle@example.test',now(),'{}'),
 ('06000000-0000-4000-8000-000000000003','member.lifecycle@example.test',now(),'{}'),
 ('06000000-0000-4000-8000-000000000004','created.lifecycle@example.test',now(),'{"ifosse_creation_actor":"06000000-0000-4000-8000-000000000001","ifosse_creation_request":"06000000-0000-4000-8000-000000000099"}'),
 ('06000000-0000-4000-8000-000000000005','unowned.lifecycle@example.test',now(),'{}');
update auth.users set raw_user_meta_data='{"ifosse_creation_actor":"06000000-0000-4000-8000-000000000001","ifosse_creation_request":"06000000-0000-4000-8000-000000000099"}' where id='06000000-0000-4000-8000-000000000005';
create temp table lifecycle_people(label text,id uuid);
grant select on lifecycle_people to authenticated,service_role,supabase_auth_admin;
insert into lifecycle_people values
 ('president',public.provision_member('06000000-0000-4000-8000-000000000001','Président','Cycle')),
 ('admin',public.provision_member('06000000-0000-4000-8000-000000000002','Admin','Cycle')),
 ('member',public.provision_member('06000000-0000-4000-8000-000000000003','Membre','Cycle'));
-- Isolated rollback fixtures may coexist with a development President.
update public.members set role='admin' where role='president';
update public.members set role='president' where id=(select id from lifecycle_people where label='president');
update public.members set role='admin' where id=(select id from lifecycle_people where label='admin');
select ok((select bool_and(disabled_at is null) from public.members),'Existing profiles migrate active');
set local role authenticated;
select set_config('request.jwt.claim.sub','06000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.set_member_active((select id from lifecycle_people where label='member'),false)$$,'42501',null,'Admin cannot deactivate');
select throws_ok($$select public.create_member_from_identity('06000000-0000-4000-8000-000000000004','06000000-0000-4000-8000-000000000099','Nouveau','Cycle')$$,'42501',null,'Admin cannot create');
select set_config('request.jwt.claim.sub','06000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.set_member_active((select id from lifecycle_people where label='member'),false)$$,'42501',null,'Member cannot deactivate');
select throws_ok($$select public.set_member_active((select id from lifecycle_people where label='member'),true)$$,'42501',null,'Member cannot reactivate');
select throws_ok($$select public.create_member_from_identity('06000000-0000-4000-8000-000000000004','06000000-0000-4000-8000-000000000099','Nouveau','Cycle')$$,'42501',null,'Member cannot create');
select is((select count(*) from public.members),1::bigint,'Member cannot access directory');
select throws_ok($$select public.member_access_token_hook('{}')$$,'42501',null,'Browser cannot invoke Auth hook');
select set_config('request.jwt.claim.sub','06000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.set_member_active((select id from lifecycle_people where label='president'),false)$$,'23514',null,'Only President cannot deactivate self');
select throws_ok($$select public.set_member_role((select id from lifecycle_people where label='president'),'member')$$,'23514',null,'Only President cannot demote self');
select throws_ok($$select public.create_member_from_identity('06000000-0000-4000-8000-000000000005','06000000-0000-4000-8000-000000000099','Nouveau','Cycle')$$,'42501',null,'Cannot link arbitrary operator/tester/seed identities');
select throws_ok($$select public.create_member_from_identity('06000000-0000-4000-8000-000000000004','06000000-0000-4000-8000-000000000098','Nouveau','Cycle')$$,'42501',null,'Cannot claim another request');
select lives_ok($$select public.create_member_from_identity('06000000-0000-4000-8000-000000000004','06000000-0000-4000-8000-000000000099','Nouveau','Cycle')$$,'President creates member through owned Auth identity');
select is((select role::text from public.members where auth_user_id='06000000-0000-4000-8000-000000000004'),'member','Created account always member');
select lives_ok($$select public.create_member_from_identity('06000000-0000-4000-8000-000000000004','06000000-0000-4000-8000-000000000099','Different','Name')$$,'Same operation is idempotent');
select is((select count(*) from public.audit_events where event_type='member_created_by_president' and actor_member_id=(select id from lifecycle_people where label='president')),1::bigint,'Creation audited once');
select is((select first_name from public.members where auth_user_id='06000000-0000-4000-8000-000000000004'),'Nouveau','Retry never overwrites profile');
reset role;
-- Representative history uses actual business APIs before suspension.
create temp table lifecycle_session(id uuid);
grant select,insert on lifecycle_session to authenticated;
set local role authenticated;
insert into lifecycle_session select public.save_session('2025-10-01','20:00','21:00','Cycle','Piscine','Adresse','',20,true,false,false);
select public.set_session_rsvp((select id from lifecycle_session),'yes',(select id from lifecycle_people where label='member'),true);
select public.set_draft_selection((select id from lifecycle_session),(select id from lifecycle_people where label='member'),'selected');
select public.publish_selection((select id from lifecycle_session));
select public.set_draft_palanquee((select id from lifecycle_session),(select id from lifecycle_people where label='member'),1,false);
select public.publish_palanquees((select id from lifecycle_session));
select public.set_payment_status((select id from lifecycle_session),(select id from lifecycle_people where label='member'),'paid');
select public.set_attendance((select id from lifecycle_session),(select id from lifecycle_people where label='member'),'dived');
select public.close_session_bilan((select id from lifecycle_session));
select lives_ok($$select public.set_member_active((select id from lifecycle_people where label='member'),false)$$,'President deactivates member');
select lives_ok($$select public.set_member_active((select id from lifecycle_people where label='member'),false)$$,'Repeated deactivation is idempotent');
select is((select count(*) from public.audit_events where event_type='member_deactivated' and target_member_id=(select id from lifecycle_people where label='member')),1::bigint,'Suspension audited once');
select is((select attendance_status::text from public.session_participations where session_id=(select id from lifecycle_session) and member_id=(select id from lifecycle_people where label='member')),'dived','Attendance preserved');
select is((select payment_status::text from public.session_participations where session_id=(select id from lifecycle_session) and member_id=(select id from lifecycle_people where label='member')),'paid','Payment preserved');
select is((select count(*) from public.selection_publication_members where member_id=(select id from lifecycle_people where label='member')),1::bigint,'Published selection preserved');
select is((select count(*) from public.palanquee_publication_members where member_id=(select id from lifecycle_people where label='member')),1::bigint,'Published palanquée preserved');
select is((select completed_count from public.get_season_counts(2025) where member_id=(select id from lifecycle_people where label='member')),1::bigint,'Inactive historical attendance still counts');
select set_config('request.jwt.claim.sub','06000000-0000-4000-8000-000000000003',true);
select is(public.current_member_id(),null::uuid,'Old JWT loses access immediately');
select is((select count(*) from public.sessions),0::bigint,'Old JWT cannot read sessions');
select is((select count(*) from public.members),0::bigint,'Old JWT cannot read profiles');
select throws_ok($$select public.set_session_rsvp((select id from lifecycle_session),'no',(select id from lifecycle_people where label='member'))$$,'42501',null,'Old JWT cannot mutate participation');
reset role;

select is(public.member_access_token_hook('{"user_id":"06000000-0000-4000-8000-000000000003","claims":{},"authentication_method":"magiclink"}')->'error'->>'http_code','403','Hook denies inactive magic-link token');
select is(public.member_access_token_hook('{"user_id":"06000000-0000-4000-8000-000000000003","claims":{},"authentication_method":"token_refresh"}')->'error'->>'http_code','403','Hook denies refresh');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','06000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.set_member_active((select id from lifecycle_people where label='member'),true)$$,'President reactivates');
select lives_ok($$select public.set_member_active((select id from lifecycle_people where label='member'),true)$$,'Reactivation idempotent');
select is((select count(*) from public.audit_events where event_type='member_reactivated' and target_member_id=(select id from lifecycle_people where label='member')),1::bigint,'Reactivation audited');
select public.set_member_active((select id from lifecycle_people where label='admin'),false);
select throws_ok($$select public.transfer_presidency((select id from lifecycle_people where label='admin'))$$,'22023','SUCCESSOR_UNAVAILABLE','Cannot transfer Presidency to suspended account');
select ok(public.is_president(),'Rejected transfer preserves current President');
select throws_ok($$select public.set_member_active((select id from lifecycle_people where label='member'),null)$$,'22023',null,'Null access state rejected');
select set_config('request.jwt.claim.sub','06000000-0000-4000-8000-000000000002',true);
select ok(not public.is_admin(),'Suspended admin loses all admin authority');
select throws_ok($$select public.set_member_caci((select id from lifecycle_people where label='member'),date '2030-01-01')$$,'42501',null,'Suspended admin cannot edit CACI');
reset role;
select throws_ok($$update public.members set role='president' where id=(select id from lifecycle_people where label='admin')$$,'23514',null,'Constraint rejects inactive President even for trusted SQL');

select is(public.member_access_token_hook('{"user_id":"06000000-0000-4000-8000-000000000003","claims":{"kept":"exact"}}'),'{"user_id":"06000000-0000-4000-8000-000000000003","claims":{"kept":"exact"}}'::jsonb,'Reactivation allows original claims unchanged');
reset role;
select * from finish();
rollback;
