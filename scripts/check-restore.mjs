import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { closeSync, openSync } from 'node:fs'
import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Local drill only: no remote URL, password or operator credential is accepted.
const container = 'supabase_db_ifosse'
const target = `ifosse_restore_${randomBytes(8).toString('hex')}`
const admin = randomUUID()
const member = randomUUID()
const title = `Restauration fictive ${randomUUID()}`
function docker(args, options = {}) {
  try { return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }) }
  catch (error) {
    const diagnostic = String(error.stderr ?? '').split('\n').find(line => line.includes('ERROR:'))?.replace(/'[^']*'|"[^"]*"/g, '[redacted]')
    throw new Error(`Local restore drill command failed${diagnostic ? `: ${diagnostic}` : ''}. Database contents and credentials are not printed.`)
  }
}
function sql(database, text) {
  return docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { input: text, stdio: ['pipe', 'pipe', 'pipe'] })
}
function assert(value, message) { if (!value) throw new Error(message) }
if (process.argv.length !== 2) throw new Error('Usage: npm run db:restore-check (local stack only).')
if (process.env.DOCKER_HOST && !process.env.DOCKER_HOST.startsWith('unix://')) throw new Error('The restore drill requires a local Docker socket.')
const context = JSON.parse(docker(['context', 'inspect']))
assert(context[0]?.Endpoints?.docker?.Host?.startsWith('unix://'), 'The restore drill requires a local Docker context.')
const label = docker(['inspect', '--format', '{{index .Config.Labels "com.supabase.cli.project"}}', container]).trim()
assert(label === 'ifosse', 'The local iFosse Supabase stack is required.')
const directory = await mkdtemp(join(tmpdir(), 'ifosse-restore-'))
await chmod(directory, 0o700)
const backup = join(directory, 'database.dump')
let created = false
let failure
try {
  sql('postgres', `begin;
    insert into auth.users(id,email,email_confirmed_at) values('${admin}','ifosse-restore-${admin}@example.test',now()),('${member}','ifosse-restore-${member}@example.test',now());
    select public.provision_member('${admin}','Admin','Restauration fictive');
    select public.provision_member('${member}','Membre','Restauration fictive');
    update public.members set role='admin' where auth_user_id='${admin}';
    create temp table restore_session(id uuid);
    grant select,insert on restore_session to authenticated;
    set local role authenticated;
    select set_config('request.jwt.claim.sub','${admin}',true);
    insert into restore_session select public.save_session(((now() at time zone 'Europe/Paris')::date-2),'21:00','22:00','${title}','','','Données fictives de restauration',2,true,false,false);
    select public.set_session_rsvp((select id from restore_session),'yes',id) from public.members where auth_user_id in('${admin}','${member}');
    select public.set_member_caci(id,(now() at time zone 'Europe/Paris')::date+365) from public.members where auth_user_id in('${admin}','${member}');
    select public.set_draft_selection((select id from restore_session),id,'selected') from public.members where auth_user_id in('${admin}','${member}');
    select public.publish_selection((select id from restore_session));
    select public.set_payment_status((select id from restore_session),id,'paid') from public.members where auth_user_id='${member}';
    select public.set_payment_status((select id from restore_session),id,'free') from public.members where auth_user_id='${admin}';
    select set_config('request.jwt.claim.sub','${member}',true);
    select public.offer_car((select id from restore_session),1,'Rendez-vous fictif','','20:00');
    select set_config('request.jwt.claim.sub','${admin}',true);
    select public.join_car((select id from restore_session),(select id from public.car_offers where session_id=(select id from restore_session)));
    select public.set_draft_palanquee((select id from restore_session),id,1,auth_user_id='${admin}') from public.members where auth_user_id in('${admin}','${member}');
    select public.publish_palanquees((select id from restore_session));
    select public.set_attendance((select id from restore_session),id,'dived') from public.members where auth_user_id in('${admin}','${member}');
    select public.close_session_bilan((select id from restore_session));
    commit;`)
  const sessionId = sql('postgres', `select id from public.sessions where title='${title}';`).trim()
  assert(/^[0-9a-f-]{36}$/.test(sessionId), 'Restore fixture session was not created.')
  const descriptor = openSync(backup, 'wx', 0o600)
  try { docker(['exec', container, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--format=custom'], { stdio: ['ignore', descriptor, 'pipe'] }) }
  finally { closeSync(descriptor) }
  docker(['exec', container, 'createdb', '-U', 'postgres', '-T', 'template0', target])
  created = true
  const input = openSync(backup, 'r')
  try {
    // Managed realtime functions require the local schema owner. Preserve all
    // original owners/ACLs: restoring everything as one new owner breaks RLS.
    docker(['exec', '-i', container, 'pg_restore', '-U', 'supabase_admin', '-d', target, '--exit-on-error'], { stdio: [input, 'pipe', 'pipe'] })
  } finally { closeSync(input) }
  const verification = sql(target, `begin;
    do $$begin
      if (select count(*) from auth.users where id in('${admin}','${member}'))<>2 then raise exception 'Auth links missing'; end if;
      if (select count(*) from public.selection_publications where session_id='${sessionId}')<>1 then raise exception 'Selection snapshot missing'; end if;
      if (select count(*) from public.palanquee_publications where session_id='${sessionId}')<>1 then raise exception 'Group snapshot missing'; end if;
      if not exists(select 1 from public.audit_events where session_id='${sessionId}' and event_type='bilan_closed') then raise exception 'Audit history missing'; end if;
      if exists(select 1 from pg_tables where schemaname='public' and tablename in('members','sessions','session_participations','palanquee_draft') and (not rowsecurity or tableowner<>'postgres')) then raise exception 'Ownership/RLS lost'; end if;
    end$$;
    set local role authenticated;
    select set_config('request.jwt.claim.sub','${member}',true);
    do $$declare v_session uuid:='${sessionId}'; v_year integer; begin
      if public.current_member_id() is null or public.is_admin() then raise exception 'Member role changed'; end if;
      if (select count(*) from public.members)<>1 then raise exception 'Private directory leaked'; end if;
      if (select count(*) from public.session_participations where session_id=v_session)<>1 then raise exception 'Private participation leaked'; end if;
      if (select payment_status from public.session_participations where session_id=v_session)<>'paid' then raise exception 'Payment lost'; end if;
      select extract(year from date)::integer-case when extract(month from date)<9 then 1 else 0 end into v_year from public.sessions where id=v_session;
      if (select completed_count from public.get_season_counts(v_year))<>1 then raise exception 'Season count lost'; end if;
      if (select count(*) from public.get_current_palanquees(v_session))<>2 then raise exception 'Groups lost'; end if;
      if (select count(*) from public.get_car_offers(v_session) where occupied=1)<>1 then raise exception 'Carpool seats lost'; end if;
      begin perform public.set_payment_status(v_session,public.current_member_id(),'free'); raise exception 'Unauthorized payment accepted'; exception when insufficient_privilege then null; end;
    end$$;
    select set_config('request.jwt.claim.sub','${admin}',true);
    do $$begin
      if not public.is_admin() then raise exception 'Admin role lost'; end if;
      perform public.reopen_session_bilan('${sessionId}');
      perform public.set_attendance('${sessionId}',(select id from public.members where auth_user_id='${member}'),'absent');
      perform public.close_session_bilan('${sessionId}');
      begin update public.palanquee_publication_members set group_number=2 where publication_id in(select id from public.palanquee_publications where session_id='${sessionId}'); raise exception 'Unauthorized snapshot accepted'; exception when insufficient_privilege then null; end;
    end$$;
    rollback;`)
  assert(verification.includes('ROLLBACK'), 'Restored permission/workflow verification did not complete.')
  assert(sql('postgres', `select attendance_status from public.session_participations where session_id='${sessionId}' and member_id=(select id from public.members where auth_user_id='${member}');`).trim() === 'dived', 'Source fixture unexpectedly changed.')
} catch (error) {
  failure = error
} finally {
  let cleanupFailed = false
  if (created) {
    try { docker(['exec', container, 'dropdb', '-U', 'postgres', target]) } catch { cleanupFailed = true }
  }
  try {
    sql('postgres', `begin;
      set local role authenticated;
      select set_config('request.jwt.claim.sub','${admin}',true);
      select public.delete_session(id) from public.sessions where title='${title}';
      reset role;
      delete from public.members where auth_user_id in('${admin}','${member}');
      delete from auth.users where id in('${admin}','${member}');
      commit;`)
  } catch { cleanupFailed = true }
  await rm(directory, { recursive: true, force: true })
  if (cleanupFailed) failure = new Error('Restore drill cleanup incomplete; inspect local fictitious fixtures/temporary databases before retrying.', { cause: failure })
}
if (failure) throw failure
console.log('Restore drill passed: Auth links, owners/RLS, payments, selection, palanquées, carpool, audit and corrected season workflow. Source unchanged; temporary backup/database removed.')
