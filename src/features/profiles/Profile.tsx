import { useState } from 'react'
import type { SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { caciLabels, caciStatus } from '../../lib/dates'

export function CaciEditor({ client, member, onSaved }: { client: SupabaseClient<Database>; member: Member; onSaved: () => Promise<void> }) {
  const [date, setDate] = useState(member.caci_expiry_date ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await client.rpc('set_member_caci', { p_member_id: member.id, p_expiry_date: date || undefined })
    if (error) setMessage('Modification du CACI refusée. Vérifiez vos droits et la date.')
    else { setMessage('Date CACI enregistrée.'); await onSaved() }
    setBusy(false)
  }
  return <form onSubmit={event => void save(event)}><label>Fin de validité CACI<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><button disabled={busy}>Enregistrer le CACI</button>{message && <p role="status">{message}</p>}</form>
}

export function Profile({ client, member, refresh }: { client: SupabaseClient<Database>; member: Member; refresh: () => Promise<void> }) {
  const [values, setValues] = useState({ first_name: member.first_name, last_name: member.last_name, phone: member.phone ?? '', current_level: member.current_level, preparing_level: member.preparing_level ?? '', has_usual_car: member.has_usual_car, usual_passenger_seats: member.usual_passenger_seats || 3, usual_meeting_point: member.usual_meeting_point })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await client.rpc('update_own_profile', { p_first_name: values.first_name, p_last_name: values.last_name, p_phone: values.phone, p_current_level: values.current_level, p_preparing_level: values.preparing_level, p_has_usual_car: values.has_usual_car, p_usual_passenger_seats: values.usual_passenger_seats, p_usual_meeting_point: values.usual_meeting_point })
    if (error) setMessage('Enregistrement refusé. Vérifiez les champs et réessayez.')
    else { setMessage('Profil enregistré.'); await refresh() }
    setBusy(false)
  }
  const textFields = [['first_name', 'Prénom', 100], ['last_name', 'Nom', 100], ['phone', 'Téléphone', 40], ['current_level', 'Niveau actuel', 40], ['preparing_level', 'Niveau préparé', 40]] as const
  return <section className="card"><h2>Mon profil</h2><p>Email de connexion : {member.email}</p><p>Pour corriger votre adresse de connexion, contactez un administrateur.</p>
    <p>CACI : <strong>{caciLabels[caciStatus(member.caci_expiry_date)]}</strong>{member.caci_expiry_date && ` · valable jusqu’au ${member.caci_expiry_date}`}</p>
    <form onSubmit={event => void save(event)}><div className="form-grid">{textFields.map(([key, label, max]) => <label key={key}>{label}<input type={key === 'phone' ? 'tel' : 'text'} maxLength={max} required={key === 'first_name' || key === 'last_name'} value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })} /></label>)}</div>
      <label className="check"><input type="checkbox" checked={values.has_usual_car} onChange={event => setValues({ ...values, has_usual_car: event.target.checked })} />Mémoriser mes habitudes de covoiturage</label>
      <p>Ces valeurs prérempliront une proposition de voiture. Elles ne créent aucune offre automatiquement.</p>
      {values.has_usual_car && <div className="form-grid"><label>Places passagers habituelles<input type="number" min={1} max={8} required value={values.usual_passenger_seats} onChange={event => setValues({ ...values, usual_passenger_seats: Number(event.target.value) })} /></label><label>Point de rendez-vous habituel<input maxLength={200} value={values.usual_meeting_point} onChange={event => setValues({ ...values, usual_meeting_point: event.target.value })} /></label></div>}
      <button disabled={busy}>Enregistrer mon profil</button>{message && <p role="status">{message}</p>}
    </form>
    {member.role !== 'member' && <div className="mt"><h3>Mettre à jour mon CACI</h3><CaciEditor client={client} member={member} onSaved={refresh} /></div>}
  </section>
}
