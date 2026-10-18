begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at) values
('a8100000-0000-4000-8000-000000000001','inbox.admin@example.test',now()),
('a8100000-0000-4000-8000-000000000002','inbox.member@example.test',now()),
('a8100000-0000-4000-8000-000000000003','inbox.maybe@example.test',now()),
('a8100000-0000-4000-8000-000000000004','inbox.no@example.test',now());
select public.provision_member(id,'Fictif','Notifications') from auth.users where email like 'inbox.%';
update public.members set role='admin' where email='inbox.admin@example.test';
create temp table people as select id,email from public.members where email like 'inbox.%';
create temp table fixture(session_id uuid,car_id uuid);
grant select on people to authenticated;
grant all on fixture to authenticated;
select is((select enabled from public.app_notification_settings),false,'Migration is disabled by default');
set local role authenticated;
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000001',true);
insert into fixture(session_id) select public.save_session('2030-10-01','21:00','22:00','Fosse fictive','','','',20,true,false,false);
select public.set_session_rsvp((select session_id from fixture),'yes');
select public.set_session_rsvp((select session_id from fixture),'yes',(select id from people where email='inbox.member@example.test'));
select public.set_session_rsvp((select session_id from fixture),'maybe',(select id from people where email='inbox.maybe@example.test'));
select public.set_session_rsvp((select session_id from fixture),'no',(select id from people where email='inbox.no@example.test'));
select public.set_member_caci((select id from people where email='inbox.member@example.test'),'2030-12-01');
select is((select count(*) from public.app_notifications),0::bigint,'Disabled feature creates no notices');
select is(public.get_my_notifications()->>'enabled','false','Disabled inbox can be detected by old/new frontend');
select throws_ok($$update public.app_notification_settings set enabled=true$$,'42501',null,'Browser admin cannot activate feature');
select throws_ok($$select public.enqueue_app_notification(public.current_member_id(),'caci_updated',null,gen_random_uuid(),'Fake','Fake')$$,'42501',null,'Browser cannot forge notification');
reset role;
update public.app_notification_settings set enabled=true;
set local role authenticated;
select public.set_draft_selection((select session_id from fixture),(select id from people where email='inbox.member@example.test'),'selected');
select is((public.get_my_notifications()->>'unread_count')::int,0,'Draft creates no notice');
select public.publish_selection((select session_id from fixture));
select is((select count(*) from public.app_notifications),0::bigint,'Actor receives no own-action notice and cannot see others');
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000002',true);
select is((public.get_my_notifications()->>'unread_count')::int,1,'Yes member receives first publication');
select alike(public.get_my_notifications()->'items'->0->>'message','%confirmé%','Selected result is described');
select is((select count(*) from public.app_notifications),1::bigint,'RLS exposes only own inbox');
select throws_ok($$update public.app_notifications set read_at=now()$$,'42501',null,'Direct update is forbidden');
select public.mark_app_notifications_read(array(select id from public.app_notifications));
select public.mark_app_notifications_read(array(select id from public.app_notifications));
select is((public.get_my_notifications()->>'unread_count')::int,0,'Marking own notice read is idempotent');
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000003',true);
select is((public.get_my_notifications()->>'unread_count')::int,1,'Maybe member receives first publication');
select alike(public.get_my_notifications()->'items'->0->>'message','%en attente%','Waiting result is described');
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000004',true);
select is((public.get_my_notifications()->>'unread_count')::int,0,'No member receives no publication notice');
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000001',true);
select public.publish_selection((select session_id from fixture));
reset role;
select is((select count(*) from public.app_notifications),2::bigint,'Unchanged republication sends nothing');
set local role authenticated;
select public.set_draft_selection((select session_id from fixture),(select id from people where email='inbox.member@example.test'),'declined');
select public.publish_selection((select session_id from fixture));
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000002',true);
select is((public.get_my_notifications()->>'unread_count')::int,1,'Only changed result is notified on republication');
select alike(public.get_my_notifications()->'items'->0->>'message','%non retenu%','Changed result is explicit');
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000001',true);
select public.set_member_caci((select id from people where email='inbox.member@example.test'),'2031-12-01');
select public.set_member_caci((select id from people where email='inbox.member@example.test'),'2031-12-01');
select public.set_member_caci(public.current_member_id(),'2031-12-01');
reset role;
select is((select count(*) from public.app_notifications where kind='caci_updated'),1::bigint,'Only real CACI changes by another person produce a notice');
select unalike((select message from public.app_notifications where kind='caci_updated'),'%2031%','CACI notice contains no medical date');
set local role authenticated;
-- Restore passenger eligibility and create a real carpool through business APIs.
select public.set_draft_selection((select session_id from fixture),(select id from people where email='inbox.member@example.test'),'selected');
select public.publish_selection((select session_id from fixture));
update fixture set car_id=public.offer_car(session_id,2,'Mairie','','20:00');
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000002',true);
select public.join_car(session_id,car_id) from fixture;
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000001',true);
select public.offer_car(session_id,2,'Mairie','Note seulement','20:00') from fixture;
reset role;
select is((select count(*) from public.app_notifications where kind='carpool_updated'),0::bigint,'Unchanged meeting/time and note edits send nothing');
set local role authenticated;
select public.offer_car(session_id,2,'Gare','','20:15') from fixture;
reset role;
select is((select count(*) from public.app_notifications where kind='carpool_updated'),1::bigint,'Passenger receives meeting/departure change');
set local role authenticated;
select public.set_own_transport((select session_id from fixture),'own');
reset role;
select is((select count(*) from public.app_notifications where kind='carpool_removed'),1::bigint,'Passenger receives driver withdrawal');
select is((select rsvp::text from public.session_participations where member_id=(select id from people where email='inbox.member@example.test')),'yes','Passenger remains registered');
select is((select transport_mode::text from public.session_participations where member_id=(select id from people where email='inbox.member@example.test')),'needs','Passenger still needs reassignment');
-- Failure isolation covers the trigger subtransaction only.
create function pg_temp.break_inbox() returns trigger language plpgsql as $$begin raise exception 'Injected inbox failure'; end;$$;
create trigger test_inbox_failure before insert on public.app_notifications for each row execute function pg_temp.break_inbox();
set local role authenticated;
select lives_ok($$select public.set_member_caci((select id from people where email='inbox.member@example.test'),'2032-01-01')$$,'Inbox failure cannot block CACI update');
select public.set_draft_selection((select session_id from fixture),(select id from people where email='inbox.member@example.test'),'waiting');
select lives_ok($$select public.publish_selection((select session_id from fixture))$$,'Inbox failure cannot block publication');
select is((select state from public.get_current_selection((select session_id from fixture)) where member_id=(select id from people where email='inbox.member@example.test')),'waiting','Business publication is still effective');
update fixture set car_id=public.offer_car(session_id,2,'Parking','','20:00');
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000002',true);
select public.join_car(session_id,car_id) from fixture;
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.set_own_transport((select session_id from fixture),'own')$$,'Inbox failure cannot block driver withdrawal');
reset role;
drop trigger test_inbox_failure on public.app_notifications;
-- Compare effective states rather than resurrecting an old selected snapshot.
set local role authenticated;
select public.set_draft_selection((select session_id from fixture),(select id from people where email='inbox.member@example.test'),'selected');
select public.publish_selection((select session_id from fixture));
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000002',true);
select public.set_session_rsvp((select session_id from fixture),'no',null,false,true);
select public.set_session_rsvp((select session_id from fixture),'yes',null,true);
select is((select state from public.get_current_selection((select session_id from fixture)) where member_id=public.current_member_id()),'waiting','Renewed registration invalidates old confirmation');
reset role;
create temp table before_republish as select count(*) n from public.app_notifications;
set local role authenticated;
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000001',true);
select public.publish_selection((select session_id from fixture));
reset role;
select is((select count(*) from public.app_notifications),(select n from before_republish),'Republication of effective waiting state sends no misleading status-change notice');
-- Same source cannot enqueue twice, even on an internal retry.
select public.enqueue_app_notification((select id from people where email='inbox.member@example.test'),'caci_updated',null,'a8100000-0000-4000-8000-000000000090','Test','Test');
select public.enqueue_app_notification((select id from people where email='inbox.member@example.test'),'caci_updated',null,'a8100000-0000-4000-8000-000000000090','Test','Test');
select is((select count(*) from public.app_notifications where source_id='a8100000-0000-4000-8000-000000000090'),1::bigint,'Audit/source retry is idempotent');
-- Foreign IDs are harmless and cannot mark another recipient's inbox.
create temp table foreign_notice as select id from public.app_notifications where member_id=(select id from people where email='inbox.maybe@example.test') limit 1;
grant select on foreign_notice to authenticated;
set local role authenticated;
select public.mark_app_notifications_read(array(select id from foreign_notice));
reset role;
select ok((select read_at is null from public.app_notifications where id=(select id from foreign_notice)),'Admin cannot mark another member notice read');
select is((select count(*) from public.app_notifications where kind='selection_published'),2::bigint,'Original first-publication notices are retained');
set local role anon;
select throws_ok($$select public.get_my_notifications()$$,'42501',null,'Anonymous inbox RPC is forbidden');
select throws_ok($$select * from public.app_notifications$$,'42501',null,'Anonymous inbox table is forbidden');
reset role;
-- A President has the same private inbox, not access to everybody's messages.
update public.members set role='president' where email='inbox.admin@example.test';
set local role authenticated;
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.app_notifications),0::bigint,'President cannot browse other private inboxes');
select is((public.get_my_notifications()->>'unread_count')::int,0,'President reads only own inbox');
reset role;
-- Paging is bounded and cursor-based; insert only synthetic inbox fixtures.
insert into public.app_notifications(member_id,kind,source_id,title,message)
select (select id from people where email='inbox.member@example.test'),'caci_updated',gen_random_uuid(),'Fictif','Test' from generate_series(1,25);
set local role authenticated;
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000002',true);
select is(jsonb_array_length(public.get_my_notifications()->'items'),20,'First page bounded to 20');
select is(public.get_my_notifications()->>'has_more','true','More pages are exposed');
select is((select count(*) from jsonb_array_elements(public.get_my_notifications(
  (public.get_my_notifications()->'items'->19->>'created_at')::timestamptz,
  (public.get_my_notifications()->'items'->19->>'id')::uuid)->'items') item
  where item->>'id' in (select value->>'id' from jsonb_array_elements(public.get_my_notifications()->'items'))),0::bigint,'Cursor pages never overlap');

select throws_ok($$select public.get_my_notifications(now(),null)$$,'22023',null,'Partial cursor rejected');
reset role;
update public.members set disabled_at=now() where email='inbox.member@example.test';
set local role authenticated;
select throws_ok($$select public.get_my_notifications()$$,'42501',null,'Disabled member cannot read inbox with existing JWT');
select is((select count(*) from public.app_notifications),0::bigint,'Disabled member RLS removes access');
reset role;
update public.app_notification_settings set enabled=false;
set local role authenticated;
select set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000001',true);
select is(public.get_my_notifications()->>'enabled','false','Operator kill switch hides feature without removing history');
reset role;
select * from finish();
rollback;
