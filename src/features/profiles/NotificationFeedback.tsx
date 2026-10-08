import { useCallback, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import { useSharedRefresh } from '../../lib/useSharedRefresh'
export type NotificationReceipt={memberId:string;eventType:string}
const labels:Record<string,string>={
 pending:'Email de notification en attente d’envoi.',processing:'Email de notification en cours de traitement.',
 accepted:'Email de notification accepté par le service d’envoi.',
 suppressed:'Email non envoyé : destinataire exclu des notifications de cet environnement.',disabled:'Email non envoyé : notifications désactivées.',
 failed:'Modification enregistrée, mais l’email n’a pas pu être envoyé. Contactez l’opérateur.',
 uncertain:'Modification enregistrée. L’envoi de l’email doit être vérifié par l’opérateur avant toute relance.',
 unavailable:'Modification enregistrée. Le statut de l’email est indisponible.',
}
export function NotificationFeedback({client,receipt}:{client:SupabaseClient<Database>;receipt:NotificationReceipt}) {
 const [status,setStatus]=useState('unavailable')
 const sequence=useRef(0)
 const load=useCallback(async()=>{
  const request=++sequence.current
  try{const result=await client.rpc('member_notification_status',{p_member_id:receipt.memberId,p_event_type:receipt.eventType});if(request!==sequence.current)return;setStatus(!result.error && typeof result.data==='string' && labels[result.data]?result.data:'unavailable')}
  catch{if(request===sequence.current)setStatus('unavailable')}
 },[client,receipt.memberId,receipt.eventType])
 useSharedRefresh(load)
 return <p className="muted" role="status">{labels[status]}</p>
}
