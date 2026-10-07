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
import { DateTile, Icon, PageHeading } from '../../components/Visual'
import type { SessionTab } from '../../components/SessionTabs'
import { PersonalStatus } from './PersonalStatus'
import { calendarAction, calendarSessions, nextSession, validSummary } from './calendar'
import type { CalendarFilter } from './calendar'
import { SessionTabs } from '../../components/SessionTabs'
import { PublishedOccupancy } from './PublishedOccupancy'
import type { CardSummary } from './PublishedOccupancy'
import { attendanceLabels, paymentLabels, rsvpLabels } from '../../lib/labels'
export type Response = Database['public']['Functions']['get_session_responses']['Returns'][number]
export { rsvpLabels } from '../../lib/labels'
export function SessionDetail({ client, member, session, onEdit, onBack, onChanged, refreshMember, initialTab = 'overview' }: { client: SupabaseClient<Database>; member: Member; session: Session; onEdit: () => void; onBack: () => void; onChanged: () => Promise<void>; refreshMember?: () => Promise<void>; initialTab?: SessionTab }) {
  const [responses, setResponses] = useState<Response[]>([])
  const [own, setOwn] = useState<Tables<'session_participations'> | null>(null)
  const [directory, setDirectory] = useState<Pick<Member, 'id' | 'first_name' | 'last_name'>[]>([])
  const [tab, setTab] = useState<SessionTab>(initialTab)
  const [warning, setWarning] = useState(false)
  const [pendingResponse, setPendingResponse] = useState<{ rsvp: 'maybe' | 'no'; target: string; name: string; selected: boolean; passengers: number } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const admin = member.role !== 'member'
  const loadSequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++loadSequence.current
    const [publicResult, ownResult] = await Promise.all([
      client.rpc(admin ? 'get_admin_session_responses' : 'get_session_responses', { p_session_id: session.id }),
      client.from('session_participations').select('*').eq('session_id', session.id).eq('member_id', member.id).maybeSingle(),
    ])
    if (request !== loadSequence.current) return
    if (publicResult.error || ownResult.error) { setMessage('Actualisation impossible. Réessayez.'); return }
    setResponses(publicResult.data ?? []); setOwn(ownResult.data)
    if (admin) {
      const result = await client.from('members').select('id, first_name, last_name').is('disabled_at', null).order('last_name')
      if (request === loadSequence.current && !result.error) setDirectory(result.data ?? [])
    }
  }, [client, member.id, admin, session.id])
  useSharedRefresh(load)
  const caci = caciStatus(member.caci_expiry_date, session.date)
  async function respond(rsvp: 'yes' | 'maybe' | 'no', confirmed = false, target = member.id, withdrawalConfirmed = false) {
    if (target === member.id && !admin && rsvp === 'yes' && !confirmed && (caci === 'missing' || caci === 'expired')) { setWarning(true); return }
    setBusy(true); setMessage('')
    const person = target === member.id ? member : directory.find(row => row.id === target)
    const name = person ? `${person.first_name} ${person.last_name}` : 'l’adhérent concerné'
    async function consequences() {
      const result = await client.rpc('get_rsvp_change_consequences', { p_session_id: session.id, p_member_id: target })
      const impact = result.data?.[0]
      if (result.error || !impact) { setMessage('Vérification de la réponse impossible. Réessayez.'); return null }
      return impact
    }
    if (rsvp !== 'yes' && !withdrawalConfirmed) {
      const impact = await consequences()
      if (!impact) { setBusy(false); return }
      if (impact.selected || impact.passengers > 0) { setPendingResponse({ rsvp, target, name, selected: impact.selected, passengers: impact.passengers }); setBusy(false); return }
    }
    const { error } = await client.rpc('set_session_rsvp', { p_session_id: session.id, p_member_id: target, p_rsvp: rsvp, p_confirm_caci_warning: confirmed, p_confirm_withdrawal: withdrawalConfirmed })
    if (error?.message === 'CACI_WARNING') setWarning(true)
    else if (error?.message === 'RSVP_WITHDRAWAL_WARNING' && rsvp !== 'yes') {
      const impact = await consequences()
      if (impact) setPendingResponse({ rsvp, target, name, selected: impact.selected, passengers: impact.passengers })
    }
    else if (error) setMessage('Réponse refusée. Actualisez la séance et vérifiez si les inscriptions sont ouvertes.')
    else { setPendingResponse(null); setWarning(false); setMessage('Réponse enregistrée.'); await load() }
    setBusy(false)
  }
  return <section className="card session-detail"><div className="toolbar"><button className="secondary" onClick={onBack}>Toutes les séances</button>{admin && <button onClick={onEdit}>Modifier la séance</button>}</div>
    <p className="eyebrow">La séance du club</p><h1>{session.title} · {formatDate(session.date)}</h1><p>{session.start_time.slice(0, 5)} — {session.end_time.slice(0, 5)} · {session.venue || 'Lieu à préciser'}</p>
    {session.school_holiday && <p className="badge">Vacances scolaires</p>}<details className="session-information" open={tab === 'overview'}><summary>Informations et accès</summary>{session.end_time_estimated && <p>Heure de fin à confirmer.</p>}
    <p>{session.address}</p><p className="preserve-lines">{session.notes}</p></details><p className="session-registration">{session.status === 'closed' ? 'Bilan clôturé' : session.registration_open ? 'Inscriptions ouvertes' : 'Inscriptions fermées · un désistement reste possible.'}</p>
    <SessionTabs value={tab} admin={admin} onChange={setTab} />
    <div role="tabpanel" id="session-panel" aria-labelledby={`session-tab-${tab}`} className="tab-panel">
    {tab === 'overview' && <div className="mt"><h3>Ma réponse : {rsvpLabels[own?.rsvp ?? 'unanswered']}</h3><p>{session.capacity} places pour la sélection finale. Dire Oui ne garantit pas une place.</p>
      <div className="actions" role="group" aria-label="Ma réponse pour la séance">{(['yes', 'maybe', 'no'] as const).map(value => <button className={`rsvp-${value}`} key={value} aria-pressed={own?.rsvp === value} disabled={busy || session.status === 'closed' || (!session.registration_open && !admin && value !== 'no')} onClick={() => { setWarning(false); void respond(value) }}>{rsvpLabels[value]}</button>)}</div>
      {session.status === 'closed' && <p>Ma présence : <strong>{attendanceLabels[own?.attendance_status ?? 'unknown']}</strong></p>}
      <p>Mon paiement : <strong>{paymentLabels[own?.payment_status ?? 'unpaid']}</strong></p>
      <p>Mon CACI au jour de la fosse : {caciLabels[caci]}.</p>
      {warning && <div role="alert" className="mt"><p>Votre CACI sera expiré ou n’est pas renseigné pour cette fosse. Vous pourrez le renouveler avant la séance. Confirmer votre réponse Oui ?</p><div className="actions"><button disabled={busy} onClick={() => void respond('yes', true)}>Confirmer Oui malgré l’avertissement</button><button onClick={() => setWarning(false)}>Annuler la réponse</button></div></div>}
    </div>}
    {pendingResponse && <div role="alert" className="mt"><p>Changer la réponse de {pendingResponse.name} en {rsvpLabels[pendingResponse.rsvp]} ?</p>{pendingResponse.selected && <p>La place confirmée sera libérée. Un nouveau Oui nécessitera une nouvelle sélection publiée.</p>}{pendingResponse.passengers > 0 && <p>La voiture sera retirée. Ses passagers restent inscrits, mais devront retrouver un trajet.</p>}<div className="actions"><button disabled={busy} onClick={() => void respond(pendingResponse.rsvp, false, pendingResponse.target, true)}>Confirmer le changement de réponse</button><button disabled={busy} onClick={() => setPendingResponse(null)}>Conserver la réponse</button></div></div>}
    <Selection client={client} member={member} session={session} manage={tab === 'manage'} participants={tab === 'participants'} />
    {tab === 'manage' && admin && <details className="mt response-corrections"><summary>Corriger une réponse · {directory.length} adhérents</summary><ul className="member-list">{directory.map(person => <li key={person.id}><span>{person.first_name} {person.last_name}</span><label>Réponse de {person.first_name} {person.last_name}<select disabled={busy || session.status === 'closed'} value={responses.find(response => response.member_id === person.id)?.rsvp ?? 'unanswered'} onChange={event => void respond(event.target.value as 'yes' | 'maybe' | 'no', false, person.id)}><option value="unanswered" disabled>Sans réponse</option>{(['yes', 'maybe', 'no'] as const).map(value => <option key={value} value={value}>{rsvpLabels[value]}</option>)}</select></label></li>)}</ul></details>}
    {tab === 'transport' && <Carpooling client={client} member={member} session={session} onProfileSaved={refreshMember} />}
    {tab === 'groups' && <Palanquees client={client} member={member} session={session} />}
    {tab === 'bilan' && <Attendance client={client} member={member} session={session} onChanged={onChanged} />}
    {message && <p role="status">{message}</p>}</div>
  </section>
}
export function Sessions({ client, member, refreshMember }: { client: SupabaseClient<Database>; member: Member; refreshMember?: () => Promise<void> }) {
  const [season, setSeason] = useState(seasonOf(todayParis()))
  const [counts, setCounts] = useState<Database['public']['Functions']['get_season_counts']['Returns']>([])
  const [filter, setFilter] = useState<CalendarFilter>('upcoming')
  const [entryTab, setEntryTab] = useState<SessionTab>('overview')
  const [loadedSeason, setLoadedSeason] = useState<number | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [summaries, setSummaries] = useState<Record<string, CardSummary>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const loadSequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++loadSequence.current
    const bounds = seasonBounds(season)
    try {
      const [calendar, totals, occupancy] = await Promise.all([
        client.from('sessions').select('*').gte('date', bounds.start).lt('date', bounds.end).order('date').order('start_time'),
        client.rpc('get_season_counts', { p_start_year: season }),
        client.rpc('get_session_card_summaries', { p_start_year: season }),
      ])
      const { data, error } = calendar
      if (request !== loadSequence.current) return
      const summary = Object.fromEntries((occupancy.data ?? []).map(row => [row.session_id, row]))
      if (error || totals.error || occupancy.error || (data ?? []).some(row => !summary[row.id] || !validSummary(summary[row.id]))) {
        setMessage('Actualisation du calendrier impossible. Les dernières données reçues sont conservées.'); return
      }
      setCounts(totals.data ?? [])
      setLoadedSeason(season); setSummaries(summary); setSessions((data ?? []).map(row => ({ ...row, capacity: summary[row.id].capacity }))); setMessage('')
    } catch {
      if (request === loadSequence.current) setMessage('Actualisation du calendrier impossible. Les dernières données reçues sont conservées.')
    }
  }, [client, season])
  useSharedRefresh(load)
  const session = loadedSeason === season ? sessions.find(item => item.id === selected) : undefined
  const visible = calendarSessions(sessions, filter, todayParis())
  const next = nextSession(sessions, todayParis())
  async function saved(id: string | null) {
    if (id) {
      const result = await client.from('sessions').select('date').eq('id', id).single()
      if (result.data) setSeason(seasonOf(result.data.date))
    }
    await load(); setEntryTab('overview'); setSelected(id); setEditing(false)
  }
  return <><section className="calendar-heading" hidden={editing || !!session}><PageHeading eyebrow="Le calendrier APSAP" title="Les séances" actions={member.role !== 'member' && <button className="primary" onClick={() => { setSelected(null); setEditing(true) }}>Nouvelle séance</button>}><p>Les prochains rendez-vous du club, de l’inscription au bilan.</p></PageHeading><div className="calendar-tools"><p>Mes fosses réalisées cette saison : <strong>{loadedSeason === season ? counts.find(row => row.member_id === member.id)?.completed_count ?? 0 : '…'}</strong>. Seuls les bilans clôturés comptent.</p><label>Saison<select value={season} onChange={event => { setSeason(Number(event.target.value)); setSelected(null); setEditing(false) }}>{Array.from(new Set([season, seasonOf(todayParis()) - 1, seasonOf(todayParis()), ...sessions.map(item => seasonOf(item.date))])).sort((a, b) => b - a).map(year => <option key={year} value={year}>{year}–{year + 1}</option>)}</select></label><div className="actions"><button onClick={() => { setSeason(season - 1); setSelected(null); setEditing(false) }}>Saison précédente</button><button onClick={() => { setSeason(season + 1); setSelected(null); setEditing(false) }}>Saison suivante</button></div><div className="actions mt" role="group" aria-label="Période des séances">{([['upcoming', 'À venir'], ['past', 'Passées'], ['all', 'Toutes']] as const).map(([value, label]) => <button key={value} className="secondary" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>{message && <div role="alert"><p>{message}</p><button className="secondary" onClick={() => void load()}>Réessayer</button></div>}</div></section>
    {editing && selected && !session ? <section className="card"><p>Cette séance n’est plus disponible dans le calendrier.</p><button onClick={() => { setSelected(null); setEditing(false) }}>Retour au calendrier</button></section> : editing ? <SessionEditor key={selected ?? 'new'} client={client} session={session} onSaved={saved} onCancel={() => setEditing(false)} /> : session ? <SessionDetail key={session.id} client={client} member={member} session={session} onEdit={() => setEditing(true)} onBack={() => { setSelected(null); window.scrollTo({ top: 0 }) }} onChanged={load} refreshMember={refreshMember} initialTab={entryTab} /> : loadedSeason !== season ? <div className="empty-state" role="status">{message ? 'Calendrier indisponible. Réessayez pour charger cette saison.' : 'Chargement du calendrier…'}</div> : <div className="session-grid">{visible.map(item => {
      const summary = summaries[item.id]
      const action = calendarAction(item, summary)
      return <article className={`card session-card${item.id === next ? ' next-session' : ''}`} key={item.id}>
        {item.id === next && <p className="eyebrow">Prochaine séance</p>}
        <div className="session-card-top"><DateTile date={item.date} /><span className={`chip ${item.status === 'closed' ? 'neutral' : item.registration_open ? 'green' : 'amber'}`}>{item.status === 'closed' ? 'Bilan clôturé' : item.registration_open ? 'Inscriptions ouvertes' : 'Inscriptions fermées'}</span></div>
        <h3>{item.title}</h3><p className="session-date">{formatDate(item.date)}</p><p className="meta"><Icon name="clock" />{item.start_time.slice(0, 5)} — {item.end_time.slice(0, 5)}</p><p className="meta"><Icon name="pin" />{item.venue || 'Lieu à préciser'}</p>
        <PublishedOccupancy summary={summary} /><PersonalStatus summary={summary} />
        {summary.my_rsvp !== 'yes' && item.status !== 'closed' && item.registration_open && summary.publication_version > 0 && summary.confirmed_count >= summary.capacity && <p className="calendar-hint">Vous pouvez encore répondre Oui</p>}
        {item.school_holiday && <p className="badge">Vacances scolaires</p>}
        <button className="session-open" onClick={() => { setEntryTab(action.tab); setSelected(item.id); window.scrollTo({ top: 0 }) }} aria-label={`${action.label} · séance du ${formatDate(item.date)}`}>{action.label}</button>
      </article>
    })}{!visible.length && <p className="empty-state">{filter === 'upcoming' ? 'Aucune séance à venir dans cette saison.' : filter === 'past' ? 'Aucune séance passée dans cette saison.' : 'Aucune séance dans cette saison.'}</p>}</div>}
  </>
}
