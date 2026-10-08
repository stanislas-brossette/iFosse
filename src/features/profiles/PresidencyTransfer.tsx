import { useEffect, useId, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { businessError } from '../../lib/businessErrors'

export function PresidencyTransfer({client,current,members,onReload,onTransferred,onAccessChanged,onStart}:{client:SupabaseClient<Database>;current:Member;members:Member[];onReload:()=>Promise<void>;onTransferred:(successor:Member)=>Promise<void>;onAccessChanged:()=>Promise<void>;onStart:(action:()=>void)=>void}) {
  const [open,setOpen]=useState(false)
  const [target,setTarget]=useState<Member|null>(null)
  const [email,setEmail]=useState('')
  const [acknowledged,setAcknowledged]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [mustReload,setMustReload]=useState(false)
  const dialog=useRef<HTMLDialogElement>(null)
  const trigger=useRef<HTMLButtonElement>(null)
  const cancelButton=useRef<HTMLButtonElement>(null)
  const inFlight=useRef(false)
  const id=useId()
  const eligible=(person:Member)=>person.id!==current.id && person.role!=='president' && !person.disabled_at && !!person.auth_user_id
  const candidates=members.filter(eligible)
  const latest=members.find(person=>person.id===target?.id)
  const stale=!!target && (!latest || !eligible(latest) || latest.updated_at!==target.updated_at)
  function select(person:Member|null){setTarget(person);setEmail('');setAcknowledged(false);setError('');setMustReload(false)}
  function cancel(){if(!inFlight.current)setOpen(false)}
  useEffect(()=>{
    if(open){if(!dialog.current?.open){dialog.current?.showModal();cancelButton.current?.focus()}}
    else if(dialog.current?.open){dialog.current.close();trigger.current?.focus()}
  },[open])
  async function transfer(){
    if(inFlight.current || !target || stale || mustReload || !acknowledged || email.trim().toLowerCase()!==target.email)return
    inFlight.current=true;setBusy(true);setError('')
    try {
      const result=await client.rpc('transfer_presidency_if_current',{p_member_id:target.id,p_expected_updated_at:target.updated_at})
      if(result.error){
        setEmail('');setAcknowledged(false)
        if(result.error.code==='40001'){setMustReload(true);setError('La fiche du successeur a changé. Actualisez le choix et confirmez à nouveau. Aucun transfert effectué.');await onReload()}
        else if(result.error.code==='22023'){setMustReload(true);setError('Ce successeur n’est plus disponible. Choisissez un autre adhérent actif avec un compte de connexion.');await onReload()}
        else {setError(businessError(result.error,'Transfert non confirmé. Actualisez l’annuaire avant de réessayer.'));if(result.error.code==='42501')await onAccessChanged()}
      } else {setOpen(false);await onTransferred(target)}
    } catch {setMustReload(true);setEmail('');setAcknowledged(false);setError('Résultat du transfert indisponible. Actualisez votre accès avant toute nouvelle tentative.');await onAccessChanged()}
    finally{inFlight.current=false;setBusy(false)}
  }
  return <details className="presidency-transfer"><summary>Présidence du club · transfert exceptionnel</summary><h2 id={`${id}-section`}>Présidence du club</h2><p>Transfert exceptionnel : vous deviendrez administrateur et perdrez les droits réservés au président.</p><button ref={trigger} type="button" className="danger" onClick={()=>onStart(()=>{select(null);setOpen(true)})}>Transférer la présidence</button>
    <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-warning`} onCancel={event=>{event.preventDefault();cancel()}}>
      <h2 id={`${id}-title`}>Transférer la présidence ?</h2><p id={`${id}-warning`}>Le successeur deviendra l’unique président. Vous resterez administrateur, mais ne pourrez plus gérer les droits ni créer, désactiver ou réactiver des adhérents. Pour revenir en arrière, le nouveau président devra vous retransférer la présidence, ou un opérateur devra intervenir.</p>
      <label>Successeur<select disabled={busy} value={target?.id ?? ''} onChange={event=>select(candidates.find(person=>person.id===event.target.value) ?? null)}><option value="">Choisir un adhérent actif</option>{candidates.map(person=><option key={person.id} value={person.id}>{person.last_name} {person.first_name} · {person.email}</option>)}</select></label>
      {!candidates.length && <p>Aucun autre adhérent actif avec un compte de connexion n’est disponible.</p>}
      {target && <><p className="presidency-successor"><strong>{target.first_name} {target.last_name}</strong><br />{target.email}<br />{target.role==='admin'?'Administrateur':'Adhérent'} → Président</p><label>Recopier l’email du successeur<input type="email" autoComplete="off" spellCheck={false} disabled={busy} value={email} onChange={event=>setEmail(event.target.value)} /></label><label className="check"><input type="checkbox" disabled={busy} checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)} />Je comprends que je perdrai les droits présidentiels.</label></>}
      {(stale || mustReload) && <p role="alert">Le choix doit être actualisé et confirmé à nouveau.{latest && eligible(latest) && <button type="button" disabled={busy} onClick={()=>select(latest)}>Actualiser le choix</button>}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="actions"><button ref={cancelButton} type="button" autoFocus disabled={busy} onClick={cancel}>Annuler</button><button type="button" className="danger" disabled={busy || !target || stale || mustReload || !acknowledged || email.trim().toLowerCase()!==target?.email} onClick={()=>void transfer()}>{busy?'Transfert en cours…':'Confirmer le transfert de présidence'}</button></div>
    </dialog></details>
}
