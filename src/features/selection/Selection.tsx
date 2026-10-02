import { useCallback, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import type { Session } from '../sessions/SessionEditor'
import { useSharedRefresh } from '../../lib/useSharedRefresh'
export type CurrentSelection = Database['public']['Functions']['get_current_selection']['Returns'][number]
export const selectionLabels: Record<string, string> = { pending: 'En attente de publication', waiting: 'En attente', selected: 'Confirmé', declined: 'Non retenu', withdrawn: 'Désisté', none: 'Sans participation' }
export function Selection({ client, member, session, manage }: { client: SupabaseClient<Database>; member: Member; session: Session; manage: boolean }) {
  const [current, setCurrent] = useState<CurrentSelection[]>([])
  const [publication, setPublication] = useState<number | null>(null)
  const [draft, setDraft] = useState<Tables<'selection_draft'>[]>([])
  const [hasDraft, setHasDraft] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
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
    if (admin) {
      const [draftResult, headerResult] = await Promise.all([
        client.from('selection_draft').select('*').eq('session_id', session.id),
        client.from('selection_drafts').select('session_id').eq('session_id', session.id).maybeSingle(),
      ])
      if (request !== sequence.current) return
      if (draftResult.error || headerResult.error) setMessage('Brouillon indisponible. Vérifiez vos droits.')
      else { setDraft(draftResult.data ?? []); setHasDraft(!!headerResult.data) }
    }
  }, [client, session.id, admin])
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
    const { error } = await client.rpc('publish_selection', { p_session_id: session.id })
    if (error) setMessage('Publication refusée. Actualisez et vérifiez la sélection ainsi que la capacité.')
    else { setConfirm(false); setMessage('Sélection publiée.'); await load() }
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
  const draftCount = editable.filter(person => draftState(person) === 'selected').length
  return <div className="mt selection"><h3>Sélection publiée{publication && ` · version ${publication}`}</h3>
    <p>Ma place : <strong>{selectionLabels[own?.state ?? (publication ? 'none' : 'pending')]}</strong></p>
    <p>{selected.length} participants confirmés / {session.capacity} places.</p>
    {!publication && <p>Aucune sélection publiée pour le moment.</p>}
    {publication && <ul className="member-list">{current.filter(person => !['none', 'pending'].includes(person.state)).map(person => <li key={person.member_id}><span>{person.first_name} {person.last_name} · {person.current_level}</span><strong>{selectionLabels[person.state]}</strong></li>)}</ul>}
    {manage && admin && <div className="mt"><h3>Sélection de travail · {draftCount} / {session.capacity}</h3><p>{hasDraft ? 'Brouillon privé en cours.' : 'La sélection publiée sert de point de départ.'} Les adhérents voient uniquement la dernière publication.</p>
      {(['selected', 'waiting', 'declined'] as const).map(state => <div key={state}><h4>{selectionLabels[state]} · {editable.filter(person => draftState(person) === state).length}</h4><ul className="member-list">{editable.filter(person => draftState(person) === state).map(person => <li key={person.member_id}><span>{person.first_name} {person.last_name} · {person.rsvp === 'yes' ? 'Oui' : 'Peut-être'}</span><label>Sélection de {person.first_name} {person.last_name}<select value={state} disabled={busy || session.status === 'closed'} onChange={event => void change(person.member_id, event.target.value as 'selected' | 'waiting' | 'declined')}>{(['selected', 'waiting', 'declined'] as const).map(value => <option key={value} value={value} disabled={value === 'selected' && person.rsvp !== 'yes'}>{selectionLabels[value]}</option>)}</select></label></li>)}</ul></div>)}
      <div className="actions"><button disabled={busy || session.status === 'closed'} onClick={() => setConfirm(true)}>Publier la sélection</button>{hasDraft && <button disabled={busy || session.status === 'closed'} onClick={() => void discard()}>Abandonner le brouillon</button>}</div>
      {confirm && <div className="mt"><p>Publier cette sélection de {draftCount} personnes ? Elle remplacera la version visible aux adhérents.</p><div className="actions"><button disabled={busy} onClick={() => void publish()}>Confirmer la publication</button><button onClick={() => setConfirm(false)}>Continuer le brouillon</button></div></div>}
    </div>}
    {message && <p role="status">{message}</p>}
  </div>
}
