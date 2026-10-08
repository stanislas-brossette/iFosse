begin;
set local search_path=public,extensions;
select no_plan();
select ok(not has_function_privilege('authenticated','public.queue_caci_audit_notification()','EXECUTE'),'Browser cannot enqueue a CACI notification');
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('08160000-0000-4000-8000-000000000001','admin@caci-fictif.fr',now(),'{}'),
 ('08160000-0000-4000-8000-000000000002','member@caci-fictif.fr',now(),'{}'),
 ('08160000-0000-4000-8000-000000000003','reserved@example.test',now(),'{}'),
 ('08160000-0000-4000-8000-000000000004','seed@caci-fictif.fr',now(),'{"ifosse_staging_seed":"ifosse-staging-v1"}'),
 ('08160000-0000-4000-8000-000000000005','excluded@caci-fictif.fr',now(),'{}');
create temp table caci_people(label text,id uuid);
grant select on caci_people to authenticated;
insert into caci_people values
 ('admin',public.provision_member('08160000-0000-4000-8000-000000000001','Admin','Fictif')),
 ('member',public.provision_member('08160000-0000-4000-8000-000000000002','Adhérent','Fictif')),
 ('reserved',public.provision_member('08160000-0000-4000-8000-000000000003','Réservé','Fictif')),
 ('seed',public.provision_member('08160000-0000-4000-8000-000000000004','Seed','Fictif')),
 ('excluded',public.provision_member('08160000-0000-4000-8000-000000000005','Exclu','Fictif'));
update public.members set role='admin' where id=(select id from caci_people where label='admin');
update public.member_notification_settings set enabled=true,environment='preview',project_ref='btpojwwwsxrepsehmxbm',
 staging_recipients=array['admin@caci-fictif.fr','member@caci-fictif.fr','seed@caci-fictif.fr'];
set local role authenticated;
select set_config('request.jwt.claim.sub','08160000-0000-4000-8000-000000000001',true);
select public.set_member_caci_if_current((select id from caci_people where label='member'),'2099-12-31',null);
select is(public.member_notification_status((select id from caci_people where label='member'),'caci_date_changed'),'pending','Admin sees a separate receipt after the successful change');
select public.set_member_caci_if_current((select id from caci_people where label='member'),'2099-12-31','2099-12-31');
select throws_ok($$select public.set_member_caci_if_current((select id from caci_people where label='member'),'2031-01-01',null)$$,'40001',null,'Concurrent change remains rejected');
select throws_ok($$select public.set_member_caci_if_current((select id from caci_people where label='member'),'infinity','2099-12-31')$$,'23514',null,'Invalid date remains rejected');
reset role;
select is((select count(*) from public.member_notifications where kind='caci_updated'),1::bigint,'Same value, conflict and validation error add no mail');
select is((select count(*) from public.audit_events where event_type='caci_date_changed' and target_member_id=(select id from caci_people where label='member')),1::bigint,'One audit and one notification for the real change');
select is((select member_id from public.member_notifications where kind='caci_updated'),(select id from caci_people where label='member'),'Only the affected member is notified');
set local role authenticated;
select set_config('request.jwt.claim.sub','08160000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.set_member_caci((select id from caci_people where label='member'),'2030-01-01')$$,'42501',null,'Member cannot alter own CACI');
reset role;
select is((select count(*) from public.member_notifications where kind='caci_updated'),1::bigint,'Permission failure cannot enqueue mail');
set local role authenticated;
select set_config('request.jwt.claim.sub','08160000-0000-4000-8000-000000000001',true);
select public.set_member_caci_if_current((select id from caci_people where label='member'),'2020-01-01','2099-12-31');
select public.set_member_caci_if_current((select id from caci_people where label='member'),null,'2020-01-01');
select public.set_member_caci_if_current((select id from caci_people where label='member'),null,null);
select public.set_member_caci((select id from caci_people where label='admin'),'2099-12-31');
select public.set_member_caci((select id from caci_people where label='reserved'),'2099-12-31');
select public.set_member_caci((select id from caci_people where label='seed'),'2099-12-31');
select public.set_member_caci((select id from caci_people where label='excluded'),'2099-12-31');
reset role;
select is((select count(*) from public.member_notifications where kind='caci_updated' and member_id=(select id from caci_people where label='member')),3::bigint,'Changing to expired or absent notifies; absent to absent does not');
select is((select count(*) from public.member_notifications where kind='caci_updated' and member_id=(select id from caci_people where label='admin')),1::bigint,'Admin own CACI uses the same authorized behavior');
select is((select status from public.member_notifications where member_id=(select id from caci_people where label='reserved')),'suppressed','Reserved fake address cannot receive CACI email');
select is((select status from public.member_notifications where member_id=(select id from caci_people where label='seed')),'suppressed','Seed ownership excludes even a non-reserved email');
select is((select status from public.member_notifications where member_id=(select id from caci_people where label='excluded')),'suppressed','Staging allowlist applies to CACI changes');
update public.member_notification_settings set enabled=false;
set local role authenticated;
select public.set_member_caci((select id from caci_people where label='member'),'2030-01-01');
reset role;
select is((select count(*) from public.member_notifications where kind='caci_updated' and status='disabled'),1::bigint,'Disabled sending remains disabled for CACI');
create temp table before_rollback as select count(*) n from public.member_notifications;
do $$begin begin
 perform public.set_member_caci((select id from caci_people where label='member'),'2031-01-01');
 raise exception 'rollback fixture';
exception when raise_exception then null;end;end$$;
select is((select count(*) from public.member_notifications),(select n from before_rollback),'Rollback removes the CACI notification with its mutation');
select is((select caci_expiry_date from public.members where id=(select id from caci_people where label='member')),'2030-01-01'::date,'Rollback preserves the actual CACI date');
select ok(not exists(select 1 from public.member_notifications n where to_jsonb(n)::text ~ '2099-12-31|2020-01-01|2030-01-01|previous_date|caci_expiry_date'),'Private outbox does not copy medical dates or audit payload');
update public.member_notification_settings set enabled=true;
create temp table caci_claimed as select * from public.claim_member_notifications('preview','btpojwwwsxrepsehmxbm');
select is((select count(*) from caci_claimed),4::bigint,'Only four eligible CACI events reach the server dispatcher');
select ok(not exists(select 1 from caci_claimed where kind<>'caci_updated'),'Dispatcher receives only the bounded notice type');
select is((select count(*) from public.claim_member_notifications('preview','btpojwwwsxrepsehmxbm')),0::bigint,'Second worker cannot duplicate CACI sends');
select * from finish();
rollback;
