import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import { navigate } from '../../lib/navigation'
import { Icon } from '../../components/Visual'
import { noticeRoute, parseInbox } from './model'
import type { Inbox, Notice } from './model'

export function NotificationCenter({client}:{client:SupabaseClient<Database>}) {
  const [inbox,setInbox]=useState<Inbox|null>(null)
  const [open,setOpen]=useState(false)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const dialog=useRef<HTMLDialogElement>(null)
  const button=useRef<HTMLButtonElement>(null)
  const alive=useRef(false), fetching=useRef(false), unavailable=useRef(false)
  const load=useCallback(async (after?:Notice) => {
    if(fetching.current || unavailable.current)return
    fetching.current=true;setBusy(true)
    try {
      const {data,error:failure}=await client.rpc('get_my_notifications',after?{p_before_time:after.created_at,p_before_id:after.id}:{})
      if(!alive.current)return
      if(failure) {
        // Rolling out the frontend before the additive migration stays harmless.
        if(['PGRST202','42883'].includes(failure.code)){unavailable.current=true;setInbox(null);return}
        throw new Error('Unavailable')
      }
      const next=parseInbox(data)
      setInbox(previous=>after && previous ? {...next,items:[...previous.items,...next.items.filter(item=>!previous.items.some(existing=>existing.id===item.id))]} : next)
      setError('')
    } catch {if(alive.current)setError('Notifications indisponibles. Réessayez.')} finally {fetching.current=false;if(alive.current)setBusy(false)}
  },[client])
  useEffect(()=>{
    alive.current=true;unavailable.current=false
    void load()
    const refresh=()=>{if(document.visibilityState==='visible' && !dialog.current?.open)void load()}
    window.addEventListener('focus',refresh)
    const timer=window.setInterval(refresh,15000)
    return ()=>{alive.current=false;window.clearInterval(timer);window.removeEventListener('focus',refresh)}
  },[load])
  useEffect(()=>{
    if(open){if(!dialog.current?.open)dialog.current?.showModal()}
    else if(dialog.current?.open){dialog.current.close();button.current?.focus()}
  },[open])
  function close(){dialog.current?.close();setOpen(false);button.current?.focus()}
  async function markRead(item:Notice){
    if(item.read_at)return
    try {
      const {error:failure}=await client.rpc('mark_app_notifications_read',{p_ids:[item.id]})
      if(!alive.current)return
      if(failure)throw new Error('Unavailable')
      setInbox(previous=>previous?{...previous,unread_count:Math.max(0,previous.unread_count-(previous.items.find(row=>row.id===item.id)?.read_at?0:1)),items:previous.items.map(row=>row.id===item.id?{...row,read_at:new Date().toISOString()}:row)}:previous)
      setError('')
    } catch {if(alive.current)setError('Lecture non enregistrée. Réessayez.')}
  }
  if(!inbox?.enabled)return null
  return <div className="notification-center">
    <button ref={button} type="button" className="notification-bell secondary" aria-label={`Notifications${inbox.unread_count?` : ${inbox.unread_count} non lues`:''}`} aria-haspopup="dialog" onClick={()=>{setOpen(true);void load()}}><Icon name="bell"/><span className="notification-label">Notifications</span>{inbox.unread_count>0 && <span className="notification-count" aria-hidden="true">{inbox.unread_count>99?'99+':inbox.unread_count}</span>}</button>
    <dialog ref={dialog} className="notification-dialog" aria-labelledby="notifications-title" onCancel={event=>{event.preventDefault();close()}}>
      <div className="page-heading"><h2 id="notifications-title">Mes notifications</h2><button type="button" autoFocus className="secondary" onClick={close}>Fermer</button></div>
      <p className="muted">Ces messages décrivent un changement passé. Consultez la séance ou votre profil pour les informations à jour.</p>
      {error && <p role="alert">{error} <button disabled={busy} onClick={()=>void load()}>Réessayer</button></p>}
      {!inbox.items.length && <p>Aucune notification pour le moment.</p>}
      <ul className="notification-list">{inbox.items.map(item=><li key={item.id} className={item.read_at?'':'notification-unread'}>
        <div className="notification-meta"><span>{item.read_at?'Lue':'Non lue'}</span><time dateTime={item.created_at}>{new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date(item.created_at))}</time></div>
        <h3>{item.title}</h3><p>{item.message}</p>
        <div className="actions"><button className="secondary" onClick={()=>{void markRead(item);close();navigate(noticeRoute(item))}}>{item.kind==='caci_updated'?'Voir mon profil':'Voir la séance'}</button>{!item.read_at && <button className="secondary" onClick={()=>void markRead(item)}>Marquer comme lue</button>}</div>
      </li>)}</ul>
      {inbox.has_more && <button className="secondary" disabled={busy} onClick={()=>void load(inbox.items.at(-1))}>{busy?'Chargement…':'Voir plus'}</button>}
    </dialog>
  </div>
}
