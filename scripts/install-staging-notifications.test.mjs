// @vitest-environment node
import { expect,it,vi } from 'vitest'
import { PassThrough,Writable } from 'node:stream'
import { installNotifications,installationSources,createHiddenPrompt,preflightSql,settingsSql,extensionSql,jobsSql,scheduleSql,enableSql,disableSql,cronCommand,JOB_NAME,VAULT_NAME,trackedMigration } from './install-staging-notifications.mjs'
import {STAGING_REF} from './staging-seed.mjs'
const env={SUPABASE_ACCESS_TOKEN:'sbp_fixture_private',BREVO_API_KEY:'fixture_private_brevo',NOTIFICATION_SENDER_EMAIL:'Sender@club-fictif.fr',NOTIFICATION_STAGING_RECIPIENTS:'Tester@club-fictif.fr,tester@club-fictif.fr'}
function setup({existing=false,project={},senderActive=true,jobs=[],failure,shutdownFailure=false}={}){
 const calls=[],log=vi.fn(),state={outbox:existing,settings:existing,caci:existing,prerequisites:true},extensions=['pg_cron','pg_net','supabase_vault'].map(name=>({name,installed_version:existing?'1':null}))
 let savedDispatch=existing?'a'.repeat(64):null,failed=false
 const fetcher=vi.fn(async(url,options={})=>{
  const body=options.body instanceof FormData ? options.body : options.body ? JSON.parse(options.body) : null
  const call={url,options,body};calls.push(call)
  if(failure?.(call) || (failed && shutdownFailure && (url.endsWith('/secrets') || body?.query===disableSql))){failed=true;throw Error('secret provider detail '+env.BREVO_API_KEY)}
  let data
  if(url==='https://api.brevo.com/v3/senders')data={senders:[{email:'sender@club-fictif.fr',active:senderActive}]}
  else if(url.endsWith(STAGING_REF))data={ref:STAGING_REF,name:'ifosse-staging',status:'ACTIVE_HEALTHY',...project}
  else if(url.endsWith('/secrets'))data=[]
  else if(url.includes('/functions/deploy'))data={slug:'member-notifications',verify_jwt:false,status:'ACTIVE'}
  else {
   const q=body.query
   if(q===preflightSql)data=[{...state}]
   else if(q===settingsSql)data=[{private:true,environment:'preview',project_ref:STAGING_REF}]
   else if(q===extensionSql)data=extensions
   else if(q===jobsSql)data=jobs
   else if(q.startsWith('select decrypted_secret'))data=savedDispatch?[{decrypted_secret:savedDispatch}]:[]
   else if(q.startsWith('select vault.create_secret')){savedDispatch=body.parameters[0];data=[]}
   else if(q===enableSql)data=[{enabled:true}]
   else if(q.includes('create table public.member_notification_settings')){state.outbox=state.settings=true;data=[]}
   else if(q.includes('create function public.queue_caci_audit_notification')){state.caci=true;data=[]}
   else if(q===scheduleSql){jobs.splice(0,jobs.length,{jobid:1,jobname:JOB_NAME,command:cronCommand,active:true});data=[]}
   else data=[]
  }
  return new Response(JSON.stringify(data),{status:200})
 })
 const run=options=>installNotifications({env,fetcher,log,...options})
 const writes=()=>calls.filter(c=>c.url.endsWith('/secrets') || c.body instanceof FormData || c.body?.read_only===false)
 return {calls,run,writes,log,state,jobs,getDispatch:()=>savedDispatch}
}
it.each([{SUPABASE_URL:'https://production.supabase.co'},{SUPABASE_PROJECT_ENV:'production'},{SUPABASE_PROJECT_REF:'production'},{SUPABASE_ACCESS_TOKEN:'service-role'},{NOTIFICATION_STAGING_RECIPIENTS:'*'},{NOTIFICATION_STAGING_RECIPIENTS:'*@club-fictif.fr'},{NOTIFICATION_STAGING_RECIPIENTS:'fake@ifosse-seed.invalid'}])('rejects conflicting production/operator config before any request %j',async patch=>{const s=setup();await expect(s.run({env:{...env,...patch},args:['--apply']})).rejects.toThrow();expect(s.calls).toHaveLength(0)})
it.each([{ref:'production'},{name:'production'},{status:'PAUSED'}])('positively verifies staging metadata before writes %j',async project=>{const s=setup({project});await expect(s.run({args:['--apply']})).rejects.toThrow();expect(s.writes()).toHaveLength(0)})
it('rejects unverified sender without writes',async()=>{const s=setup({senderActive:false});await expect(s.run({args:['--apply']})).rejects.toThrow('non vérifié');expect(s.writes()).toHaveLength(0)})
it('dry-run only reads, pins every management request, and logs no credentials/addresses',async()=>{const s=setup();await s.run();expect(s.writes()).toHaveLength(0);for(const c of s.calls.filter(c=>c.body?.query))expect(c.body.read_only).toBe(true);expect(s.calls.every(c=>c.url.startsWith(`https://api.supabase.com/v1/projects/${STAGING_REF}`)||c.url==='https://api.brevo.com/v3/senders')).toBe(true);expect(s.log.mock.calls.join()).toContain('aucune écriture');for(const value of Object.values(env))expect(s.log.mock.calls.join()).not.toContain(value)})
it('checks allowlisted migration integrity before contacting providers',async()=>{const s=setup();await expect(s.run({sources:()=>installationSources(async()=> 'alter table wrong;')})).rejects.toThrow('absents ou modifiés');expect(s.calls).toHaveLength(0)})
it('installs paused, deploys both sources, schedules once and enables SQL last',async()=>{const s=setup();await s.run({args:['--apply']});const writes=s.writes();expect(writes[0].body).toEqual([{name:'NOTIFICATION_ENABLED',value:'false'}]);const deployment=writes.find(c=>c.body instanceof FormData);expect(JSON.parse(deployment.body.get('metadata'))).toEqual({name:'member-notifications',entrypoint_path:'index.ts',verify_jwt:false});expect(deployment.body.getAll('file').map(f=>f.name)).toEqual(['index.ts','handler.mjs']);expect(writes.at(-1).body).toEqual({query:enableSql,parameters:[['tester@club-fictif.fr']],read_only:false});expect(s.jobs).toHaveLength(1);expect(s.getDispatch()).toHaveLength(64);expect(writes.some(c=>c.body?.parameters?.[1]===VAULT_NAME)).toBe(true)})
it('reruns without repeating migrations, rotating Vault or accumulating schedules',async()=>{const s=setup({existing:true,jobs:[{jobid:1,jobname:JOB_NAME,command:cronCommand,active:false}]});await s.run({args:['--apply']});await s.run({args:['--apply']});expect(s.jobs).toHaveLength(1);expect(s.getDispatch()).toBe('a'.repeat(64));expect(s.writes().some(c=>c.body?.query?.includes('create table'))).toBe(false);expect(s.writes().some(c=>c.body?.query?.includes('vault.create_secret'))).toBe(false);expect(s.writes().some(c=>/delete|truncate/i.test(c.body?.query??''))).toBe(false)})
it.each([[{jobname:JOB_NAME,command:'select something_else()'}],[{jobname:'someone-else',command:cronCommand}],[{jobname:JOB_NAME,command:cronCommand},{jobname:JOB_NAME,command:cronCommand}]])('never replaces an ambiguous/foreign scheduler %j',async(...entries)=>{const jobs=Array.isArray(entries[0])?entries[0]:entries;const s=setup({existing:true,jobs});await expect(s.run({args:['--apply']})).rejects.toThrow('Cron existante différente');expect(s.writes()).toHaveLength(0);expect(s.jobs).toEqual(jobs)})
it('deployment failure disables both gates, suppresses provider detail, and can be retried',async()=>{let stop=true;const s=setup({existing:true,failure:c=>stop&&c.body instanceof FormData});await expect(s.run({args:['--apply']})).rejects.toThrow('envoi désactivé');expect(s.writes().at(-1).body.query).toBe(disableSql);expect(s.writes().filter(c=>c.url.endsWith('/secrets')).at(-1).body).toEqual([{name:'NOTIFICATION_ENABLED',value:'false'}]);stop=false;await s.run({args:['--apply']});expect(s.jobs).toHaveLength(1);expect(s.log.mock.calls.join()).not.toContain(env.BREVO_API_KEY)})
it('reports when automatic shutdown cannot be confirmed',async()=>{const s=setup({existing:true,failure:c=>c.body instanceof FormData,shutdownFailure:true});await expect(s.run({args:['--apply']})).rejects.toThrow('désactivation automatique non confirmée')})
it('guided input marks both secrets as hidden and normalizes emails',async()=>{const s=setup();const ask=vi.fn();for(const value of Object.values(env))ask.mockResolvedValueOnce(value);await s.run({env:{},ask});expect(ask.mock.calls.map(c=>c[1])).toEqual([true,true,false,false]);expect(s.writes()).toHaveLength(0)})
it('interactive prompt never echoes a secret into terminal output',async()=>{const input=new PassThrough();input.isTTY=true;input.setRawMode=vi.fn();let printed='';const output=new Writable({write(chunk,_encoding,done){printed+=chunk.toString();done()}});output.isTTY=true;const prompt=createHiddenPrompt(input,output);try{const pending=prompt.ask('Clé : ',true);input.write('very-private-key\r');expect(await pending).toBe('very-private-key');expect(printed).toContain('Clé : ');expect(printed).not.toContain('very-private-key')}finally{prompt.close();input.end()}})
it('help and unknown arguments never contact providers',async()=>{const s=setup();await s.run({args:['--help'],env:{}});await expect(s.run({args:['--force']})).rejects.toThrow('Option inconnue');expect(s.calls).toHaveLength(0)})

it('records only pinned migrations atomically without rewriting existing history',async()=>{const local=await installationSources();const sql=trackedMigration(local.migrations[0],0);expect(sql.startsWith('begin;')).toBe(true);expect(sql.endsWith('commit;')).toBe(true);expect(sql).toContain("insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261008150000','member_notifications'");expect(sql.slice(sql.lastIndexOf('create schema if not exists supabase_migrations'),sql.indexOf('array['))).not.toMatch(/on conflict|delete from supabase_migrations|truncate/i);expect(sql).toContain("array['"+local.migrations[0].replaceAll("'","''")+"']");expect(()=>trackedMigration('untrusted',0)).toThrow()})
