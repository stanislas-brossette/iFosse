const pins={preview:{ref:'btpojwwwsxrepsehmxbm',site:'https://ifosse-staging.netlify.app'},production:{ref:'qjrpxuatsnvrqxhzklzq',site:'https://ifosse.netlify.app'}}
const fake=email=>/(?:@|\.)(?:invalid|test|example|localhost)$|@(?:[^@]+\.)?example\.(?:com|net|org)$/i.test(email)
export function notificationConfig(env){
  const pin=pins[env.NOTIFICATION_ENV]
  if(env.NOTIFICATION_ENABLED!=='true' || !pin || env.SUPABASE_URL!==`https://${pin.ref}.supabase.co`)throw new Error('NOTIFICATION_CONFIGURATION')
  if(!env.BREVO_API_KEY || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.NOTIFICATION_SENDER_EMAIL ?? '') || fake(env.NOTIFICATION_SENDER_EMAIL))throw new Error('NOTIFICATION_CONFIGURATION')
  if(!env.NOTIFICATION_DISPATCH_SECRET || env.NOTIFICATION_DISPATCH_SECRET.length<32)throw new Error('NOTIFICATION_CONFIGURATION')
  const allowed=(env.NOTIFICATION_STAGING_RECIPIENTS ?? '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)
  if(env.NOTIFICATION_ENV==='preview' && (!allowed.length || allowed.some(email=>fake(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))))throw new Error('NOTIFICATION_CONFIGURATION')
  return {...pin,environment:env.NOTIFICATION_ENV,allowed,key:env.BREVO_API_KEY,secret:env.NOTIFICATION_DISPATCH_SECRET,sender:env.NOTIFICATION_SENDER_EMAIL}
}
const templates={
 welcome:['Bienvenue sur iFosse','Votre compte adhérent a été créé. Pour vous connecter, ouvrez iFosse, saisissez votre adresse email et demandez votre lien de connexion. Aucun mot de passe n’est nécessaire.'],
 deactivated:['Votre accès iFosse a été désactivé','Votre accès a été désactivé par le président. Les historiques du club sont conservés. Pour toute question, contactez le président du club.'],
 reactivated:['Votre accès iFosse a été réactivé','Votre accès a été réactivé. Vous pouvez demander un nouveau lien de connexion depuis iFosse.'],
 admin_granted:['Vos droits iFosse ont été mis à jour','Les droits administrateur vous ont été accordés. Vous pouvez gérer les séances et les informations opérationnelles des adhérents.'],
 admin_revoked:['Vos droits iFosse ont été mis à jour','Vos droits administrateur ont été retirés. Vous conservez votre accès adhérent.'],
 presidency_received:['La présidence iFosse vous a été transférée','Vous avez reçu le rôle Président. Vous pouvez gérer les droits et les accès des adhérents, ainsi que les opérations du club.'],
 presidency_departed:['Votre transfert de présidence iFosse est confirmé','Vous avez transféré la présidence. Vous restez administrateur et conservez les fonctions opérationnelles du club. Les droits présidentiels sont désormais détenus par votre successeur.'],
}
export function notificationMessage(row,config){
 const template=templates[row.kind]
 if(!template)throw new Error('UNKNOWN_NOTIFICATION')
 // Text only: no HTML injection, medical details, login token or password.
 return {sender:{name:'iFosse — APSAP',email:config.sender},to:[{email:row.recipient_email}],subject:template[0],textContent:`Bonjour ${row.first_name},\n\n${template[1]}\n\nModification enregistrée le ${new Date(row.occurred_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})} (heure de Paris). Cet email décrit cette modification ; vos droits actuels sont ceux affichés dans l’application.\n\niFosse : ${config.site}\n\nSi cette modification vous semble inattendue, contactez le président du club.`,headers:{idempotencyKey:row.id}}
}
const response=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
export function notificationHandler({env,serviceClient,fetcher=fetch}){
 return async request=>{
  if(request.method!=='POST')return response(405,{code:'METHOD_NOT_ALLOWED'})
  let config
  try{config=notificationConfig(env)}catch{return response(503,{code:'NOTIFICATION_CONFIGURATION'})}
  if(request.headers.get('Authorization')!==`Bearer ${config.secret}`)return response(401,{code:'UNAUTHORIZED'})
  try{
   const db=serviceClient()
   const claimed=await db.rpc('claim_member_notifications',{p_environment:config.environment,p_project_ref:config.ref,p_limit:10})
   if(claimed.error)return response(503,{code:'QUEUE_UNAVAILABLE'})
   const counts={processed:0,accepted:0,suppressed:0,retry:0,failed:0,uncertain:0}
   for(const row of claimed.data ?? []){
    let outcome='uncertain',code='provider_uncertain',messageId=null
    if(fake(row.recipient_email) || (config.environment==='preview' && !config.allowed.includes(row.recipient_email))){outcome='suppressed';code='recipient_blocked'}
    else{
     try{
      const result=await fetcher('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':config.key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(notificationMessage(row,config)),signal:AbortSignal.timeout(10000)})
      if(result.status===429){outcome='retry';code='rate_limited'}
      else if(result.status>=400 && result.status<500){
       const payload=await result.json().catch(()=>({}))
       if(payload.code==='duplicate_parameter'){outcome='accepted';code='provider_deduplicated'}else{outcome='failed';code='provider_rejected'}
      }else if(result.ok){
       const payload=await result.json()
       if(typeof payload.messageId==='string' && payload.messageId.length<=500){outcome='accepted';code='provider_accepted';messageId=payload.messageId}
      }
     }catch{/* Unknown acceptance: quarantine, do not blindly resend. */}
    }
    const saved=await db.rpc('complete_member_notification',{p_id:row.id,p_lease_token:row.lease_token,p_outcome:outcome,p_code:code,p_message_id:messageId ?? undefined})
    if(saved.error || saved.data!==true)return response(503,{code:'QUEUE_ACKNOWLEDGEMENT_UNAVAILABLE'})
    counts.processed++;counts[outcome]++
   }
   return response(200,counts)
  }catch{return response(503,{code:'DISPATCH_UNAVAILABLE'})}
 }
}
