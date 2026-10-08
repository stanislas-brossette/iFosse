import { describe,it,expect,vi } from 'vitest'
import { notificationConfig,notificationHandler,notificationMessage } from './handler.mjs'
const env={NOTIFICATION_ENABLED:'true',NOTIFICATION_ENV:'preview',SUPABASE_URL:'https://btpojwwwsxrepsehmxbm.supabase.co',BREVO_API_KEY:'SECRET_PROVIDER',NOTIFICATION_DISPATCH_SECRET:'fixture-dispatch-secret-32-characters-minimum',NOTIFICATION_SENDER_EMAIL:'notifications@club-fictif.fr',NOTIFICATION_STAGING_RECIPIENTS:'allowed@club-fictif.fr'}
const row={id:'08150000-0000-4000-8000-000000000001',lease_token:'08150000-0000-4000-8000-000000000002',recipient_email:'allowed@club-fictif.fr',first_name:'<script>Fictif</script>',kind:'welcome',occurred_at:'2026-10-08T10:00:00Z'}
function setup({rows=[row],vars=env,provider=()=>new Response(JSON.stringify({messageId:'<fictitious-receipt>'}),{status:201})}={}){
 const rpc=vi.fn(async(name)=>name==='claim_member_notifications'?{data:rows,error:null}:{data:true,error:null})
 const serviceClient=vi.fn(()=>({rpc})),fetcher=vi.fn(provider)
 const handler=notificationHandler({env:vars,serviceClient,fetcher})
 const request=(token=vars.NOTIFICATION_DISPATCH_SECRET,method='POST')=>handler(new Request('https://edge.example.test',{method,headers:{Authorization:`Bearer ${token}`}}))
 return {rpc,fetcher,serviceClient,request}
}
describe('internal notification dispatcher',()=>{
 it.each([{NOTIFICATION_ENABLED:'false'},{NOTIFICATION_ENV:undefined},{SUPABASE_URL:'https://qjrpxuatsnvrqxhzklzq.supabase.co'},{SUPABASE_URL:'https://btpojwwwsxrepsehmxbm.supabase.co/'},{NOTIFICATION_STAGING_RECIPIENTS:''},{NOTIFICATION_STAGING_RECIPIENTS:'*'},{NOTIFICATION_STAGING_RECIPIENTS:'fake@ifosse-seed.invalid'},{BREVO_API_KEY:''},{NOTIFICATION_DISPATCH_SECRET:'short'},{NOTIFICATION_SENDER_EMAIL:'x@example.test'}])('fails closed before queue/network access for %j',async patch=>{
  const app=setup({vars:{...env,...patch}});expect((await app.request()).status).toBe(503);expect(app.serviceClient).not.toHaveBeenCalled();expect(app.fetcher).not.toHaveBeenCalled()
 })
 it('separately pins production and its site without inheriting preview targets',()=>{
  expect(()=>notificationConfig({...env,NOTIFICATION_ENV:'production'})).toThrow()
  expect(notificationConfig({...env,NOTIFICATION_ENV:'production',SUPABASE_URL:'https://qjrpxuatsnvrqxhzklzq.supabase.co'}).site).toBe('https://ifosse.netlify.app')
 })
 it('rejects browser/member credentials and methods before privileged reads',async()=>{
  const app=setup();expect((await app.request('member-jwt')).status).toBe(401);expect((await app.request(undefined,'GET')).status).toBe(405);expect(app.serviceClient).not.toHaveBeenCalled()
 })
 it.each(['welcome','deactivated','reactivated','admin_granted','admin_revoked','presidency_received','presidency_departed'])('renders %s as text, with fixed site and no Auth/medical payload',kind=>{
  const message=notificationMessage({...row,kind},notificationConfig(env));expect(message.subject).toBeTruthy();expect(message.textContent).toContain('https://ifosse-staging.netlify.app');expect(message.textContent).not.toMatch(/token_hash|\/auth\/confirm|CACI|mot de passe :/);expect(message.htmlContent).toBeUndefined();expect(message.headers).toEqual({idempotencyKey:row.id})
 })
 it('claims once, sends one recipient, acknowledges the exact lease, and exposes only counts',async()=>{
  const app=setup();const result=await app.request();expect(await result.json()).toEqual({processed:1,accepted:1,suppressed:0,retry:0,failed:0,uncertain:0})
  expect(app.rpc).toHaveBeenCalledWith('claim_member_notifications',{p_environment:'preview',p_project_ref:'btpojwwwsxrepsehmxbm',p_limit:10})
  const [url,options]=app.fetcher.mock.calls[0];expect(url).toBe('https://api.brevo.com/v3/smtp/email');const message=JSON.parse(options.body);expect(message.to).toEqual([{email:row.recipient_email}]);expect(message.headers.idempotencyKey).toBe(row.id)
  expect(app.rpc).toHaveBeenCalledWith('complete_member_notification',expect.objectContaining({p_id:row.id,p_lease_token:row.lease_token,p_outcome:'accepted',p_message_id:'<fictitious-receipt>'}))
 })
 it('renders the CACI change notice without current/previous validity dates, documents or other profile data',()=>{
  const message=notificationMessage({...row,kind:'caci_updated',caci_expiry_date:'2099-12-31',previous_date:'2020-01-01',phone:'PRIVATE_PHONE',document:'PRIVATE_DOCUMENT'},notificationConfig(env))
  expect(message.subject).toBe('Votre information CACI a été mise à jour')
  expect(message.textContent).toContain('Votre information CACI a été mise à jour par un administrateur. Consultez Mon profil sur iFosse pour vérifier votre date de validité.')
  expect(message.textContent).toContain('https://ifosse-staging.netlify.app')
  expect(JSON.stringify(message)).not.toMatch(/2099-12-31|2020-01-01|PRIVATE_PHONE|PRIVATE_DOCUMENT|token_hash|\/auth\/confirm/)
  expect(message.htmlContent).toBeUndefined()
  expect(message.to).toEqual([{email:row.recipient_email}])
  expect(message.headers.idempotencyKey).toBe(row.id)
 })
 it.each(['fake@ifosse-seed.invalid','fake@example.test','fake@example.com','other@club-fictif.fr'])('rechecks recipient %s before sending',async email=>{
  const app=setup({rows:[{...row,recipient_email:email}]});const result=await app.request();expect((await result.json()).suppressed).toBe(1);expect(app.fetcher).not.toHaveBeenCalled()
 })
 it.each([[429,'retry'],[400,'failed'],[500,'uncertain']])('handles HTTP %s as %s without exposing provider content',async(status,outcome)=>{
  const app=setup({provider:()=>new Response(JSON.stringify({message:'SECRET_PROVIDER'}),{status})});const result=await app.request();expect((await result.json())[outcome]).toBe(1);expect(app.rpc).toHaveBeenCalledWith('complete_member_notification',expect.objectContaining({p_outcome:outcome}));expect(app.rpc.mock.calls.join()).not.toContain('SECRET_PROVIDER')
 })
 it('quarantines network errors and malformed accepted replies rather than resending',async()=>{
  for(const provider of [()=>{throw Error('SECRET_PROVIDER')},()=>new Response('{}',{status:201})]){
   const app=setup({provider});const result=await app.request();expect((await result.json()).uncertain).toBe(1);expect(app.fetcher).toHaveBeenCalledOnce()
  }
 })
 it('recognizes provider deduplication without falsely claiming inbox delivery',async()=>{
  const app=setup({provider:()=>new Response(JSON.stringify({code:'duplicate_parameter'}),{status:400})});expect((await (await app.request()).json()).accepted).toBe(1);expect(app.rpc).toHaveBeenCalledWith('complete_member_notification',expect.objectContaining({p_code:'provider_deduplicated'}))
 })
 it('does not fetch if claiming fails, and does not retry a successful send with an unacknowledged lease',async()=>{
  const app=setup();app.rpc.mockResolvedValueOnce({data:null,error:{message:'SECRET_DATABASE'}})
  expect(await (await app.request()).text()).not.toContain('SECRET');expect(app.fetcher).not.toHaveBeenCalled()
  app.rpc.mockResolvedValueOnce({data:[row],error:null}).mockResolvedValueOnce({data:false,error:null})
  expect((await app.request()).status).toBe(503);expect(app.fetcher).toHaveBeenCalledOnce()
 })
})
