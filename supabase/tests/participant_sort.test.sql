begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at) values
('80000000-0000-4000-8000-000000000001','review.driver@example.test',now()),
('80000000-0000-4000-8000-000000000002','review.member@example.test',now()),
('80000000-0000-4000-8000-000000000003','review.other@example.test',now());
select public.provision_member('80000000-0000-4000-8000-000000000001','Conducteur','Revue');
select public.provision_member('80000000-0000-4000-8000-000000000002','Passager','Revue');
select public.provision_member('80000000-0000-4000-8000-000000000003','Autre','Revue');
update public.members set role='admin' where email='review.driver@example.test';
create temp table review_members as select id,email from public.members where email like 'review.%';
create temp table review_session(id uuid);
grant select on review_members to authenticated;
grant select,insert on review_session to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
insert into review_session select public.save_session('2030-10-01','21:00','22:00','Revue','','','',2,true,false,false);

select public.set_payment_status((select id from review_session),(select id from review_members where email='review.other@example.test'),'paid');
select is((select registered_at from public.session_participations where member_id=(select id from review_members where email='review.other@example.test')),null::timestamptz,'Payment alone is not registration');
select public.set_session_rsvp((select id from review_session),'yes');
create temp table first_registration as select registered_at from public.session_participations where member_id=(select id from review_members where email='review.driver@example.test');
select ok((select registered_at from first_registration) is not null,'First Yes records registration');
select public.set_session_rsvp((select id from review_session),'maybe',(select id from review_members where email='review.member@example.test'));
select ok((select registered_at from public.session_participations where member_id=(select id from review_members where email='review.member@example.test')) is not null,'First Maybe records registration');
select public.set_session_rsvp((select id from review_session),'maybe');
select public.set_payment_status((select id from review_session),(select id from review_members where email='review.driver@example.test'),'paid');
select is((select registered_at from public.session_participations where member_id=(select id from review_members where email='review.driver@example.test')),(select registered_at from first_registration),'RSVP and payment updates preserve first registration');
select public.set_session_rsvp((select id from review_session),'no');
select public.set_session_rsvp((select id from review_session),'yes');
select is((select registered_at from public.session_participations where member_id=(select id from review_members where email='review.driver@example.test')),(select registered_at from first_registration),'Withdrawal/rejoin preserves first registration');
select is((select registered_at from public.get_current_selection((select id from review_session)) where member_id=(select id from review_members where email='review.driver@example.test')),(select registered_at from first_registration),'Safe published projection exposes registration timestamp');
select is((select state from public.get_current_selection((select id from review_session)) where member_id=(select id from review_members where email='review.driver@example.test')),'pending','No publication remains pending');
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.get_current_selection((select id from review_session))),2::bigint,'Member still sees only Yes/Maybe, not private payment-only rows');
select ok((select bool_and(registered_at is not null) from public.get_current_selection((select id from review_session))),'Member sees public registration times');
select set_config('request.jwt.claim.sub','',true);
select throws_ok(format('select public.get_current_selection(%L)',(select id from review_session)),'42501','Adhérent actif requis.','Missing identity cannot read projection');
reset role;
select ok(not has_function_privilege('anon','public.get_current_selection(uuid)','execute'),'Anonymous projection remains denied');
select * from finish();
rollback;
