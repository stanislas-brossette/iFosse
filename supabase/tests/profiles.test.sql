begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at) values
('10000000-0000-4000-8000-000000000001','profiles.member@example.test',now()),
('10000000-0000-4000-8000-000000000002','profiles.admin@example.test',now()),
('10000000-0000-4000-8000-000000000003','profiles.other@example.test',now());
select public.provision_member('10000000-0000-4000-8000-000000000001','Membre','Test');
select public.provision_member('10000000-0000-4000-8000-000000000002','Admin','Test');
select public.provision_member('10000000-0000-4000-8000-000000000003','Autre','Test');
update public.members set role='admin' where email='profiles.admin@example.test';
create temp table profile_fixture as select id,email from public.members where email like 'profiles.%';
grant select on profile_fixture to anon,authenticated;

set local role anon;
select throws_ok($$select public.update_own_profile('A','B','','N2','',false,0,'')$$,'42501',null,'Anonymous profile editing is denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.update_own_profile('Prénom','Nom','0612345678','N2','N3',true,3,'Parking')$$,'Members edit their normal profile fields');
select is((select current_level from public.members),'N2','Level is saved');
select is((select role::text from public.members),'member','Normal edits preserve role');
select is((select email from public.members),'profiles.member@example.test','Normal edits preserve linked email');
select is((select caci_expiry_date from public.members),null::date,'Normal edits preserve CACI');
select is((select usual_passenger_seats from public.members),3,'Optional usual passenger defaults are saved');
select is((select count(*) from public.members),1::bigint,'Normal members still cannot browse the directory');
select throws_ok($$select public.update_own_profile('','','','N2','',false,0,'')$$,'22023',null,'Empty names are rejected');
select throws_ok($$select public.update_own_profile('A','B','','N2','',true,9,'')$$,'22023',null,'Usual seats stay within 1..8');
select throws_ok($$select public.set_member_caci(public.current_member_id(),date '2027-10-02')$$,'42501',null,'Member cannot edit own CACI through RPC');
select throws_ok($$update public.members set caci_expiry_date=date '2027-10-02'$$,'42501',null,'Member cannot edit CACI directly');
select lives_ok($$select public.update_own_profile('A','B','','N2','',false,8,'Ancien')$$,'Members can opt out of usual car defaults');
select is((select usual_passenger_seats from public.members),0,'Opt-out clears seats');
select is((select usual_meeting_point from public.members),'','Opt-out clears meeting defaults');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.set_member_caci(public.current_member_id(),date '2027-10-02')$$,'Admin can edit own CACI');
select lives_ok($$select public.set_member_caci((select id from profile_fixture where email='profiles.member@example.test'),date '2027-12-02')$$,'Admin can edit another member CACI');
select is((select count(*) from public.members),3::bigint,'Admin can read the directory');
select is((select count(*) from public.audit_events where event_type='caci_date_changed' and target_member_id in (select id from profile_fixture)),2::bigint,'CACI mutations are audited');
select lives_ok($$select public.set_member_caci((select id from profile_fixture where email='profiles.member@example.test'))$$,'Admin can clear a missing CACI date');
select throws_ok($$select public.set_member_caci(public.current_member_id(),'infinity'::date)$$,'23514',null,'CACI cannot be infinite');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select is((select caci_expiry_date from public.members),null::date,'The member sees the administrator-maintained date');
reset role;
select is((select first_name from public.members where email='profiles.other@example.test'),'Autre','Ordinary profile edits cannot change another member');
select * from finish();
rollback;
