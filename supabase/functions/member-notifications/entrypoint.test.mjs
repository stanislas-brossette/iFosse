// @vitest-environment node
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import {it,expect,vi} from 'vitest'
import {notificationHandler} from './handler.mjs'

// Execute the actual Deno entrypoint, including its environment projection.
// Only external SDK/network boundaries are replaced; the real handler runs.
const code=ts.transpileModule(readFileSync(new URL('./index.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const base={SUPABASE_URL:'https://btpojwwwsxrepsehmxbm.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only-fixture',NOTIFICATION_ENV:'preview',NOTIFICATION_ENABLED:'true',NOTIFICATION_DISPATCH_SECRET:'fixture-dispatch-secret-with-32-characters',NOTIFICATION_SENDER_EMAIL:'sender@club-fictif.fr',BREVO_API_KEY:'private-provider-fixture'}
function boot(patch){
 const env={...base,...patch}
 const row={id:'18210000-0000-4000-8000-000000000001',lease_token:'18210000-0000-4000-8000-000000000002',recipient_email:'new@club-fictif.fr',first_name:'Fictif',kind:'welcome',occurred_at:'2026-10-18T20:00:00Z'}
 const rpc=vi.fn(async name=>name==='claim_member_notifications' ? {data:[row],error:null} : {data:true,error:null})
 const createClient=vi.fn(()=>({rpc}))
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({messageId:'fixture-receipt'}),{status:201}))
 const serve=vi.fn(),get=vi.fn(key=>env[key])
 runInNewContext(code,{exports:{},Deno:{env:{get},serve},require(name){
  if(name==='npm:@supabase/supabase-js@2.117.2')return {createClient}
  if(name==='./handler.mjs')return {notificationHandler:options=>notificationHandler({...options,fetcher})}
  throw Error('Unexpected entrypoint dependency')
 }})
 const request=(method='POST',token=base.NOTIFICATION_DISPATCH_SECRET)=>serve.mock.calls[0][0](new Request('https://edge.example.test',{method,headers:{Authorization:`Bearer ${token}`}}))
 return {request,rpc,fetcher,createClient,get}
}
it('boots the deployed registered-mode entrypoint and sends an eligible claimed row',async()=>{
 const app=boot({NOTIFICATION_RECIPIENT_MODE:'registered',NOTIFICATION_STAGING_RECIPIENTS:''})
 const result=await app.request()
 expect(result.status).toBe(200)
 expect((await result.json()).accepted).toBe(1)
 expect(app.get).toHaveBeenCalledWith('NOTIFICATION_RECIPIENT_MODE')
 expect(app.createClient).toHaveBeenCalledWith(base.SUPABASE_URL,base.SUPABASE_SERVICE_ROLE_KEY,expect.any(Object))
 expect(app.fetcher).toHaveBeenCalledOnce()
})
it('keeps the deployed default allowlist path compatible',async()=>{
 const app=boot({NOTIFICATION_STAGING_RECIPIENTS:'new@club-fictif.fr'})
 expect((await (await app.request()).json()).accepted).toBe(1)
})
it('rejects invalid runtime audience before queue or provider access',async()=>{
 const app=boot({NOTIFICATION_RECIPIENT_MODE:'invalid',NOTIFICATION_STAGING_RECIPIENTS:'new@club-fictif.fr'})
 expect((await app.request()).status).toBe(503)
 expect(app.createClient).not.toHaveBeenCalled()
 expect(app.fetcher).not.toHaveBeenCalled()
})


it('checks the real entrypoint readiness without touching the queue or provider',async()=>{
 const app=boot({NOTIFICATION_RECIPIENT_MODE:'registered',NOTIFICATION_STAGING_RECIPIENTS:''})
 const result=await app.request('GET')
 expect(await result.json()).toEqual({code:'READY',environment:'preview',recipient_mode:'registered'})
 expect(app.createClient).not.toHaveBeenCalled()
 expect(app.fetcher).not.toHaveBeenCalled()
})
