begin;
set local search_path=public,extensions;
select no_plan();
select ok(not has_table_privilege('authenticated','public.member_notifications','SELECT'),'Browser cannot read recipient snapshots');
select ok(not has_table_privilege('authenticated','public.member_notification_settings','UPDATE'),'Browser cannot enable mail or edit allowlist');
select ok(not has_function_privilege('authenticated','public.claim_member_notifications(text,text,integer)','EXECUTE'),'Browser cannot claim dispatch work');
select ok(not has_function_privilege('authenticated','public.enqueue_member_notification(public.audit_events,uuid,text)','EXECUTE'),'Browser cannot enqueue arbitrary messages');
select ok(not has_function_privilege('authenticated','public.complete_member_notification(uuid,uuid,text,text,text)','EXECUTE'),'Browser cannot mark email accepted');
select ok(not has_function_privilege('authenticated','public.retry_member_notification(uuid,boolean,text)','EXECUTE'),'Browser cannot replay messages');
select ok(not (select enabled from public.member_notification_settings),'Migration never activates hosted sending');
select throws_ok($$update public.member_notification_settings set enabled=true$$,'23514',null,'Missing environment never means safe to enable');
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('08150000-0000-4000-8000-000000000001','president@club-fictif.fr',now(),'{}'),
 ('08150000-0000-4000-8000-000000000002','ordinary@club-fictif.fr',now(),'{}'),
 ('08150000-0000-4000-8000-000000000003','reserved@ifosse-seed.invalid',now(),'{}'),
 ('08150000-0000-4000-8000-000000000004','seed@club-fictif.fr',now(),'{"ifosse_staging_seed":"ifosse-staging-v1"}'),
 ('08150000-0000-4000-8000-000000000005','created@club-fictif.fr',now(),'{"ifosse_creation_actor":"08150000-0000-4000-8000-000000000001","ifosse_creation_request":"08150000-0000-4000-8000-000000000099"}');
create temp table notification_people(label text,id uuid);
grant select on notification_people to authenticated,service_role;
insert into notification_people values
 ('president',public.provision_member('08150000-0000-4000-8000-000000000001','Président','Fictif')),
 ('member',public.provision_member('08150000-0000-4000-8000-000000000002','Adhérent','Fictif')),
 ('reserved',public.provision_member('08150000-0000-4000-8000-000000000003','Réservé','Fictif')),
 ('seed',public.provision_member('08150000-0000-4000-8000-000000000004','Seed','Fictif'));
select is((select count(*) from public.member_notifications),0::bigint,'Operator provisioning never sends welcomes or replays history');
update public.members set role='admin' where role='president';
update public.members set role='president' where id=(select id from notification_people where label='president');
set local role authenticated;
select set_config('request.jwt.claim.sub','08150000-0000-4000-8000-000000000001',true);
select public.set_member_role((select id from notification_people where label='member'),'admin');
reset role;
select is((select status from public.member_notifications where kind='admin_granted'),'disabled','Disabled configuration records receipt without mail backlog');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role","ref":"qjrpxuatsnvrqxhzklzq"}',true);
select throws_ok($$select public.configure_member_notifications(true,'preview','btpojwwwsxrepsehmxbm',array['ordinary@club-fictif.fr'])$$,'42501',null,'Production service JWT cannot configure staging');
select set_config('request.jwt.claims','{"role":"service_role","ref":"btpojwwwsxrepsehmxbm"}',true);
select throws_ok($$select public.configure_member_notifications(true,'production','qjrpxuatsnvrqxhzklzq','{}')$$,'42501',null,'Staging service JWT cannot configure production');
select throws_ok($$select public.configure_member_notifications(true,'preview','btpojwwwsxrepsehmxbm','{}')$$,'22023',null,'Staging needs explicit recipients');
select throws_ok($$select public.configure_member_notifications(true,'preview','btpojwwwsxrepsehmxbm',array['*'])$$,'22023',null,'Wildcard recipients forbidden');
select throws_ok($$select public.configure_member_notifications(true,'preview','btpojwwwsxrepsehmxbm',array['fake@example.test'])$$,'22023',null,'Reserved recipients cannot be authorized');
select lives_ok($$select public.configure_member_notifications(true,'preview','btpojwwwsxrepsehmxbm',array['ordinary@club-fictif.fr','president@club-fictif.fr','created@club-fictif.fr','seed@club-fictif.fr'])$$,'Pinned configuration works');
select throws_ok($$select * from public.claim_member_notifications('production','qjrpxuatsnvrqxhzklzq')$$,'42501',null,'Dispatcher environment must match DB configuration');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"08150000-0000-4000-8000-000000000001"}',true);
select set_config('request.jwt.claim.sub','08150000-0000-4000-8000-000000000001',true);
select public.set_member_role((select id from notification_people where label='member'),'member');
select public.set_member_role((select id from notification_people where label='member'),'member');
select public.set_member_active((select id from notification_people where label='member'),false);
select public.set_member_active((select id from notification_people where label='member'),false);
select public.set_member_active((select id from notification_people where label='member'),true);
select public.set_member_role((select id from notification_people where label='reserved'),'admin');
select public.set_member_role((select id from notification_people where label='seed'),'admin');
select public.create_member_from_identity('08150000-0000-4000-8000-000000000005','08150000-0000-4000-8000-000000000099','Créé','Fictif');
select public.create_member_from_identity('08150000-0000-4000-8000-000000000005','08150000-0000-4000-8000-000000000099','Créé','Fictif');
select public.set_member_caci((select id from notification_people where label='member'),'2099-10-01');
select is(public.member_notification_status((select id from notification_people where label='member'),'member_reactivated'),'pending','Operation receipt distinguishes pending from business success');
select public.transfer_presidency((select id from notification_people where label='member'));
select is(public.member_notification_status((select id from notification_people where label='member'),'presidency_transferred'),'pending','Former President can still read own handover receipt');
reset role;
select is((select count(*) from public.member_notifications where kind='admin_revoked'),1::bigint,'No-op role update creates no duplicate');
select is((select count(*) from public.member_notifications where kind='deactivated'),1::bigint,'No-op access update creates no duplicate');
select is((select count(*) from public.member_notifications where kind='reactivated'),1::bigint,'Reactivation queues one message');
select is((select count(*) from public.member_notifications where kind='welcome'),1::bigint,'Creation retry queues exactly one welcome');
select is((select count(*) from public.member_notifications where kind in ('presidency_received','presidency_departed')),2::bigint,'Handover notifies both people, not the whole club');
select is((select status from public.member_notifications where member_id=(select id from notification_people where label='reserved')),'suppressed','Reserved synthetic address excluded');
select is((select status from public.member_notifications where member_id=(select id from notification_people where label='seed')),'suppressed','Seed ownership excluded even with a non-reserved address');
select ok(not exists(select 1 from public.member_notifications where kind like '%caci%'),'No medical data in scope');
select ok(not exists(select 1 from public.member_notifications where first_name like '%2099%'),'Snapshot contains no CACI payload');
set local role authenticated;
select set_config('request.jwt.claim.sub','08150000-0000-4000-8000-000000000002',true);
select is(public.member_notification_status((select id from notification_people where label='member'),'member_reactivated'),'unavailable','Another admin cannot inspect someone else’s receipts');
reset role;
-- Roll back a successful mutation inside a subtransaction: its audit/outbox must vanish too.
do $$begin begin
  perform set_config('request.jwt.claim.sub','08150000-0000-4000-8000-000000000002',true);
  perform public.set_member_active((select id from notification_people where label='president'),false);
  raise exception 'rollback fixture';
exception when raise_exception then null;end;end$$;
select is((select count(*) from public.member_notifications where kind='deactivated'),1::bigint,'Rolled-back business operation produces no notification');
select is((select disabled_at from public.members where id=(select id from notification_people where label='president')),null::timestamptz,'Business rollback remains intact');
create temp table claimed_notifications as select * from public.claim_member_notifications('preview','btpojwwwsxrepsehmxbm');
select is((select count(*) from claimed_notifications),6::bigint,'Only six enabled eligible messages claimed');
select is((select count(*) from public.claim_member_notifications('preview','btpojwwwsxrepsehmxbm')),0::bigint,'Second worker cannot claim the same rows');
select is((select status from public.member_notifications where kind='admin_granted' and member_id=(select id from notification_people where label='member')),'disabled','Activation does not replay disabled historical receipts');
select ok(public.complete_member_notification((select id from claimed_notifications where kind='welcome'),(select lease_token from claimed_notifications where kind='welcome'),'accepted','provider_accepted','fixture-id'),'Exact lease acknowledged');
select ok(not public.complete_member_notification((select id from claimed_notifications where kind='welcome'),(select lease_token from claimed_notifications where kind='welcome'),'accepted','provider_accepted','fixture-id'),'Accepted receipt cannot be acknowledged or sent again');
select ok(not public.complete_member_notification((select id from claimed_notifications where kind='deactivated'),gen_random_uuid(),'accepted','provider_accepted'),'Wrong lease cannot change outcome');
select ok(public.complete_member_notification((select id from claimed_notifications where kind='deactivated'),(select lease_token from claimed_notifications where kind='deactivated'),'retry','rate_limited'),'Definite rate limit may be retried');
select is((select status from public.member_notifications where kind='deactivated'),'pending','429 requeues without claiming inbox delivery');
select ok((select next_attempt_at>now() from public.member_notifications where kind='deactivated'),'Retries use backoff');
update public.member_notifications set status='processing',attempts=5,lease_until=now()+interval '2 minutes' where kind='deactivated';
select ok(public.complete_member_notification((select id from claimed_notifications where kind='deactivated'),(select lease_token from claimed_notifications where kind='deactivated'),'retry','rate_limited'),'Final rate-limit refusal acknowledged');
select is((select status from public.member_notifications where kind='deactivated'),'failed','Fifth attempt terminates automatic retries');
update public.member_notifications set lease_until=now()-interval '1 second' where status='processing';
select is((select count(*) from public.claim_member_notifications('preview','btpojwwwsxrepsehmxbm')),0::bigint,'Expired lease never causes blind resend');
select is((select count(*) from public.member_notifications where status='uncertain'),4::bigint,'Unknown sends quarantined for operator review');
select throws_ok($$select public.retry_member_notification((select id from claimed_notifications where kind='reactivated'),false,'Provider logs checked')$$,'22023',null,'Unreviewed ambiguous sends cannot be replayed');
select throws_ok($$select public.retry_member_notification((select id from claimed_notifications where kind='welcome'),true,'Provider logs checked')$$,'22023',null,'Accepted sends cannot be replayed even by operator');
select lives_ok($$select public.retry_member_notification((select id from claimed_notifications where kind='reactivated'),true,'Provider logs checked: no acceptance')$$,'Operator may explicitly requeue verified non-acceptance');
select is((select count(*) from public.audit_events where event_type='member_notification_retry_reviewed'),1::bigint,'Operator review is audited');
-- Revalidate recipients/configuration at dispatch, not just at enqueue.
update public.member_notification_settings set staging_recipients=array['president@club-fictif.fr'];
select is((select count(*) from public.claim_member_notifications('preview','btpojwwwsxrepsehmxbm')),0::bigint,'Removing allowlist entry suppresses previously queued mail');
select is((select status from public.member_notifications where kind='reactivated'),'suppressed','Recipient is rechecked before dispatch');
set local role authenticated;
select set_config('request.jwt.claim.sub','08150000-0000-4000-8000-000000000005',true);
select throws_ok($$select public.member_notification_status((select id from notification_people where label='member'),'member_reactivated')$$,'42501',null,'Ordinary member cannot inspect queue');
select throws_ok($$select * from public.claim_member_notifications('preview','btpojwwwsxrepsehmxbm')$$,'42501',null,'Authenticated caller cannot dispatch');
reset role;
select * from finish();
rollback;
