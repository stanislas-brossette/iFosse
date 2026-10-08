import { useState } from 'react'
import type { SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../../lib/database.types'
import { useUnsavedChanges } from '../../lib/navigation'
import { businessError } from '../../lib/businessErrors'
import { todayParis } from '../../lib/dates'
export type Session = Tables<'sessions'>
export function SessionEditor({ client, session, onSaved, onCancel }: { client: SupabaseClient<Database>; session?: Session; onSaved: (id: string | null) => Promise<void>; onCancel: () => void }) {
  const [values, setValues] = useState({ date: session?.date ?? todayParis(), start_time: session?.start_time.slice(0, 5) ?? '21:00', end_time: session?.end_time.slice(0, 5) ?? '22:00', title: session?.title ?? 'Séance de fosse', venue: session?.venue ?? '', address: session?.address ?? '', notes: session?.notes ?? '', capacity: session?.capacity ?? 20, registration_open: session?.registration_open ?? true, school_holiday: session?.school_holiday ?? false, end_time_estimated: session?.end_time_estimated ?? false })
  const [baseline] = useState(() => JSON.stringify(values))
  const guard = useUnsavedChanges(JSON.stringify(values) !== baseline, next => next.area === 'sessions' && (!next.editing || next.sessionId !== session?.id))
  const [message, setMessage] = useState('')
  const [messageError,setMessageError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy)return; setBusy(true);setMessageError(false); setMessage('Enregistrement en cours…')
    const { data, error } = await client.rpc('save_session', { p_id: session?.id, p_date: values.date, p_start_time: values.start_time, p_end_time: values.end_time, p_title: values.title, p_venue: values.venue, p_address: values.address, p_notes: values.notes, p_capacity: values.capacity, p_registration_open: values.registration_open, p_school_holiday: values.school_holiday, p_end_time_estimated: values.end_time_estimated })
    setMessageError(!!error)
    if (error) setMessage(businessError(error,'Enregistrement refusé. Vérifiez les horaires, la capacité et vos droits.'))
    else { guard.markClean(); await onSaved(data) }
    setBusy(false)
  }
  async function remove() {
    if (!session) return
    setBusy(true)
    const { error } = await client.rpc('delete_session', { p_session_id: session.id })
    setMessageError(!!error)
    if (error) setMessage('Suppression refusée. Réessayez après actualisation.')
    else await onSaved(null)
    setBusy(false)
  }
  return <section className="card"><h2>{session ? 'Modifier la séance' : 'Nouvelle séance'}</h2><form onChangeCapture={()=>setMessage('')} onSubmit={event => void save(event)}>
    <div className="form-grid"><label>Date de la fosse<input type="date" min="2020-01-01" max="2100-12-31" required value={values.date} onChange={event => setValues({ ...values, date: event.target.value })} /></label>
      {(['start_time', 'end_time'] as const).map((key, i) => <label key={key}>{i ? 'Fin' : 'Début'}<input type="time" required value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })} /></label>)}
      <label>Nombre de places<input type="number" min={1} max={100} step={1} required value={values.capacity} onChange={event => setValues({ ...values, capacity: Number(event.target.value) })} /></label>
      {([['title', 'Titre', 100], ['venue', 'Lieu', 150], ['address', 'Adresse et accès', 250]] as const).map(([key, label, max]) => <label key={key}>{label}<input maxLength={max} required={key === 'title'} value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })} /></label>)}
    </div><label>Informations pour les adhérents<textarea maxLength={1500} value={values.notes} onChange={event => setValues({ ...values, notes: event.target.value })} /></label>
    {([['registration_open', 'Ouvrir les inscriptions'], ['school_holiday', 'Vacances scolaires'], ['end_time_estimated', 'Heure de fin à confirmer']] as const).map(([key, label]) => <label className="check" key={key}><input type="checkbox" disabled={key === 'registration_open' && session?.status === 'closed'} checked={values[key]} onChange={event => setValues({ ...values, [key]: event.target.checked })} />{label}</label>)}
    <p>La capacité limite la sélection finale, pas le nombre de réponses Oui. Encadrants compris.</p>
    <div className="actions"><button disabled={busy}>Enregistrer la séance</button><button type="button" disabled={busy} onClick={()=>guard.protect(()=>{guard.markClean();onCancel()})}>Annuler</button></div>
    {message && <p role={messageError?'alert':'status'}>{message}</p>}</form>{session && <div className="mt">{confirmDelete ? <><p>Supprimer définitivement cette séance et ses participations ?</p><div className="actions"><button className="danger" disabled={busy} onClick={() => void remove()}>Confirmer la suppression</button><button onClick={() => setConfirmDelete(false)}>Conserver la séance</button></div></> : <button className="danger" onClick={() => setConfirmDelete(true)}>Supprimer la séance</button>}</div>}
  </section>
}
