begin;
create extension if not exists pgtap with schema extensions;
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
select is(public.member_notification_status((select id from caci_people where label='member'),'caci_date_changed'),'unavailable','CACI no longer has an email receipt');
select public.set_member_caci_if_current((select id from caci_people where label='member'),'2099-12-31','2099-12-31');
select throws_ok($$select public.set_member_caci_if_current((select id from caci_people where label='member'),'2031-01-01',null)$$,'PGRST',jsonb_build_object('code','40001','message','CACI_EDIT_CONFLICT','details',null,'hint',null)::text,'Concurrent CACI change remains rejected');
reset role;
select is((select count(*) from public.member_notifications),0::bigint,'Successful CACI update creates no email');
select is((select count(*) from public.audit_events where event_type='caci_date_changed'),1::bigint,'CACI audit is retained');
select ok(not exists(select 1 from pg_trigger where tgname='audit_queue_caci_notification'),'Historical CACI email trigger is removed');
-- Model a legacy unsent item from before the scope migration, including a retry.
insert into public.member_notifications(audit_id,member_id,kind,recipient_email,first_name,occurred_at,status)
select id,target_member_id,'caci_updated','member@caci-fictif.fr','Fictif',created_at,'pending'
from public.audit_events where event_type='caci_date_changed';
select is((select count(*) from public.claim_member_notifications('preview','btpojwwwsxrepsehmxbm')),0::bigint,'Legacy CACI cannot be claimed');
select is((select status from public.member_notifications),'suppressed','Legacy CACI is cancelled without deleting audit/receipt');
select is((select count(*) from public.audit_events where event_type='caci_date_changed'),1::bigint,'Cancelling an old email preserves CACI audit');
select is((select caci_expiry_date from public.members where id=(select id from caci_people where label='member')),'2099-12-31'::date,'Removing email does not change CACI business value');
select ok(not public.member_notification_email_kind('caci_updated'),'CACI is excluded from email allowlist');
select ok(public.member_notification_email_kind('welcome'),'Account creation stays in email allowlist');
select ok(public.member_notification_email_kind('presidency_received'),'Presidency email stays allowed');
set local role authenticated;
select set_config('request.jwt.claim.sub','08160000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.set_member_caci((select id from caci_people where label='member'),'2030-01-01')$$,'42501',null,'Member still cannot change CACI');
select throws_ok($$select public.claim_member_notifications('preview','btpojwwwsxrepsehmxbm')$$,'42501',null,'Member still cannot dispatch email');
reset role;
select * from finish();
rollback;
