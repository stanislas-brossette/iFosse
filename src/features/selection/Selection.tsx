import { useCallback, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import type { Session } from '../sessions/SessionEditor'
import { useSharedRefresh } from '../../lib/useSharedRefresh'
export type CurrentSelection = Database['public']['Functions']['get_current_selection']['Returns'][number]
import { seasonOf } from '../../lib/dates'
import { selectionLabels } from '../../lib/labels'
import { PaymentSummary } from '../payments/Payments'
import type { Readiness } from '../payments/Payments'
import { readSort, saveSort, sortLabels, sortParticipants } from './participantSort'
import type { SortKey, SortPreference } from './participantSort'
import { draftLabels, emptyFilters, managementRows, parsePublishPreview, publicationChanges } from './management'
import type { DraftState, ManagementFilters, ManagementPerson, PublishPreview } from './management'
export function Selection({ client, member, session, manage, participants = false }: { client: SupabaseClient<Database>; member: Member; session: Session; manage: boolean; participants?: boolean }) {
  const [counts, setCounts] = useState<Database['public']['Functions']['get_season_counts']['Returns']>([])
  const [countsAvailable, setCountsAvailable] = useState(false)
  const [managementSort, setManagementSort] = useState<'name' | 'count'>('name')
  const [descending, setDescending] = useState(false)
  const [filters, setFilters] = useState<ManagementFilters>(emptyFilters)
  const [preview, setPreview] = useState<PublishPreview | null>(null)
  const [current, setCurrent] = useState<CurrentSelection[]>([])
  const [publication, setPublication] = useState<number | null>(null)
  const [draft, setDraft] = useState<Tables<'selection_draft'>[]>([])
  const [hasDraft, setHasDraft] = useState(false)
  const [readiness, setReadiness] = useState<Readiness[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(readSort)
  function changeSort(next: SortPreference) { setSort(next); saveSort(next) }
  const sequence = useRef(0)
  const admin = member.role !== 'member'
  const load = useCallback(async () => {
    const request = ++sequence.current
    const [stateResult, publicationResult] = await Promise.all([
      client.rpc('get_current_selection', { p_session_id: session.id }),
      client.from('selection_publications').select('*').eq('session_id', session.id).order('version', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (request !== sequence.current) return
    if (stateResult.error || publicationResult.error) { setMessage('Sélection indisponible. Actualisez la séance.'); return }
    const rows = stateResult.data ?? []
    setCurrent(rows)
    // Read version and effective states from the same RPC snapshot. For an
    // empty population there is no state to mix, so the header is a fallback.
    setPublication(rows.length ? rows[0].publication_version || null : publicationResult.data?.version ?? null)
    if (admin && manage) {
      const [draftResult, headerResult, readinessResult, countsResult] = await Promise.all([
        client.from('selection_draft').select('*').eq('session_id', session.id),
        client.from('selection_drafts').select('session_id').eq('session_id', session.id).maybeSingle(),
        client.rpc('get_admin_readiness', { p_session_id: session.id }),
        client.rpc('get_season_counts', { p_start_year: seasonOf(session.date) }),
      ])
      if (request !== sequence.current) return
      setCountsAvailable(!countsResult.error)
      if (!countsResult.error) setCounts(countsResult.data ?? [])
      if (readinessResult.error) setReadiness([])
      else setReadiness(readinessResult.data ?? [])
      if (draftResult.error || headerResult.error || readinessResult.error) setMessage('Brouillon indisponible. Vérifiez vos droits.')
      else { setDraft(draftResult.data ?? []); setHasDraft(!!headerResult.data) }
    }
  }, [client, session.id, session.date, admin, manage])
  useSharedRefresh(load)
  async function change(id: string, state: 'selected' | 'waiting' | 'declined') {
    setBusy(true); setMessage(''); setConfirm(false)
    const { error } = await client.rpc('set_draft_selection', { p_session_id: session.id, p_member_id: id, p_state: state })
    if (error) setMessage('Modification refusée : seuls les Oui sont confirmables, dans la capacité actuelle. Actualisez la séance ou augmentez sa capacité.')
    else { setMessage('Brouillon enregistré. La publication visible aux adhérents reste inchangée.'); await load() }
    setBusy(false)
  }
  async function publish() {
    setBusy(true); setMessage('')
    if (!preview) { setBusy(false); return }
    const { error } = await client.rpc('publish_selection_checked', { p_session_id: session.id, p_expected_fingerprint: preview.fingerprint })
    if (error?.code === '40001') { setMessage('La sélection a changé. Vérifiez le nouveau récapitulatif puis confirmez à nouveau.'); await preparePublication(false) }
    else if (error) setMessage('Publication refusée. Actualisez et vérifiez la sélection ainsi que la capacité.')
    else { setConfirm(false); setMessage('Sélection publiée.'); await load() }
    setBusy(false)
  }
  async function preparePublication(clearMessage = true) {
    setBusy(true); if (clearMessage) setMessage('')
    const result = await client.rpc('get_selection_publish_preview', { p_session_id: session.id })
    const value = parsePublishPreview(result.data)
    if (result.error || !value) { setPreview(null); setConfirm(false); setMessage('Récapitulatif indisponible. Actualisez avant de publier.') }
    else { setPreview(value); setConfirm(true) }
    setBusy(false)
  }
  async function discard() {
    setBusy(true); setMessage(''); setConfirm(false)
    const { error } = await client.rpc('discard_selection_draft', { p_session_id: session.id })
    if (error) setMessage('Abandon du brouillon refusé.')
    else { setMessage('Brouillon abandonné.'); await load() }
    setBusy(false)
  }
  const own = current.find(person => person.member_id === member.id)
  const selected = current.filter(person => person.state === 'selected')
  const editable = current.filter(person => person.rsvp === 'yes' || person.rsvp === 'maybe')
  function draftState(person: CurrentSelection) { return hasDraft ? draft.find(row => row.member_id === person.member_id)?.state ?? 'waiting' : ['selected', 'declined'].includes(person.state) ? person.state : 'waiting' }
  const managementPeople: ManagementPerson[] = editable.map(person => ({ ...person, draftState: draftState(person) as DraftState, completedCount: countsAvailable ? counts.find(row => row.member_id === person.member_id)?.completed_count ?? null : null, readiness: readiness.find(row => row.member_id === person.member_id) }))
  const filtered = managementRows(managementPeople, search, filters, managementSort, descending)
  const diff = preview ? publicationChanges(preview) : null
  function resetFilters() { setSearch(''); setFilters(emptyFilters) }
  const draftCount = editable.filter(person => draftState(person) === 'selected').length
  return <div className={`mt selection ${manage ? 'selection-management' : ''}`}>{manage && <><h3>Sélection publiée{publication && ` · version ${publication}`}</h3>
    <p>Ma place : <strong>{selectionLabels[own?.state ?? (publication ? 'none' : 'pending')]}</strong></p>
    <p>{selected.length} confirmés dans la publication / {session.capacity} places.</p>
    {!publication && <p>Aucune sélection publiée pour le moment.</p>}</>}
    {participants && <p className="published-total">{selected.length} participants confirmés / {session.capacity} places.{!publication && ' Sélection non publiée.'}</p>}
    {participants && <div className="participant-selection"><h3>Participants · {editable.length}</h3><p className="muted">Réponses Oui et Peut-être.</p>
      <div className="participant-sort"><label>Trier par<select value={sort.key} onChange={event => changeSort({ key: event.target.value as SortKey, descending: false })}>{Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" aria-label={`Ordre ${sort.descending ? 'décroissant' : 'croissant'} : passer à l’ordre ${sort.descending ? 'croissant' : 'décroissant'}`} onClick={() => changeSort({ ...sort, descending: !sort.descending })}><span aria-hidden="true">{sort.descending ? '↓' : '↑'}</span> {sort.descending ? 'Décroissant' : 'Croissant'}</button></div>
      {!editable.length && <p>Aucune réponse Oui ou Peut-être.</p>}<ul className="member-list">{sortParticipants(editable, sort).map(person => <li key={person.member_id}><span>{person.first_name} {person.last_name} · {person.current_level || 'Niveau non renseigné'}{person.preparing_level && ` · prépare ${person.preparing_level}`}</span><strong className={`chip ${person.state === 'selected' ? 'green' : person.state === 'declined' ? 'red' : 'amber'}`}>{person.rsvp === 'yes' ? 'Oui' : 'Peut-être'} · {selectionLabels[person.state] ?? 'Statut inconnu'}</strong></li>)}</ul></div>}
    {manage && admin && <div className="mt"><h3>Sélection de travail · {draftCount} / {session.capacity}</h3><p>{hasDraft ? 'Brouillon privé en cours.' : 'La sélection publiée sert de point de départ.'} Les adhérents voient uniquement la dernière publication.</p><p>Base du récapitulatif : {hasDraft ? 'brouillon privé, à publier' : 'sélection publiée'}. CACI, trajet et conducteur utilisent cette même base.</p><p>Préparation opérationnelle uniquement : ce récapitulatif ne valide ni l’aptitude médicale ni la conformité réglementaire.</p>
      <div className="actions publish-actions"><button className="primary" disabled={busy || session.status === 'closed'} onClick={() => void preparePublication()}>Publier la sélection</button>{hasDraft && <button disabled={busy || session.status === 'closed'} className="danger" onClick={() => void discard()}>Abandonner le brouillon</button>}</div>
      {message && <p role="status">{message}</p>}
      {confirm && preview && diff && <section className="publication-preview mt" aria-label="Récapitulatif de publication"><h4>{preview.publication_version ? `Remplacer la publication ${preview.publication_version}` : 'Première publication'}</h4><p>{diff.selectedCount} retenus / {preview.capacity} places. Comparaison de toutes les personnes, indépendamment des filtres.</p>{([['Ajoutés aux confirmés', diff.added], ['Retirés des confirmés', diff.removed], ['Autres changements', diff.other]] as const).map(([label, rows]) => <div key={label}><h5>{label} · {rows.length}</h5>{rows.length ? <ul>{rows.map(row => <li key={row.member_id}>{row.first_name} {row.last_name}{label === 'Autres changements' && ` · ${draftLabels[row.draft_state as DraftState] ?? 'Hors sélection'}`}</li>)}</ul> : <p className="muted">Aucun.</p>}</div>)}<div className="actions"><button className="primary" disabled={busy} onClick={() => void publish()}>Confirmer la publication</button><button disabled={busy} onClick={() => { setConfirm(false); setPreview(null) }}>Continuer le brouillon</button></div></section>}
      <label className="filter-label">Rechercher dans la sélection<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="management-tools"><label>Trier la sélection<select value={managementSort} onChange={event => setManagementSort(event.target.value as 'name' | 'count')}><option value="name">Nom</option><option value="count">Fosses réalisées</option></select></label><button type="button" aria-label={`Tri ${descending ? 'décroissant' : 'croissant'} : inverser la sélection`} onClick={() => setDescending(!descending)}>{descending ? '↓ Décroissant' : '↑ Croissant'}</button></div>
      <fieldset className="management-filters"><legend>Filtres combinables</legend><button type="button" aria-pressed={!Object.values(filters).some(Boolean)} onClick={() => setFilters(emptyFilters)}>Tous</button>{([['waiting','En attente'],['caci','CACI à vérifier'],['transport','Transport à organiser'],['unpaid','À régler']] as const).map(([key,label]) => <label key={key}><input type="checkbox" checked={filters[key]} onChange={event => setFilters({ ...filters, [key]: event.target.checked })} />{label}</label>)}</fieldset>
      <p className="filter-results">{filtered.length} / {editable.length} personnes affichées <button type="button" className="secondary" onClick={resetFilters}>Réinitialiser la sélection affichée</button></p>
      {!countsAvailable && <p role="status">Compteurs indisponibles : aucune valeur zéro n’est supposée. <button onClick={() => void load()}>Actualiser les compteurs</button></p>}
      {!filtered.length && <p className="empty-state">Aucune personne ne correspond aux filtres.</p>}
      {(['selected', 'waiting', 'declined'] as const).map(state => <div className={`selection-group ${state}`} key={state}><h4>{draftLabels[state]} · {managementPeople.filter(person => person.draftState === state).length}</h4><ul className="member-list">{filtered.filter(person => person.draftState === state).map(person => <li className="management-row" key={person.member_id}><div className="member-preparation"><strong>{person.first_name} {person.last_name} · {person.rsvp === 'yes' ? 'Oui' : 'Peut-être'}</strong><p className="compact-member-meta">{person.current_level || 'Niveau non renseigné'}{person.preparing_level && ` · prépare ${person.preparing_level}`} · Fosses réalisées dans la saison : <strong>{person.completedCount ?? 'Indisponible'}</strong></p><PaymentSummary readiness={person.readiness} client={client} sessionId={session.id} firstName={person.first_name} lastName={person.last_name} onSaved={load} compact /></div><label>Sélection de {person.first_name} {person.last_name}<select value={state} disabled={busy || session.status === 'closed'} onChange={event => void change(person.member_id, event.target.value as DraftState)}>{(['selected', 'waiting', 'declined'] as const).map(value => <option key={value} value={value} disabled={value === 'selected' && person.rsvp !== 'yes'}>{draftLabels[value]}</option>)}</select></label></li>)}</ul></div>)}

    </div>}
    {!manage && message && <p role="status">{message}</p>}
  </div>
}
