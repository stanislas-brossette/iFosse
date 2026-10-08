import { randomBytes, createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { STAGING_REF, STAGING_URL } from './staging-seed.mjs'

export const JOB_NAME='ifosse-member-notifications'
export const VAULT_NAME='ifosse_notification_dispatch_secret'
const endpoint=`${STAGING_URL}/functions/v1/member-notifications`
export const cronCommand=`select net.http_post(
  url := '${endpoint}',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets
      where name = '${VAULT_NAME}'
    )
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
)
where exists (
  select 1 from public.member_notification_settings
  where singleton and enabled and environment = 'preview'
    and project_ref = '${STAGING_REF}'
);`
const normalize=value=>value.replace(/\s+/g,' ').trim()
const reserved=email=>/(?:@|\.)(?:invalid|test|example|localhost)$|@(?:[^@]+\.)?example\.(?:com|net|org)$/i.test(email)
const emailValid=email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !reserved(email) && !/[*?]/.test(email)
const fail=message=>{throw new Error(message)}
export const migrationFiles=[
 ['20261008150000_member_notifications.sql','cce2a97832d0c5054c38c85bdcfc78832d14c86d0f57ae88c083200be15381dc'],
 ['20261008160000_caci_notifications.sql','89cade5b555425307c00487314b0c65b7bdb1ddbf9d102f89ee308858bf05895'],
]
export async function installationSources(reader=readFile){
 const migrations=[]
 for(const [name,digest] of migrationFiles){
  const sql=await reader(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8')
  if(createHash('sha256').update(sql).digest('hex')!==digest)fail('Migration locale inattendue : installation arrêtée.')
  migrations.push(sql)
 }
 const files=[]
 for(const name of ['index.ts','handler.mjs'])files.push({name,content:await reader(new URL(`../supabase/functions/member-notifications/${name}`,import.meta.url),'utf8')})
 return {migrations,files}
}
// Record only these two pinned migrations in the same transaction as their DDL.
// Preserve existing history; a conflicting version aborts rather than overwriting it.
export function trackedMigration(sql,index){
 const [filename]=migrationFiles[index]
 const version=filename.split('_')[0],name=filename.slice(version.length+1,-4)
 const literal=value=>"'"+value.replaceAll("'","''")+"'"
 if(!sql.startsWith('begin;') || !/commit;\s*$/.test(sql))fail('Transaction de migration inattendue.')
 const history=`create schema if not exists supabase_migrations;
 create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
 insert into supabase_migrations.schema_migrations(version,name,statements) values (${literal(version)},${literal(name)},array[${literal(sql)}]);`
 return sql.replace(/commit;\s*$/,()=>history+'\ncommit;')
}
export function validateJobs(jobs){
 if(!Array.isArray(jobs))fail('Réponse Cron invalide.')
 const relevant=jobs.filter(job=>job.jobname===JOB_NAME || job.command?.includes(endpoint))
 if(relevant.length>1 || relevant.some(job=>job.jobname!==JOB_NAME || normalize(job.command ?? '')!==normalize(cronCommand)))fail('Tâche Cron existante différente : aucun remplacement automatique. Consulter le guide.')
 return relevant[0]
}
export const preflightSql=`select
 to_regprocedure('public.set_member_caci_if_current(uuid,date,date)') is not null
 and to_regprocedure('public.transfer_presidency(uuid)') is not null
 and to_regclass('public.audit_events') is not null
 and to_regclass('public.staging_seed_runs') is not null as prerequisites,
 to_regclass('public.member_notifications') is not null as outbox,
 to_regclass('public.member_notification_settings') is not null as settings,
 exists(select 1 from pg_trigger where tgname='audit_queue_caci_notification' and tgrelid=to_regclass('public.audit_events') and not tgisinternal and tgenabled<>'D' and tgfoid=to_regprocedure('public.queue_caci_audit_notification()')) as caci;
`
export const settingsSql=`select enabled,environment,project_ref,
 (select relrowsecurity from pg_class where oid='public.member_notifications'::regclass)
 and (select relrowsecurity from pg_class where oid='public.member_notification_settings'::regclass)
 and not has_table_privilege('authenticated','public.member_notifications','SELECT')
 and not has_table_privilege('authenticated','public.member_notification_settings','UPDATE')
 and to_regprocedure('public.claim_member_notifications(text,text,integer)') is not null
 and to_regprocedure('public.enqueue_member_notification(public.audit_events,uuid,text)') is not null as private
 from public.member_notification_settings where singleton;`
export const extensionSql=`select name,installed_version from pg_available_extensions where name in ('pg_cron','pg_net','supabase_vault');`
export const jobsSql=`select jobid,jobname,command,active from cron.job;`
export const enableSql=`update public.member_notification_settings set enabled=true,environment='preview',project_ref='${STAGING_REF}',staging_recipients=$1::text[] where singleton returning enabled;`
export const disableSql='update public.member_notification_settings set enabled=false where singleton;'
// Recheck ownership inside the scheduling transaction, including concurrent edits.
export const scheduleSql=`do $install$
 declare j record; v_id bigint; v_count integer;
 begin
  perform pg_advisory_xact_lock(hashtext('ifosse:notification-installer'));
  select count(*) into v_count from cron.job where jobname='${JOB_NAME}' or position('${endpoint}' in command)>0;
  if v_count>1 then raise exception 'Duplicate notification schedules'; end if;
  for j in select * from cron.job where jobname='${JOB_NAME}' or position('${endpoint}' in command)>0 loop
   if j.jobname<>'${JOB_NAME}' or regexp_replace(btrim(j.command),'\\s+',' ','g')<>regexp_replace(btrim($command$${cronCommand}$command$),'\\s+',' ','g') then
    raise exception 'Unexpected notification schedule';
   end if;
  end loop;
  select cron.schedule('${JOB_NAME}','* * * * *',$command$${cronCommand}$command$) into v_id;
  perform cron.alter_job(v_id,active:=true);
 end;
 $install$;`

export function createHiddenPrompt(input=process.stdin,output=process.stdout){
 if(!input.isTTY || !output.isTTY)fail('Terminal interactif requis ; sinon fournir les variables opérateur. Voir --help.')
 let muted=false
 const sink=new Writable({write(chunk,encoding,done){if(!muted)output.write(chunk,encoding);done()}})
 const rl=createInterface({input,output:sink,terminal:true,historySize:0})
 return {close:()=>rl.close(),ask:async(label,secret=false)=>{
  if(!secret)return rl.question(label)
  output.write(label);muted=true
  try{return await rl.question('')}finally{muted=false;output.write('\n')}
 }}
}

export async function installNotifications({args=[],env=process.env,fetcher=fetch,sources=installationSources,ask,log=console.log}={}){
 if(args.length===1 && args[0]==='--help'){
  log('npm run staging:notifications:install [-- --apply]\nSans --apply : vérifications et plan, aucune écriture. Staging fixé, production refusée.\nSaisie guidée ou variables : SUPABASE_ACCESS_TOKEN, BREVO_API_KEY, NOTIFICATION_SENDER_EMAIL, NOTIFICATION_STAGING_RECIPIENTS. Secrets masqués, jamais sauvegardés.');return
 }
 if(args.length>1 || (args.length===1 && args[0]!=='--apply'))fail('Option inconnue. Voir --help.')
 if((env.SUPABASE_URL && env.SUPABASE_URL!==STAGING_URL) || (env.SUPABASE_PROJECT_ENV && env.SUPABASE_PROJECT_ENV!=='preview') || (env.SUPABASE_PROJECT_REF && env.SUPABASE_PROJECT_REF!==STAGING_REF))fail('Configuration différente du projet staging fixé. Aucune requête effectuée.')
 const apply=args[0]==='--apply'
 const collect=async(key,label,secret=false)=>{
  const value=(env[key] ?? (ask ? await ask(label,secret) : '')).trim()
  if(!value || /[\r\n\0]/.test(value))fail(`Valeur ${key} manquante ou invalide. Voir --help.`)
  return value
 }
 const token=await collect('SUPABASE_ACCESS_TOKEN','Jeton personnel Supabase (masqué) : ',true)
 if(!token.startsWith('sbp_'))fail('Un jeton personnel Supabase est requis, pas une clé de projet.')
 const key=await collect('BREVO_API_KEY','Clé API Brevo (masquée) : ',true)
 const sender=(await collect('NOTIFICATION_SENDER_EMAIL','Adresse expéditeur vérifiée Brevo : ')).toLowerCase()
 const recipients=[...new Set((await collect('NOTIFICATION_STAGING_RECIPIENTS','Emails testeurs autorisés (virgules) : ')).split(',').map(x=>x.trim().toLowerCase()))]
 if(!emailValid(sender) || !recipients.length || recipients.some(x=>!emailValid(x)))fail('Expéditeur/destinataires réels exacts requis, sans wildcard ni domaine réservé.')
 let local
 try{local=await sources()}catch{fail('Fichiers de migration/fonction absents ou modifiés : vérifier le checkout de la PR. Aucune écriture.')} // Integrity check before hosted writes.
 let verified=false,writing=false,settingsPresent=false
 const api=async(path,{method='GET',body,write=false}={})=>{
  if(write && (!apply || !verified))fail('Écriture refusée avant validation staging/--apply.')
  try{
   const response=await fetcher(`https://api.supabase.com/v1/projects/${STAGING_REF}${path}`,{method,headers:{Authorization:`Bearer ${token}`,...(body && !(body instanceof FormData) ? {'Content-Type':'application/json'} : {})},body:body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,redirect:'error',signal:AbortSignal.timeout(120000)})
   if(!response.ok)fail(`API Supabase refusée (HTTP ${response.status}).`)
   const text=await response.text();return text ? JSON.parse(text) : null
  }catch{fail('Accès Supabase indisponible/refusé. Vérifier jeton et permissions ; aucune réponse fournisseur affichée.')}
 }
 const sql=(query,parameters=[],write=false)=>api('/database/query',{method:'POST',body:{query,parameters,read_only:!write},write})
 const secrets=values=>api('/secrets',{method:'POST',body:Object.entries(values).map(([name,value])=>({name,value})),write:true})
 const project=await api('')
 if((project.ref ?? project.id)!==STAGING_REF || project.name!=='ifosse-staging' || project.status!=='ACTIVE_HEALTHY')fail('Projet staging attendu absent, renommé ou indisponible. Aucune écriture.')
 verified=true
 let senderResponse
 try{
  const response=await fetcher('https://api.brevo.com/v3/senders',{headers:{'api-key':key},redirect:'error',signal:AbortSignal.timeout(30000)})
  if(!response.ok)throw Error('provider')
  senderResponse=await response.json()
 }catch{fail('Clé API Brevo ou accès expéditeurs refusé. Aucune écriture.')}
 if(!senderResponse.senders?.some(s=>s.email?.toLowerCase()===sender && s.active===true))fail('Expéditeur Brevo absent ou non vérifié. Aucune écriture.')
 const state=(await sql(preflightSql))?.[0]
 if(!state?.prerequisites || state.outbox!==state.settings || (state.caci && !state.outbox))fail('Schéma applicatif incomplet/inattendu : appliquer les migrations métier habituelles avant installation.')
 settingsPresent=state.settings
 if(settingsPresent){
  const settings=(await sql(settingsSql))?.[0]
  if(!settings?.private || (settings.environment && settings.environment!=='preview') || (settings.project_ref && settings.project_ref!==STAGING_REF))fail('File/configuration existante incompatible : aucune écriture.')
 }
 const extensions=await sql(extensionSql)
 if(!Array.isArray(extensions) || ['pg_cron','pg_net','supabase_vault'].some(name=>!extensions.some(e=>e.name===name)))fail('Extensions nécessaires indisponibles sur ce serveur.')
 const installed=name=>extensions.some(e=>e.name===name && e.installed_version)
 if(installed('pg_cron'))validateJobs(await sql(jobsSql))
 let dispatch
 if(installed('supabase_vault')){
  const rows=await sql('select decrypted_secret from vault.decrypted_secrets where name=$1;',[VAULT_NAME])
  if(!Array.isArray(rows) || rows.length>1)fail('Secret Vault existant ambigu.')
  dispatch=rows[0]?.decrypted_secret
  if(dispatch && dispatch.length<32)fail('Secret Vault existant trop court : aucune rotation automatique.')
 }
 log(`Cible vérifiée : ifosse-staging / ${STAGING_REF} / preview.`)
 log(`Plan : ${state.outbox ? 'conserver la file' : 'installer la file'} ; ${state.caci ? 'conserver' : 'installer'} le trigger CACI ; déployer member-notifications ; configurer ${recipients.length} destinataire(s) ; réutiliser/créer Vault et une seule tâche par minute.`)
 if(!apply){log('Dry-run terminé : aucune écriture, aucun déploiement, aucun email. Relancer avec --apply pour installer.');return}
 try{
  writing=true
  // Fail closed during upgrades; never clear pending/history or replay receipts.
  await secrets({NOTIFICATION_ENABLED:'false'})
  if(settingsPresent)await sql(disableSql,[],true)
  if(!state.outbox){await sql(trackedMigration(local.migrations[0],0),[],true);settingsPresent=true}
  if(!state.caci)await sql(trackedMigration(local.migrations[1],1),[],true)
  for(const [name,schema] of [['pg_cron','pg_catalog'],['pg_net','extensions'],['supabase_vault','vault']]){
   if(!installed(name))await sql(`create extension if not exists ${name} with schema ${schema};`,[],true)
  }
  if(!dispatch){
   dispatch=randomBytes(32).toString('hex')
   await sql('select vault.create_secret($1,$2);',[dispatch,VAULT_NAME],true)
  }
  await secrets({NOTIFICATION_ENABLED:'false',NOTIFICATION_ENV:'preview',NOTIFICATION_DISPATCH_SECRET:dispatch,NOTIFICATION_STAGING_RECIPIENTS:recipients.join(','),NOTIFICATION_SENDER_EMAIL:sender,BREVO_API_KEY:key})
  const form=new FormData()
  form.append('metadata',JSON.stringify({name:'member-notifications',entrypoint_path:'index.ts',verify_jwt:false}))
  for(const file of local.files)form.append('file',new Blob([file.content],{type:'application/typescript'}),file.name)
  const deployed=await api('/functions/deploy?slug=member-notifications',{method:'POST',body:form,write:true})
  if(deployed?.slug!=='member-notifications' || deployed.verify_jwt!==false || deployed.status!=='ACTIVE')fail('Déploiement non confirmé : activation interrompue.')
  const check=(await sql(settingsSql))?.[0]
  if(!check?.private)fail('Contrôle final de confidentialité refusé.')
  validateJobs(await sql(jobsSql))
  await sql(scheduleSql,[],true)
  await secrets({NOTIFICATION_ENABLED:'true'})
  const enabled=await sql(enableSql,[recipients],true)
  if(enabled?.[0]?.enabled!==true)fail('Activation SQL non confirmée.')
  log('Installation staging terminée. Notifications activées pour les futures actions autorisées. Aucun email de test envoyé. Tester une modification CACI depuis la preview.')
 }catch{
  if(writing){
   const shutdown=await Promise.allSettled([secrets({NOTIFICATION_ENABLED:'false'}),...(settingsPresent ? [sql(disableSql,[],true)] : [])])
   if(shutdown.some(r=>r.status==='rejected'))fail('Installation interrompue ; désactivation automatique non confirmée. Suspendre Cron et vérifier NOTIFICATION_ENABLED=false dans staging. Aucun secret affiché.')
  }
  fail('Installation interrompue, envoi désactivé. Les étapes déjà réussies sont conservées ; relancer --apply après correction des accès. Aucun secret affiché.')
 }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 let prompt
 try{
  const needsPrompt=!['SUPABASE_ACCESS_TOKEN','BREVO_API_KEY','NOTIFICATION_SENDER_EMAIL','NOTIFICATION_STAGING_RECIPIENTS'].every(name=>process.env[name])
  if(needsPrompt && !process.argv.includes('--help'))prompt=createHiddenPrompt()
  await installNotifications({args:process.argv.slice(2),ask:prompt?.ask})
 }catch(error){console.error(error instanceof Error && !error.code ? error.message : 'Installation indisponible. Vérifier les fichiers locaux et les accès ; aucun détail fournisseur affiché.');process.exitCode=1}finally{prompt?.close()}
}
