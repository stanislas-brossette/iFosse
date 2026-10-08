import { useEffect, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { useUnsavedChanges } from '../../lib/navigation'
import { businessError } from '../../lib/businessErrors'
import { PageHeading } from '../../components/Visual'
import { caciLabels, caciStatus } from '../../lib/dates'

export function CaciEditor({ client, member, onRefresh, onSaved }: { client: SupabaseClient<Database>; member: Member; onRefresh: () => Promise<void>; onSaved?: (date: string | null) => Promise<void> }) {
  const [date, setDate] = useState(member.caci_expiry_date ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const original = useRef(member.caci_expiry_date)
  const dirty = useRef(false)
  useEffect(() => {
    if (!dirty.current) { original.current = member.caci_expiry_date; setDate(member.caci_expiry_date ?? '') }
  }, [member.caci_expiry_date])
  const guard = useUnsavedChanges(date !== (original.current ?? ''), () => false, `caci:${onSaved ? 'directory' : 'profile'}:${member.id}`)
  const changedElsewhere = original.current !== member.caci_expiry_date
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await client.rpc('set_member_caci_if_current', { p_member_id: member.id, p_expiry_date: date || undefined, p_expected_expiry_date: original.current ?? undefined })
    if (error?.code === '40001') { setMessage('Le CACI a été modifié ailleurs. Rechargez la date enregistrée avant de réessayer.'); await onRefresh() }
    else if (error) setMessage(businessError(error,'Modification du CACI refusée. Vérifiez vos droits et la date.'))
    else { guard.markClean(); original.current = date || null; dirty.current = false; setMessage('Date CACI enregistrée.'); if (onSaved) await onSaved(date || null); else await onRefresh() }
    setBusy(false)
  }
  return <form onSubmit={event => void save(event)}><label>Fin de validité CACI<input type="date" value={date} onChange={event => { dirty.current = true; setMessage(''); setDate(event.target.value) }} /></label>{changedElsewhere && <p role="alert">La date enregistrée a changé. Votre saisie est conservée; rechargez la date avant de poursuivre.</p>}<button disabled={busy || changedElsewhere}>Enregistrer le CACI</button>{(changedElsewhere || message.includes('modifié ailleurs')) && <button type="button" disabled={busy} onClick={() => { original.current = member.caci_expiry_date; dirty.current = false; setDate(member.caci_expiry_date ?? ''); setMessage('') }}>Recharger la date enregistrée</button>}{message && <p role="status">{message}</p>}</form>
}

export function Profile({ client, member, refresh }: { client: SupabaseClient<Database>; member: Member; refresh: () => Promise<void> }) {
  const [values, setValues] = useState({ first_name: member.first_name, last_name: member.last_name, phone: member.phone ?? '', current_level: member.current_level, preparing_level: member.preparing_level ?? '', has_usual_car: member.has_usual_car, usual_passenger_seats: member.usual_passenger_seats || 3, usual_meeting_point: member.usual_meeting_point })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const baseline = useRef(JSON.stringify(values))
  const guard = useUnsavedChanges(JSON.stringify(values) !== baseline.current)
  const carDefaultsDirty = useRef(false)
  useEffect(() => {
    if (!carDefaultsDirty.current) setValues(values => { const car={has_usual_car:member.has_usual_car,usual_passenger_seats:member.usual_passenger_seats || 3,usual_meeting_point:member.usual_meeting_point};baseline.current=JSON.stringify({...JSON.parse(baseline.current),...car});return {...values,...car} })
  }, [member.has_usual_car, member.usual_passenger_seats, member.usual_meeting_point])
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await client.rpc('update_own_profile', { p_first_name: values.first_name, p_last_name: values.last_name, p_phone: values.phone, p_current_level: values.current_level, p_preparing_level: values.preparing_level, p_has_usual_car: values.has_usual_car, p_usual_passenger_seats: values.usual_passenger_seats, p_usual_meeting_point: values.usual_meeting_point })
    if (error) setMessage(businessError(error,'Enregistrement refusé. Vérifiez les champs et réessayez.'))
    else { baseline.current = JSON.stringify(values); guard.markClean(); carDefaultsDirty.current = false; setMessage('Profil enregistré.'); await refresh() }
    setBusy(false)
  }
  const textFields = [['first_name', 'Prénom', 100], ['last_name', 'Nom', 100], ['phone', 'Téléphone', 40], ['current_level', 'Niveau actuel', 40], ['preparing_level', 'Niveau préparé', 40]] as const
  return <section className="card profile-card"><PageHeading eyebrow="Votre espace" title="Mon profil"><p>Vos informations utiles aux séances du club.</p></PageHeading><p>Email de connexion : {member.email}</p><p>Pour corriger votre adresse de connexion, contactez un administrateur.</p>
    <p>CACI : <strong className={`chip caci-${caciStatus(member.caci_expiry_date)}`}>{caciLabels[caciStatus(member.caci_expiry_date)]}</strong>{member.caci_expiry_date && ` · valable jusqu’au ${member.caci_expiry_date}`}</p>
    <form onChangeCapture={()=>setMessage('')} onSubmit={event => void save(event)}><div className="form-grid">{textFields.map(([key, label, max]) => <label key={key}>{label}<input type={key === 'phone' ? 'tel' : 'text'} maxLength={max} required={key === 'first_name' || key === 'last_name'} value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })} /></label>)}</div>
      <fieldset className="usual-car"><legend>Ma voiture habituelle</legend><p id="usual-car-help">Ces valeurs préremplissent vos futures propositions pour une séance. Elles ne créent aucune offre automatiquement. L’heure de départ et la note se renseignent pour chaque séance.</p>
      <label className="check"><input type="checkbox" aria-describedby="usual-car-help" checked={values.has_usual_car} onChange={event => { carDefaultsDirty.current = true; setValues({ ...values, has_usual_car: event.target.checked }) }} />J’ai habituellement une voiture disponible</label>
      {values.has_usual_car && <div className="form-grid"><label>Places passagers habituelles<input type="number" min={1} max={8} required value={values.usual_passenger_seats} onChange={event => { carDefaultsDirty.current = true; setValues({ ...values, usual_passenger_seats: Number(event.target.value) }) }} /></label><label>Point de rendez-vous habituel<input maxLength={200} value={values.usual_meeting_point} onChange={event => { carDefaultsDirty.current = true; setValues({ ...values, usual_meeting_point: event.target.value }) }} /></label></div>}
      </fieldset><button disabled={busy}>Enregistrer mon profil</button>{message && <p role="status">{message}</p>}
    </form>
    {member.role !== 'member' && <div className="mt"><h3>Mettre à jour mon CACI</h3><CaciEditor client={client} member={member} onRefresh={refresh} /></div>}
  </section>
}
