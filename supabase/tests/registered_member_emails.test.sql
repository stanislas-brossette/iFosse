begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select is((select staging_recipient_mode from public.member_notification_settings),'allowlist','Existing installations retain explicit allowlist default');
select ok(not (select enabled from public.member_notification_settings),'Migration does not enable emails');
select ok(not has_table_privilege('authenticated','public.member_notification_settings','UPDATE'),'Browser cannot broaden audience');
select ok(not has_table_privilege('service_role','public.member_notification_settings','UPDATE'),'Worker cannot broaden audience');
select throws_ok($$update public.member_notification_settings set staging_recipient_mode='*'$$,'23514',null,'Wildcard is not an audience mode');
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data)
select ('18210000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 case i when 1 then 'president@club-fictif.fr' when 2 then 'ordinary@club-fictif.fr' when 3 then 'fixture@ifosse-seed.invalid'
 when 4 then 'seed@club-fictif.fr' when 5 then 'registry@club-fictif.fr' when 6 then 'future@club-fictif.fr'
 when 7 then 'unconfirmed@club-fictif.fr' else 'changed@club-fictif.fr' end,
 now(),case when i=4 then '{"ifosse_staging_seed":"ifosse-staging-v1"}'::jsonb else '{}'::jsonb end
from generate_series(1,8) i;
create temp table audience_people(i integer,id uuid);
grant select on audience_people to authenticated;
insert into audience_people select i,public.provision_member(('18210000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'Fictif','Adhérent '||i) from generate_series(1,5) i;
update public.members set role='admin' where role='president';
update public.members set role='president' where id=(select id from audience_people where i=1);
insert into public.staging_seed_runs(seed,anchor,auth_ids,member_ids,session_ids)
 values('ifosse-staging-v1',current_date,array_fill('18210000-0000-4000-8000-000000000005'::uuid,array[30]),
 array_fill((select id from audience_people where i=5),array[30]),array_fill(gen_random_uuid(),array[7]));
update public.member_notification_settings set enabled=true,environment='preview',project_ref='btpojwwwsxrepsehmxbm',staging_recipients=array['president@club-fictif.fr'];
set local role authenticated;
select set_config('request.jwt.claim.sub','18210000-0000-4000-8000-000000000001',true);
select public.set_member_role((select id from audience_people where i=2),'admin');
reset role;
select is((select status from public.member_notifications where member_id=(select id from audience_people where i=2)),'suppressed','Legacy allowlist still excludes real account outside list');
update public.member_notification_settings set staging_recipient_mode='registered',staging_recipients='{}';
select is((select count(*) from public.member_notifications where status='pending'),0::bigint,'Broadening does not replay suppressed or historical events');
-- Members provisioned after activation do not require a new address list.
insert into audience_people select i,public.provision_member(('18210000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'Fictif','Adhérent '||i) from generate_series(6,8) i;
select is((select count(*) from public.member_notifications),1::bigint,'Operator provisioning still does not send a welcome');
set local role authenticated;
select public.set_member_role((select id from audience_people where i=2),'member');
select public.set_member_role((select id from audience_people where i=3),'admin');
select public.set_member_role((select id from audience_people where i=4),'admin');
select public.set_member_role((select id from audience_people where i=5),'admin');
select public.set_member_role((select id from audience_people where i=6),'admin');
select public.set_member_role((select id from audience_people where i=7),'admin');
select public.set_member_role((select id from audience_people where i=8),'admin');
reset role;
select is((select status from public.member_notifications where member_id=(select id from audience_people where i=2) and kind='admin_revoked'),'pending','Registered real member outside old list is eligible');
select is((select status from public.member_notifications where member_id=(select id from audience_people where i=3)),'suppressed','Reserved fake domain remains excluded');
select is((select status from public.member_notifications where member_id=(select id from audience_people where i=4)),'suppressed','Auth seed provenance remains excluded with real-looking address');
select is((select status from public.member_notifications where member_id=(select id from audience_people where i=5)),'suppressed','Seed registry provenance remains excluded with real-looking address');
select is((select status from public.member_notifications where member_id=(select id from audience_people where i=6)),'pending','Future registered member automatically eligible');
update auth.users set email_confirmed_at=null where id='18210000-0000-4000-8000-000000000007';
update public.members set email='replacement@club-fictif.fr' where id=(select id from audience_people where i=8);
create temp table audience_claimed as select * from public.claim_member_notifications('preview','btpojwwwsxrepsehmxbm');
select is((select count(*) from audience_claimed),2::bigint,'Only linked confirmed unchanged non-seed members are claimed');
select is((select status from public.member_notifications where member_id=(select id from audience_people where i=7)),'suppressed','Unconfirmed Auth identity cannot be mailed');
select is((select status from public.member_notifications where member_id=(select id from audience_people where i=8)),'suppressed','Changed identity/email snapshot is not redirected');
select is((select status from public.member_notifications where member_id=(select id from audience_people where i=2) and kind='admin_granted'),'suppressed','Previously excluded event remains excluded');
set local role authenticated;
select public.set_member_active((select id from audience_people where i=2),false);
reset role;
select is((select kind from public.claim_member_notifications('preview','btpojwwwsxrepsehmxbm')),'deactivated','Deactivated member can still receive the account-access notice');
select ok(not exists(select 1 from public.member_notifications where kind='caci_updated'),'Audience broadening never adds CACI email');
-- Compatibility CLI always explicitly returns the SQL layer to the allowlist.
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role","ref":"btpojwwwsxrepsehmxbm"}',true);
select public.configure_member_notifications(true,'preview','btpojwwwsxrepsehmxbm',array['president@club-fictif.fr']);
reset role;
select is((select staging_recipient_mode from public.member_notification_settings),'allowlist','Existing configure RPC safely returns to allowlist mode');
select * from finish();
rollback;
