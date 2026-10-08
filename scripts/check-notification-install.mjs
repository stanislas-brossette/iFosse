import {execFileSync} from 'node:child_process'
import {scheduleSql,JOB_NAME,cronCommand,installationSources,trackedMigration} from './install-staging-notifications.mjs'
// Local Docker only. Never accepts a hosted URL, credentials or project override.
const container='supabase_db_ifosse'
if(process.argv.length!==2 || (process.env.DOCKER_HOST && !process.env.DOCKER_HOST.startsWith('unix://')))throw Error('Local notification installation check only.')
function docker(args,input){return execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe']})}
try{
 const context=JSON.parse(docker(['context','inspect']))
 if(!context[0]?.Endpoints?.docker?.Host?.startsWith('unix://') || docker(['inspect','--format','{{index .Config.Labels "com.supabase.cli.project"}}',container]).trim()!=='ifosse')throw Error('Local stack required')
 const local=await installationSources()
 const quoted=value=>"'"+value.replaceAll("'","''")+"'"
 // Rollback includes extensions, settings, schedules, Vault and migration history.
 // No scheduler job is committed, so it cannot call the hosted worker.
 const transaction=`begin;
 create extension if not exists pg_cron with schema pg_catalog;
 create extension if not exists pg_net with schema extensions;
 create extension if not exists supabase_vault with schema vault;
 update public.member_notification_settings set enabled=false;
 ${scheduleSql}
 ${scheduleSql}
 do $$begin
  if (select count(*) from cron.job where jobname='${JOB_NAME}')<>1 then raise exception 'Schedule duplicated'; end if;
 end;$$;
 select vault.create_secret(repeat('x',64),'ifosse_install_check');
 do $$begin
  if not exists(select 1 from vault.decrypted_secrets where name='ifosse_install_check' and decrypted_secret=repeat('x',64)) then raise exception 'Vault mismatch'; end if;
 end;$$;
 -- Check the exact migration source can be stored without corrupting dollar quotes.
 create temporary table migration_check(version text,statements text[],name text);
 ${trackedMigration(local.migrations[0],0).slice(trackedMigration(local.migrations[0],0).lastIndexOf('insert into supabase_migrations.schema_migrations')).replace('supabase_migrations.schema_migrations','migration_check').replace(/commit;\s*$/,'')}
 do $verify_source$begin
  if (select statements[1] from migration_check)<>${quoted(local.migrations[0])} then raise exception 'Migration source changed'; end if;
 end;$verify_source$;
 select cron.schedule('${JOB_NAME}','* * * * *','select 123');
 do $test$begin
  begin
   ${scheduleSql.replace(/^do \$install\$/,'').replace(/\$install\$;$/,'')}
   raise exception using errcode='ZX001',message='Foreign schedule was accepted';
  exception when raise_exception then null;
  end;
  if (select command from cron.job where jobname='${JOB_NAME}')<>'select 123' then raise exception 'Foreign schedule overwritten'; end if;
 end;$test$;
 -- Original command stays fixed to staging; unrelated schedules are untouched.
 select cron.schedule('ifosse_install_unrelated','* * * * *','select 456');
 select cron.schedule('${JOB_NAME}','* * * * *',${quoted(cronCommand)});
 ${scheduleSql}
 do $$begin
  if not exists(select 1 from cron.job where jobname='ifosse_install_unrelated' and command='select 456') then raise exception 'Unrelated job changed'; end if;
 end;$$;
 rollback;`
 docker(['exec','-i',container,'psql','-U','postgres','-d','postgres','-X','-A','-t','-v','ON_ERROR_STOP=1'],transaction)
 console.log('Local notification installation: extensions, Vault, migration-source integrity, idempotent scheduling and foreign-job protection passed; all changes rolled back.')
}catch{console.error('Local notification installation check failed. No provider responses, database contents or secrets are printed.');process.exitCode=1}
