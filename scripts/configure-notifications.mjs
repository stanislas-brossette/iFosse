import { pathToFileURL } from 'node:url'
import { createOperatorClient } from './operator-client.mjs'
import { readStagingConfig } from './staging-seed.mjs'
export async function configureNotifications({args=[],env=process.env,clientFactory=createOperatorClient,log=console.log}={}){
 if(args.length===1 && args[0]==='--help'){log('npm run staging:notifications [-- --apply | --disable]. Default: dry-run. Pinned staging only.');return}
 if(args.length>1 || (args.length && !['--apply','--disable'].includes(args[0])))throw new Error('Invalid notification arguments.')
 const target=readStagingConfig(env)
 const recipients=(env.NOTIFICATION_STAGING_RECIPIENTS ?? '').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean)
 if(!recipients.length || recipients.some(e=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || /(?:@|\.)(?:test|invalid|example|localhost)$|@(?:[^@]+\.)?example\.(?:com|net|org)$/i.test(e)))throw new Error('Provide explicit real staging test recipients.')
 const client=clientFactory(env)
 const settings=await client.from('member_notification_settings').select('enabled,environment,project_ref').single()
 if(settings.error || !settings.data)throw new Error('Notification migration/preflight unavailable.')
 log(`Target: ${target.project} / ${target.ref} / preview. Authorized test recipients: ${new Set(recipients).size}.`)
 if(!args.length){log('Dry-run: no writes. Apply enables notifications for FUTURE actions only; Edge secrets/deployment and scheduler must be configured separately.');return}
 const result=await client.rpc('configure_member_notifications',{p_enabled:args[0]!=='--disable',p_environment:'preview',p_project_ref:target.ref,p_staging_recipients:[...new Set(recipients)]})
 if(result.error)throw new Error('Notification configuration refused.')
 log(args[0]==='--disable'?'Staging notifications disabled.':'Staging notifications enabled for the explicit recipient list. No emails were sent by this command.')
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){try{await configureNotifications({args:process.argv.slice(2)})}catch{console.error('Notification configuration failed. Check the pinned staging operator environment, explicit recipients and migration. No secrets/provider responses are printed.');process.exitCode=1}}
