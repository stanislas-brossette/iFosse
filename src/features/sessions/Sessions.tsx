import { useCallback, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { caciLabels, caciStatus, formatDate, seasonBounds, seasonOf, todayParis } from '../../lib/dates'
import { SessionEditor } from './SessionEditor'
import type { Session } from './SessionEditor'
import { Selection } from '../selection/Selection'
import { Carpooling } from '../carpooling/Carpooling'
import { useSharedRefresh } from '../../lib/useSharedRefresh'
import { Palanquees } from '../palanquees/Palanquees'
import { Attendance } from '../attendance/Attendance'
import { attendanceLabels, paymentLabels } from '../../lib/labels'
export type Response = Database['public']['Functions']['get_session_responses']['Returns'][number]
export const rsvpLabels = { unanswered: 'Sans réponse', yes: 'Oui', maybe: 'Peut-être', no: 'Non' } as const
export function SessionDetail({ client, member, session, onEdit, onBack, onChanged }: { client: SupabaseClient<Database>; member: Member; session: Session; onEdit: () => void; onBack: () => void; onChanged: () => Promise<void> }) {
  const [responses, setResponses] = useState<Response[]>([])
  const [own, setOwn] = useState<Tables<'session_participations'> | null>(null)
  const [directory, setDirectory] = useState<Pick<Member, 'id' | 'first_name' | 'last_name'>[]>([])
  const [tab, setTab] = useState<'overview' | 'participants' | 'transport' | 'manage' | 'bilan' | 'groups'>('overview')
  const [warning, setWarning] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const admin = member.role !== 'member'
  const loadSequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++loadSequence.current
    const [publicResult, ownResult] = await Promise.all([
      client.rpc('get_session_responses', { p_session_id: session.id }),
      client.from('session_participations').select('*').eq('session_id', session.id).eq('member_id', member.id).maybeSingle(),
    ])
    if (request !== loadSequence.current) return
    if (publicResult.error || ownResult.error) { setMessage('Actualisation impossible. Réessayez.'); return }
    setResponses(publicResult.data ?? []); setOwn(ownResult.data)
    if (admin) {
      const result = await client.from('members').select('id, first_name, last_name').order('last_name')
      if (request === loadSequence.current && !result.error) setDirectory(result.data ?? [])
    }
  }, [client, member.id, admin, session.id])
  useSharedRefresh(load)
  const caci = caciStatus(member.caci_expiry_date, session.date)
  async function respond(rsvp: 'yes' | 'maybe' | 'no', confirmed = false, target = member.id) {
    if (target === member.id && !admin && rsvp === 'yes' && !confirmed && (caci === 'missing' || caci === 'expired')) { setWarning(true); return }
    setBusy(true); setMessage('')
    const { error } = await client.rpc('set_session_rsvp', { p_session_id: session.id, p_member_id: target, p_rsvp: rsvp, p_confirm_caci_warning: confirmed })
    if (error?.message === 'CACI_WARNING') setWarning(true)
    else if (error) setMessage('Réponse refusée. Actualisez la séance et vérifiez si les inscriptions sont ouvertes.')
    else { setWarning(false); setMessage('Réponse enregistrée.'); await load() }
    setBusy(false)
  }
  const participants = responses.filter(response => response.rsvp === 'yes' || response.rsvp === 'maybe')
  return <section className="card"><div className="toolbar"><button onClick={onBack}>Toutes les séances</button>{admin && <button onClick={onEdit}>Modifier la séance</button>}</div>
    <h2>{session.title} · {formatDate(session.date)}</h2><p>{session.start_time.slice(0, 5)} — {session.end_time.slice(0, 5)} · {session.venue || 'Lieu à préciser'}</p>
    {session.school_holiday && <p className="badge">Vacances scolaires</p>}{session.end_time_estimated && <p>Heure de fin à confirmer.</p>}
    <p>{session.address}</p><p className="preserve-lines">{session.notes}</p><p>{session.status === 'closed' ? 'Bilan clôturé' : session.registration_open ? 'Inscriptions ouvertes' : 'Inscriptions fermées · un désistement reste possible.'}</p>
    <nav className="actions" aria-label="Rubriques de la séance">{([['overview', 'Ma participation'], ['participants', 'Participants'], ['transport', 'Covoiturage'], ['bilan', 'Bilan'], ['groups', 'Palanquées'], ...(admin ? [['manage', 'Gestion']] : [])] as [typeof tab, string][]).map(([key, label]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {tab === 'overview' && <div className="mt"><h3>Ma réponse : {rsvpLabels[own?.rsvp ?? 'unanswered']}</h3><p>{session.capacity} places pour la sélection finale. Dire Oui ne garantit pas une place.</p>
      <div className="actions" role="group" aria-label="Ma réponse pour la séance">{(['yes', 'maybe', 'no'] as const).map(value => <button key={value} aria-pressed={own?.rsvp === value} disabled={busy || session.status === 'closed' || (!session.registration_open && !admin && value !== 'no')} onClick={() => { setWarning(false); void respond(value) }}>{rsvpLabels[value]}</button>)}</div>
      {session.status === 'closed' && <p>Ma présence : <strong>{attendanceLabels[own?.attendance_status ?? 'unknown']}</strong></p>}
      <p>Mon paiement : <strong>{paymentLabels[own?.payment_status ?? 'unpaid']}</strong></p>
      <p>Mon CACI au jour de la fosse : {caciLabels[caci]}.</p>
      {warning && <div role="alert" className="mt"><p>Votre CACI sera expiré ou n’est pas renseigné pour cette fosse. Vous pourrez le renouveler avant la séance. Confirmer votre réponse Oui ?</p><div className="actions"><button disabled={busy} onClick={() => void respond('yes', true)}>Confirmer Oui malgré l’avertissement</button><button onClick={() => setWarning(false)}>Annuler la réponse</button></div></div>}
    </div>}
    {tab === 'participants' && <div className="mt"><h3>Participants · Oui et Peut-être</h3>{!participants.length && <p>Aucune réponse Oui ou Peut-être.</p>}<ul className="member-list">{participants.map(response => <li key={response.member_id}><span>{response.first_name} {response.last_name} · {response.current_level}{response.preparing_level && ` · prépare ${response.preparing_level}`}</span><strong>{rsvpLabels[response.rsvp]}</strong></li>)}</ul></div>}
    {tab === 'manage' && admin && <div className="mt"><h3>Corriger une réponse</h3><ul className="member-list">{directory.map(person => <li key={person.id}><span>{person.first_name} {person.last_name}</span><label>Réponse de {person.first_name} {person.last_name}<select disabled={busy || session.status === 'closed'} value={responses.find(response => response.member_id === person.id)?.rsvp ?? 'unanswered'} onChange={event => void respond(event.target.value as 'yes' | 'maybe' | 'no', false, person.id)}><option value="unanswered" disabled>Sans réponse</option>{(['yes', 'maybe', 'no'] as const).map(value => <option key={value} value={value}>{rsvpLabels[value]}</option>)}</select></label></li>)}</ul></div>}
    {tab === 'transport' && <Carpooling client={client} member={member} session={session} />}
    {tab === 'groups' && <Palanquees client={client} member={member} session={session} />}
    {tab === 'bilan' && <Attendance client={client} member={member} session={session} onChanged={onChanged} />}
    <Selection client={client} member={member} session={session} manage={tab === 'manage'} />
    {message && <p role="status">{message}</p>}
  </section>
}
export function Sessions({ client, member }: { client: SupabaseClient<Database>; member: Member }) {
  const [season, setSeason] = useState(seasonOf(todayParis()))
  const [counts, setCounts] = useState<Database['public']['Functions']['get_season_counts']['Returns']>([])
  const [history, setHistory] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const loadSequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++loadSequence.current
    const bounds = seasonBounds(season)
    const [calendar, totals] = await Promise.all([
      client.from('sessions').select('*').gte('date', bounds.start).lt('date', bounds.end).order('date').order('start_time'),
      client.rpc('get_season_counts', { p_start_year: season }),
    ])
    const { data, error } = calendar
    if (request !== loadSequence.current) return
    if (totals.error) setCounts([])
    else setCounts(totals.data ?? [])
    if (error || totals.error) setMessage('Calendrier indisponible. Réessayez.')
    else { setSessions(data ?? []); setMessage('') }
  }, [client, season])
  useSharedRefresh(load)
  const session = sessions.find(item => item.id === selected)
  async function saved(id: string | null) {
    if (id) {
      const result = await client.from('sessions').select('date').eq('id', id).single()
      if (result.data) setSeason(seasonOf(result.data.date))
    }
    await load(); setSelected(id); setEditing(false)
  }
  return <><section className="card"><div className="toolbar"><h2>Les séances</h2>{member.role !== 'member' && <button onClick={() => { setSelected(null); setEditing(true) }}>Nouvelle séance</button>}</div><p>Mes fosses réalisées cette saison : <strong>{counts.find(row => row.member_id === member.id)?.completed_count ?? 0}</strong>. Seuls les bilans clôturés comptent.</p><label>Saison<select value={season} onChange={event => { setSeason(Number(event.target.value)); setSelected(null); setEditing(false) }}>{Array.from(new Set([season, seasonOf(todayParis()) - 1, seasonOf(todayParis()), ...sessions.map(item => seasonOf(item.date))])).sort((a, b) => b - a).map(year => <option key={year} value={year}>{year}–{year + 1}</option>)}</select></label><div className="actions"><button onClick={() => { setSeason(season - 1); setSelected(null); setEditing(false) }}>Saison précédente</button><button onClick={() => { setSeason(season + 1); setSelected(null); setEditing(false) }}>Saison suivante</button></div><div className="actions mt"><button aria-pressed={!history} onClick={() => { setHistory(false); setSelected(null); setEditing(false) }}>Toutes les séances</button><button aria-pressed={history} onClick={() => { setHistory(true); setSelected(null); setEditing(false) }}>Historique des bilans clôturés</button></div>{message && <p role="alert">{message}</p>}</section>
    {editing && selected && !session ? <section className="card"><p>Cette séance n’est plus disponible dans le calendrier.</p><button onClick={() => { setSelected(null); setEditing(false) }}>Retour au calendrier</button></section> : editing ? <SessionEditor key={selected ?? 'new'} client={client} session={session} onSaved={saved} onCancel={() => setEditing(false)} /> : session ? <SessionDetail key={session.id} client={client} member={member} session={session} onEdit={() => setEditing(true)} onBack={() => setSelected(null)} onChanged={load} /> : <div className="session-grid">{sessions.filter(item => !history || item.status === 'closed').map(item => <article className="card" key={item.id}><h3>{formatDate(item.date)}</h3><p>{item.title} · {item.start_time.slice(0, 5)} — {item.end_time.slice(0, 5)}</p><p>{item.venue || 'Lieu à préciser'} · {item.capacity} places</p>{item.school_holiday && <p className="badge">Vacances scolaires</p>}<p>{item.status === 'closed' ? 'Bilan clôturé' : item.registration_open ? 'Inscriptions ouvertes' : 'Inscriptions fermées'}</p><button onClick={() => setSelected(item.id)} aria-label={`Voir la séance du ${formatDate(item.date)}`}>Voir la séance</button></article>)}{!sessions.some(item => !history || item.status === 'closed') && <p>{history ? 'Aucun bilan clôturé dans cette saison.' : 'Aucune séance dans cette saison.'}</p>}</div>}
  </>
}
