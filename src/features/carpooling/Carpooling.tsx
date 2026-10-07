import { useCallback, useEffect, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import type { Session } from '../sessions/SessionEditor'
import { useSharedRefresh } from '../../lib/useSharedRefresh'
type Car = Database['public']['Functions']['get_car_offers']['Returns'][number]
type Transport = Database['public']['Functions']['get_session_transport']['Returns'][number]

function OfferForm({ member, car, disabled, save }: { member: Member; car?: Car; disabled: boolean; save: (seats: number, meeting: string, time: string, note: string) => Promise<void> }) {
  const [seats, setSeats] = useState(car?.passenger_capacity ?? (member.has_usual_car ? member.usual_passenger_seats : 3))
  const [meeting, setMeeting] = useState(car?.meeting_point ?? (member.has_usual_car ? member.usual_meeting_point : ''))
  const [time, setTime] = useState(car?.departure_time?.slice(0, 5) ?? '')
  const [note, setNote] = useState(car?.note ?? '')
  async function submit(event: SubmitEvent<HTMLFormElement>) { event.preventDefault(); await save(seats, meeting, time, note) }
  return <form onSubmit={event => void submit(event)}><h4>{car ? 'Modifier ma voiture' : 'Proposer ma voiture'}</h4><p>Les places proposées excluent le conducteur. Les habitudes du profil sont un préremplissage ; aucune voiture n’est créée automatiquement.</p><div className="form-grid"><label>Places passagers proposées<input type="number" required min={1} max={8} step={1} value={seats} onChange={event => setSeats(Number(event.target.value))} /></label><label>Point de rendez-vous<input maxLength={200} value={meeting} onChange={event => setMeeting(event.target.value)} /></label><label>Heure de départ<input type="time" value={time} onChange={event => setTime(event.target.value)} /></label></div><label>Note pour les passagers<textarea maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></label><button disabled={disabled}>Enregistrer ma voiture</button></form>
}
export function Carpooling({ client, member, session, onProfileSaved, onChanged }: { client: SupabaseClient<Database>; member: Member; session: Session; onProfileSaved?: () => Promise<void>; onChanged?: () => Promise<void> }) {
  const [loaded, setLoaded] = useState(false)
  const [cars, setCars] = useState<Car[]>([])
  const [people, setPeople] = useState<Transport[]>([])
  const [eligible, setEligible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingMode, setPendingMode] = useState<'needs' | 'own' | 'unset' | null>(null)
  const [confirmedDrivers, setConfirmedDrivers] = useState<string[]>([])
  const [showOffer, setShowOffer] = useState(false)
  const tripSummary = useRef<HTMLElement | null>(null)
  const restoreTripFocus = useRef(false)
  const offerToggle = useRef<HTMLButtonElement | null>(null)
  const restoreOfferFocus = useRef(false)
  function closeEditor() { restoreOfferFocus.current = true; setShowOffer(false) }
  useEffect(() => {
    // Focus only after React committed the collapsed form and enabled controls.
    if (restoreOfferFocus.current && !showOffer && !busy) { offerToggle.current?.focus(); restoreOfferFocus.current = false }
  }, [showOffer, busy])
  const [pendingDefaults, setPendingDefaults] = useState<{ seats: number; meeting: string } | null>(null)
  const [savedDefaults, setSavedDefaults] = useState(false)
  useEffect(() => { setSavedDefaults(member.has_usual_car) }, [member.has_usual_car])
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++sequence.current
    const [offers, transport, selection] = await Promise.all([
      client.rpc('get_car_offers', { p_session_id: session.id }),
      client.rpc('get_session_transport', { p_session_id: session.id }),
      client.rpc('get_current_selection', { p_session_id: session.id }),
    ])
    if (request !== sequence.current) return
    if (offers.error || transport.error || selection.error) { setMessage('Covoiturage indisponible. Actualisez la séance.'); return }
    setLoaded(true)
    setCars(offers.data ?? []); setPeople(transport.data ?? [])
    setConfirmedDrivers((selection.data ?? []).filter(person => person.state === 'selected').map(person => person.member_id))
    const own = selection.data?.find(person => person.member_id === member.id)
    setEligible(own?.rsvp === 'yes' && own.state !== 'declined' && session.status === 'open')
  }, [client, member.id, session.id, session.status])
  useSharedRefresh(load)
  const ownCar = cars.find(car => car.driver_member_id === member.id)
  const previousCar = useRef<string | undefined>(undefined)
  useEffect(() => { if (previousCar.current !== ownCar?.id) setShowOffer(false); previousCar.current = ownCar?.id }, [ownCar?.id])
  const own = people.find(person => person.member_id === member.id)
  useEffect(() => {
    if (restoreTripFocus.current && !busy && own?.mode === 'passenger') { tripSummary.current?.focus(); restoreTripFocus.current = false }
  }, [busy, own?.mode, own?.car_offer_id])
  async function save(seats: number, meeting: string, time: string, note: string) {
    setBusy(true); setMessage('')
    const result = await client.rpc('offer_car', { p_session_id: session.id, p_passenger_capacity: seats, p_meeting_point: meeting, p_departure_time: time || undefined, p_note: note })
    if (result.error) setMessage('Offre refusée. Vérifiez les places déjà occupées, les champs et votre participation.')
    else {
      setMessage('Voiture enregistrée pour cette séance.')
      if (!ownCar && !member.has_usual_car && !savedDefaults) setPendingDefaults({ seats, meeting })
      await load(); await onChanged?.(); closeEditor()
    }
    setBusy(false)
  }
  async function rememberDefaults() {
    if (!pendingDefaults) return
    setBusy(true); setMessage('')
    const result = await client.rpc('save_own_car_defaults', { p_passenger_seats: pendingDefaults.seats, p_meeting_point: pendingDefaults.meeting })
    if (result.error) setMessage('La voiture reste enregistrée. Les habitudes du profil n’ont pas été enregistrées; réessayez ou gardez une offre ponctuelle.')
    else { setSavedDefaults(true); setPendingDefaults(null); setMessage('Habitudes de covoiturage enregistrées.'); await onProfileSaved?.() }
    setBusy(false)
  }
  async function mode(value: 'needs' | 'own' | 'unset', confirmed = false) {
    if (ownCar?.occupied && !confirmed) { setPendingMode(value); return }
    setBusy(true); setMessage('')
    const result = await client.rpc('set_own_transport', { p_session_id: session.id, p_mode: value })
    if (result.error) setMessage('Changement de trajet refusé. Actualisez votre participation.')
    else { setPendingMode(null); setShowOffer(false); setMessage('Trajet enregistré.'); await load(); await onChanged?.() }
    setBusy(false)
  }
  async function join(id: string) {
    setBusy(true); setMessage('')
    const result = await client.rpc('join_car', { p_session_id: session.id, p_car_offer_id: id })
    if (result.error) setMessage('Cette place n’est plus disponible. Votre trajet précédent est conservé. Actualisez et choisissez une autre voiture.')
    else { restoreTripFocus.current = true; setMessage('Place passager enregistrée.'); await load(); await onChanged?.() }
    setBusy(false)
  }
  const bookedCar = cars.find(car => car.id === own?.car_offer_id)
  const provisional = bookedCar && !confirmedDrivers.includes(bookedCar.driver_member_id)
  return <div className="mt carpool"><h3>Covoiturage</h3>
    {!loaded && <p>Chargement des trajets…</p>}
    {ownCar && <section className="card own-car-summary" aria-label="Ma voiture">
      <h4>Ma voiture</h4><p className={`chip ${confirmedDrivers.includes(member.id) ? 'green' : 'amber'}`}>{confirmedDrivers.includes(member.id) ? 'Conducteur confirmé dans la sélection publiée.' : 'Conducteur en attente de confirmation · Trajet provisoire.'}</p>
      <p>{ownCar.passenger_capacity - ownCar.occupied} {ownCar.passenger_capacity - ownCar.occupied === 1 ? 'place libre' : 'places libres'} / {ownCar.passenger_capacity} {ownCar.passenger_capacity === 1 ? 'place passager' : 'places passagers'}.</p>
      <p>{ownCar.meeting_point || 'Rendez-vous à préciser'} · {ownCar.departure_time ? `départ ${ownCar.departure_time.slice(0, 5)}` : 'Heure de départ à préciser'}</p>
      {ownCar.note && <p className="preserve-lines">{ownCar.note}</p>}
      <p>{ownCar.occupied} passager{ownCar.occupied === 1 ? '' : 's'} à bord.</p>
      {ownCar.occupied > 0 && <ul>{people.filter(person => person.mode === 'passenger' && person.car_offer_id === ownCar.id).map(person => <li key={person.member_id}>{person.first_name} {person.last_name}</li>)}</ul>}
      <div className="actions"><button ref={offerToggle} disabled={!eligible || busy} aria-expanded={showOffer} aria-controls="car-offer-editor" onClick={() => setShowOffer(true)}>Modifier ma voiture</button><button className="danger" disabled={!eligible || busy} onClick={() => void mode('needs')}>Retirer ma voiture</button></div>
    </section>}
    {loaded && own?.mode === 'passenger' && bookedCar && <section ref={tripSummary} tabIndex={-1} className="card booked-trip" aria-label="Mon trajet réservé">
      <h4>Mon trajet réservé</h4><p>Avec <strong>{bookedCar.first_name} {bookedCar.last_name}</strong> · conducteur</p>
      <p className={`chip ${provisional ? 'amber' : 'green'}`}>{provisional ? 'Conducteur en attente de confirmation · Trajet provisoire.' : 'Conducteur confirmé dans la sélection publiée.'}</p>
      <p>{bookedCar.meeting_point || 'Rendez-vous à préciser'} · {bookedCar.departure_time ? `départ ${bookedCar.departure_time.slice(0, 5)}` : 'Heure de départ à préciser'}</p>
      {bookedCar.note && <p className="preserve-lines">{bookedCar.note}</p>}
      <p>{bookedCar.occupied} passager{bookedCar.occupied === 1 ? '' : 's'} à bord · {bookedCar.passenger_capacity - bookedCar.occupied} {bookedCar.passenger_capacity - bookedCar.occupied === 1 ? 'place libre' : 'places libres'}.</p>
      <ul>{people.filter(person => person.mode === 'passenger' && person.car_offer_id === bookedCar.id).map(person => <li key={person.member_id}>{person.first_name} {person.last_name}{person.member_id === member.id && ' · vous'}</li>)}</ul>
    </section>}
    {loaded && own?.mode === 'passenger' && !bookedCar && <p role="alert">Votre voiture réservée n’est plus disponible. Actualisez puis choisissez un autre trajet.</p>}
    {loaded && !ownCar && own?.mode !== 'passenger' && <p>{own?.mode === 'own' ? 'Vous venez par vos propres moyens.' : 'Aucun trajet réservé. Consultez les voitures ci-dessous ou proposez une voiture si vous avez répondu Oui.'}</p>}
    {provisional && <p role="status">Trajet provisoire : le conducteur n’est pas confirmé dans la sélection publiée.</p>}
    {loaded && !eligible && <p>Répondez Oui pour organiser votre trajet. Une exclusion publiée ou un bilan clôturé empêche les changements.</p>}
    <div className="actions">{!ownCar && <button disabled={!eligible || busy} onClick={() => void mode('needs')}>{own?.mode === 'passenger' ? 'Quitter cette voiture' : 'Je cherche un trajet'}</button>}<button disabled={!eligible || busy} onClick={() => void mode('own')}>Je viens par mes propres moyens</button><button disabled={!eligible || busy} onClick={() => void mode('unset')}>Préciser mon trajet plus tard</button></div>
    {pendingMode && <div className="mt"><p>{ownCar?.occupied === 1 ? 'Votre passager reste inscrit à la fosse, mais devra retrouver un trajet.' : `Vos ${ownCar?.occupied ?? 0} passagers restent inscrits à la fosse, mais devront retrouver un trajet.`} Confirmer le retrait de votre voiture ?</p><div className="actions"><button className="danger" disabled={busy} onClick={() => void mode(pendingMode, true)}>Confirmer le retrait de ma voiture</button><button onClick={() => setPendingMode(null)}>Conserver ma voiture</button></div></div>}
    {eligible && !ownCar && !showOffer && <button ref={offerToggle} className="primary" disabled={busy} onClick={() => setShowOffer(true)}>Proposer une voiture</button>}
    {eligible && showOffer && <div id="car-offer-editor"><OfferForm key={ownCar?.id ?? 'new'} member={member} car={ownCar} disabled={busy} save={save} /><button disabled={busy} onClick={closeEditor}>{ownCar ? 'Annuler la modification' : 'Annuler la proposition'}</button></div>}
    {pendingDefaults && <div className="mt car-default-prompt"><p>Mémoriser ces habitudes dans mon profil ? Elles prérempliront mes prochaines propositions sans créer de voiture automatiquement. Pour une voiture empruntée ou une offre exceptionnelle, gardez une offre ponctuelle.</p><div className="actions"><button className="primary" disabled={busy} onClick={() => void rememberDefaults()}>Mémoriser pour les prochaines séances</button><button disabled={busy} onClick={() => setPendingDefaults(null)}>Garder une offre ponctuelle</button></div></div>}
    <h4>Autres voitures proposées</h4>{loaded && !cars.some(car => car.driver_member_id !== member.id && car.id !== bookedCar?.id) && <p>{ownCar ? 'Aucune autre voiture proposée pour cette séance.' : 'Aucune voiture proposée pour cette séance.'}</p>}
    <div className="car-grid">{cars.filter(car => car.driver_member_id !== member.id && car.id !== bookedCar?.id).map(car => <article className="card car-card" key={car.id}><h4>{car.first_name} {car.last_name}</h4><p className={`chip ${confirmedDrivers.includes(car.driver_member_id) ? 'green' : 'amber'}`}>{confirmedDrivers.includes(car.driver_member_id) ? 'Conducteur confirmé dans la sélection publiée.' : 'Conducteur en attente de confirmation · Trajet provisoire.'}</p><p>{car.passenger_capacity - car.occupied} {car.passenger_capacity - car.occupied === 1 ? 'place libre' : 'places libres'} / {car.passenger_capacity} {car.passenger_capacity === 1 ? 'place passager' : 'places passagers'}.</p><p>{car.meeting_point || 'Rendez-vous à préciser'} · {car.departure_time ? `départ ${car.departure_time.slice(0, 5)}` : 'Heure de départ à préciser'}</p><p>{car.note}</p><ul>{people.filter(person => person.mode === 'passenger' && person.car_offer_id === car.id).map(person => <li key={person.member_id}>{person.first_name} {person.last_name}</li>)}</ul>{car.driver_member_id !== member.id && <button disabled={!eligible || busy || !!ownCar || (car.occupied >= car.passenger_capacity && own?.car_offer_id !== car.id)} onClick={() => void join(car.id)} aria-label={`Rejoindre la voiture de ${car.first_name} ${car.last_name}`}>{own?.car_offer_id === car.id ? 'Ma voiture actuelle' : 'Prendre une place'}</button>}</article>)}</div>
    {message && <p role="status">{message}</p>}
  </div>
}
