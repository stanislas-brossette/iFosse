begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Synthetic, rollback-only fixtures. Role metadata is deliberately forged to
-- prove authorization never trusts either user/app metadata or cached JWT roles.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
values
  ('00000000-0000-4000-8000-000000000001', ' Member.Identity@EXAMPLE.TEST ', now(), '{"role":"president"}', '{"role":"president"}'),
  ('00000000-0000-4000-8000-000000000002', 'admin.identity@example.test', now(), '{}', '{}'),
  ('00000000-0000-4000-8000-000000000003', 'president.identity@example.test', now(), '{}', '{}'),
  ('00000000-0000-4000-8000-000000000004', 'alternate.identity@example.test', now(), '{}', '{}'),
  ('00000000-0000-4000-8000-000000000005', 'banned.identity@example.test', now(), '{}', '{}'),
  ('00000000-0000-4000-8000-000000000006', 'unlinked.identity@example.test', now(), '{}', '{}');

create temp table identity_fixtures (name text primary key, auth_id uuid, member_id uuid);
grant select on identity_fixtures to anon, authenticated, service_role;

set local role service_role;
reset role;
insert into identity_fixtures values
  ('member', '00000000-0000-4000-8000-000000000001', public.provision_member('00000000-0000-4000-8000-000000000001', '  Adhérent  ', '  Test  ')),
  ('admin', '00000000-0000-4000-8000-000000000002', public.provision_member('00000000-0000-4000-8000-000000000002', 'Admin', 'Test')),
  ('president', '00000000-0000-4000-8000-000000000003', public.provision_member('00000000-0000-4000-8000-000000000003', 'Président', 'Test')),
  ('alternate', '00000000-0000-4000-8000-000000000004', public.provision_member('00000000-0000-4000-8000-000000000004', 'Relais', 'Test')),
  ('banned', '00000000-0000-4000-8000-000000000005', public.provision_member('00000000-0000-4000-8000-000000000005', 'Inactif', 'Test')),
  ('unlinked', '00000000-0000-4000-8000-000000000006', null);

select is((select email from public.members where id = (select member_id from identity_fixtures where name = 'member')),
  'member.identity@example.test', 'Provisioning normalizes the verified Auth email');
select is((select first_name from public.members where id = (select member_id from identity_fixtures where name = 'member')),
  'Adhérent', 'Provisioning trims names');
select is((select role::text from public.members where id = (select member_id from identity_fixtures where name = 'member')),
  'member', 'Auth metadata cannot provision a privileged role');
select is((select count(*) from public.audit_events where event_type = 'member_provisioned' and target_member_id in (select member_id from identity_fixtures)),
  5::bigint, 'Every initial provisioning is audited');

set local role service_role;
select is(public.provision_member('00000000-0000-4000-8000-000000000001', 'Écrasé', 'Écrasé'),
  (select member_id from identity_fixtures where name = 'member'), 'Trusted re-import is idempotent');
select throws_ok($$select public.provision_member('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Inconnu', 'Test')$$,
  '22023', null, 'Provisioning requires an existing active Auth account');
select lives_ok($$select public.bootstrap_president((select member_id from identity_fixtures where name = 'president'))$$,
  'Trusted operator can bootstrap the first president');
select throws_ok($$select public.bootstrap_president((select member_id from identity_fixtures where name = 'alternate'))$$,
  '23514', null, 'Bootstrap cannot create a second president');
reset role;
select is((select first_name from public.members where id = (select member_id from identity_fixtures where name = 'member')),
  'Adhérent', 'Re-import preserves existing profile edits');
select is((select count(*) from public.audit_events where event_type = 'president_bootstrapped'),
  1::bigint, 'Bootstrap is audited once');

set local role anon;
select throws_ok('select * from public.members', '42501', null, 'Anonymous users cannot read member profiles');
select throws_ok('select * from public.audit_events', '42501', null, 'Anonymous users cannot read the audit trail');
select throws_ok('select public.current_member_id()', '42501', null, 'Anonymous users cannot inspect identity helpers');
select throws_ok($$select public.provision_member('00000000-0000-4000-8000-000000000006', 'Inconnu', 'Test')$$,
  '42501', null, 'Anonymous users cannot provision accounts');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select is(public.current_member_id(), null::uuid, 'An unlinked Auth account has no club identity');
select is(public.is_admin(), false, 'An unlinked account has no admin permissions');
select is((select count(*) from public.members), 0::bigint, 'An unlinked account cannot read club profiles');
select is((select count(*) from public.audit_events), 0::bigint, 'An unlinked account cannot read audit events');
select throws_ok($$select public.set_member_role((select member_id from identity_fixtures where name = 'member'), 'admin')$$,
  '42501', null, 'An unlinked account cannot grant privileges');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"president"}}', true);
select is(public.current_member_id(), (select member_id from identity_fixtures where name = 'member'),
  'Member identity comes from the Auth link');
select is(public.current_member_role()::text, 'member', 'Forged cached JWT role is ignored');
select is(public.is_admin(), false, 'A member cannot obtain admin rights via metadata');
select is((select count(*) from public.members), 1::bigint, 'A member can read exactly their own private profile');
select is((select count(*) from public.members where id = (select member_id from identity_fixtures where name = 'admin')),
  0::bigint, 'A member cannot browse the directory');
select is((select count(*) from public.audit_events), 0::bigint, 'A member cannot browse the audit trail');
select throws_ok($$update public.members set role = 'admin' where id = public.current_member_id()$$,
  '42501', null, 'Direct table self-promotion is denied');
select throws_ok($$update public.members set first_name = 'Écrasé' where id = public.current_member_id()$$,
  '42501', null, 'Profile table writes require a protected RPC');
select throws_ok($$select public.set_member_role(public.current_member_id(), 'admin')$$,
  '42501', null, 'A member cannot self-promote via RPC');
select throws_ok($$select public.provision_member('00000000-0000-4000-8000-000000000006', 'Inconnu', 'Test')$$,
  '42501', null, 'A member cannot provision another account');
select throws_ok($$select public.bootstrap_president(public.current_member_id())$$,
  '42501', null, 'A member cannot bootstrap a presidency');
select throws_ok($$select public.recover_president(public.current_member_id(), 'Tentative de reprise non autorisée')$$,
  '42501', null, 'A member cannot invoke the operator recovery path');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is(public.is_president(), true, 'The provisioned president is recognized');
select is(public.is_admin(), true, 'The president also has administrative permissions');
select lives_ok($$select public.set_member_role((select member_id from identity_fixtures where name = 'admin'), 'admin')$$,
  'The president can grant admin rights');
select lives_ok($$select public.set_member_role((select member_id from identity_fixtures where name = 'alternate'), 'admin')$$,
  'The president can grant another administrator');
select throws_ok($$select public.set_member_role(public.current_member_id(), 'member')$$,
  '23514', null, 'The role editor cannot remove the president');
select throws_ok($$select public.set_member_role((select member_id from identity_fixtures where name = 'member'), 'president')$$,
  '22023', null, 'Presidency cannot be granted through the ordinary role editor');
select throws_ok($$select public.set_member_role('ffffffff-ffff-4fff-8fff-ffffffffffff', 'admin')$$,
  '22023', null, 'Role management rejects nonexistent members');
select throws_ok('select public.transfer_presidency(public.current_member_id())',
  '22023', null, 'A presidency transfer requires a different member');
select throws_ok($$select public.transfer_presidency('ffffffff-ffff-4fff-8fff-ffffffffffff')$$,
  '22023', null, 'A failed transfer preserves the current president');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}', true);
select is(public.is_admin(), true, 'An administrator has administrative permissions');
select is((select count(*) from public.members), 5::bigint, 'An administrator can read the member directory');
select ok((select count(*) from public.audit_events) > 0, 'An administrator can read privileged-change audit events');
select throws_ok($$select public.set_member_role((select member_id from identity_fixtures where name = 'member'), 'admin')$$,
  '42501', null, 'An administrator cannot grant admin rights');
select throws_ok($$select public.transfer_presidency(public.current_member_id())$$,
  '42501', null, 'An administrator cannot transfer presidency');
select throws_ok($$select public.recover_president(public.current_member_id(), 'Tentative de reprise non autorisée')$$,
  '42501', null, 'An administrator cannot invoke service-only recovery');
select throws_ok($$insert into public.audit_events (event_type) values ('forged')$$,
  '42501', null, 'An administrator cannot forge audit events');
select throws_ok($$delete from public.audit_events$$,
  '42501', null, 'An administrator cannot erase audit events');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select lives_ok($$select public.set_member_role((select member_id from identity_fixtures where name = 'admin'), 'member')$$,
  'The president can revoke admin rights');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
-- Leave the same cached app_metadata role in request.jwt.claims unchanged.
select is(public.is_admin(), false, 'A demoted administrator immediately loses rights despite their stale JWT');
select is((select count(*) from public.members), 1::bigint, 'A demoted administrator immediately loses directory access');
select is((select count(*) from public.audit_events), 0::bigint, 'A demoted administrator immediately loses audit access');
reset role;

update auth.users set banned_until = now() + interval '1 day'
  where id = '00000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is(public.current_member_id(), null::uuid, 'A banned account loses club identity even with a valid JWT');
select throws_ok($$select public.set_member_role((select member_id from identity_fixtures where name = 'member'), 'admin')$$,
  '42501', null, 'A banned president cannot retain privileged RPC access');
reset role;
update auth.users set banned_until = null where id = '00000000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select lives_ok($$select public.transfer_presidency((select member_id from identity_fixtures where name = 'alternate'))$$,
  'The current president can atomically transfer presidency');
select is(public.current_member_role()::text, 'admin', 'The former president remains an administrator');
select is(public.is_president(), false, 'The former president immediately loses presidential permissions');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select is(public.is_president(), true, 'The new president is effective immediately');
select is((select count(*) from public.members where role = 'president'), 1::bigint,
  'Exactly one president remains after transfer');
select is((select count(*) from public.audit_events where event_type = 'presidency_transferred'), 1::bigint,
  'The presidency transfer is audited');
reset role;

set local role service_role;
select throws_ok($$select public.recover_president((select member_id from identity_fixtures where name = 'president'), 'court')$$,
  '22023', null, 'Recovery requires an explicit reason');
select lives_ok($$select public.recover_president((select member_id from identity_fixtures where name = 'president'), 'Reprise locale simulée après indisponibilité du président')$$,
  'Trusted operator can recover an unavailable presidency');
select is((select count(*) from public.members where role = 'president'), 1::bigint,
  'Recovery leaves exactly one president');
select is((select role::text from public.members where id = (select member_id from identity_fixtures where name = 'alternate')),
  'admin', 'Recovery demotes the previous president to administrator');
select is((select payload->>'reason' from public.audit_events where event_type = 'presidency_recovered'),
  'Reprise locale simulée après indisponibilité du président', 'Recovery records the operator reason');
select throws_ok($$delete from public.members where id = (select member_id from identity_fixtures where name = 'president')$$,
  '23514', null, 'The current president cannot be directly deleted');
select throws_ok('delete from public.audit_events', '42501', null, 'Even service cleanup cannot erase audit events');
reset role;

select throws_ok($$update public.members set role = 'president' where id = (select member_id from identity_fixtures where name = 'member')$$,
  '23505', null, 'The unique index prevents a second president independently of RPCs');
delete from auth.users where id = '00000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is(public.current_member_id(), null::uuid, 'Deleting an Auth account removes its linked access immediately');
select is((select count(*) from public.members), 0::bigint, 'A deleted Auth account cannot read a retained profile');
reset role;

select * from finish();
rollback;
