import { useCallback, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import type { Session } from '../sessions/SessionEditor'
import type { CurrentSelection } from '../selection/Selection'
import { useSharedRefresh } from '../../lib/useSharedRefresh'
import { levelCategories, levelSummary } from './levels'
type Published = Database['public']['Functions']['get_current_palanquees']['Returns'][number]
type Publication = Database['public']['Functions']['get_palanquee_state']['Returns'][number]
type Assignment = { member_id: string; group_number: number; is_leader: boolean }
function Summary({ people }: { people: { current_level: string; preparing_level: string | null }[] }) {
  const counts = levelSummary(people)
  return <p className="level-summary">Total : {people.length} · {levelCategories.filter(category => counts[category] > 0).map(category => `${category} : ${counts[category]}`).join(' · ') || 'Aucun participant'}</p>
}
export function Palanquees({ client, member, session }: { client: SupabaseClient<Database>; member: Member; session: Session }) {
  const admin = member.role !== 'member'
  const [loaded, setLoaded] = useState(false)
  const [ownState, setOwnState] = useState<string | null>(null)
  const [selected, setSelected] = useState<CurrentSelection[]>([])
  const [published, setPublished] = useState<Published[]>([])
  const [publication, setPublication] = useState<Publication | null>(null)
  const [draft, setDraft] = useState<Tables<'palanquee_draft'>[]>([])
  const [source, setSource] = useState<string | null>(null)
  const [latestSelection, setLatestSelection] = useState<string | null>(null)
  const [pending, setPending] = useState<Assignment | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState(false)
  const [message, setMessage] = useState('')
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++sequence.current
    const [selection, groups, header] = await Promise.all([
      client.rpc('get_current_selection', { p_session_id: session.id }),
      client.rpc('get_current_palanquees', { p_session_id: session.id }),
      client.rpc('get_palanquee_state', { p_session_id: session.id }),
    ])
    if (request !== sequence.current) return
    if (selection.error || groups.error || header.error) { setMessage('Palanquées indisponibles. Actualisez la séance.'); return }
    const current = selection.data ?? []
    setLoaded(true)
    setOwnState(current.find(person => person.member_id === member.id)?.state ?? null)
    setSelected(current.filter(person => person.state === 'selected'))
    setLatestSelection(current[0]?.publication_id ?? null)
    setPublished(groups.data ?? [])
    // For non-empty groups, prefer metadata read in their own RPC snapshot.
    const first = groups.data?.[0]
    setPublication(first ? { publication_id: first.publication_id, publication_version: first.publication_version, selection_version: first.selection_version, needs_review: first.needs_review, selection_publication_id: first.selection_publication_id } : header.data?.[0] ?? null)
    if (admin) {
      const [rows, draftHeader] = await Promise.all([
        client.from('palanquee_draft').select('*').eq('session_id', session.id),
        client.from('palanquee_drafts').select('*').eq('session_id', session.id).maybeSingle(),
      ])
      if (request !== sequence.current) return
      if (rows.error || draftHeader.error) { setDraft([]); setSource(null); setMessage('Brouillon indisponible. Vérifiez vos droits.'); return }
      setDraft(rows.data ?? []); setSource(draftHeader.data?.selection_publication_id ?? null)
    }
  }, [client, session.id, admin, member.id])
  useSharedRefresh(load)
  const baseAssignments: Assignment[] = source ? draft : published
  const assignments = pending ? [...baseAssignments.filter(row => row.member_id !== pending.member_id), ...(pending.group_number ? [pending] : [])] : baseAssignments
  const staleDraft = !!source && (source !== latestSelection || draft.some(row => !selected.some(person => person.member_id === row.member_id)))
  function assignment(id: string) { return assignments.find(row => row.member_id === id) }
  async function change(id: string, group: number, leader: boolean) {
    setPending({ member_id: id, group_number: group, is_leader: leader })
    setBusy(true); setMessage(''); setConfirmation(false)
    const result = await client.rpc('set_draft_palanquee', { p_session_id: session.id, p_member_id: id, p_group_number: group || undefined, p_is_leader: leader })
    setMessage(result.error ? 'Affectation refusée. Vérifiez la sélection publiée et abandonnez un brouillon périmé.' : 'Brouillon enregistré. La publication visible reste inchangée.')
    await load(); setPending(null); setBusy(false)
  }
  async function publish() {
    setBusy(true); setMessage('')
    const result = await client.rpc('publish_palanquees', { p_session_id: session.id })
    setMessage(result.error ? 'Publication refusée. Actualisez la sélection et vérifiez le brouillon.' : 'Palanquées publiées.')
    if (!result.error) setConfirmation(false)
    await load(); setBusy(false)
  }
  async function discard() {
    setBusy(true); setMessage(''); setConfirmation(false)
    const result = await client.rpc('discard_palanquee_draft', { p_session_id: session.id })
    setMessage(result.error ? 'Abandon du brouillon refusé.' : 'Brouillon abandonné.')
    await load(); setBusy(false)
  }
  const groups = [...new Set(published.map(row => row.group_number))].sort((a, b) => a - b)
  const draftGroups = [...new Set(assignments.filter(row => selected.some(person => person.member_id === row.member_id)).map(row => row.group_number))].sort((a, b) => a - b)
  const remaining = selected.filter(person => !published.some(row => row.member_id === person.member_id)).length
  const draftRemaining = selected.filter(person => !assignment(person.member_id)).length
  const ownGroup = published.find(row => row.member_id === member.id)?.group_number
  function renderGroup(group: number) {
    return <section key={group} className={group === ownGroup ? 'card personal-group' : 'mt'} aria-label={group === ownGroup ? 'Ma palanquée publiée' : `Palanquée ${group}`}>
      {group === ownGroup && <p className="eyebrow">Ma palanquée</p>}<h4>Palanquée {group}</h4><Summary people={published.filter(row => row.group_number === group)} /><ul className="member-list">{published.filter(row => row.group_number === group).map(row => <li key={row.member_id}>{row.first_name} {row.last_name}{row.member_id === member.id && ' · vous'} · {row.current_level}{row.preparing_level && ` · prépare ${row.preparing_level}`}{row.is_leader && ' · Encadrant'}</li>)}</ul>
    </section>
  }
  return <div className="mt palanquees">
    {!loaded && <p>Chargement de ma palanquée…</p>}
    {loaded && !ownGroup && <section className="personal-group"><h3>Ma palanquée</h3><p>{ownState === 'withdrawn' ? 'Vous vous êtes désisté : aucune palanquée effective.' : !publication ? 'Les palanquées ne sont pas encore publiées.' : ownState !== 'selected' ? 'Vous n’avez pas de place confirmée : aucune palanquée effective.' : 'Vous n’êtes pas encore affecté à une palanquée publiée.'}</p></section>}
    {publication?.needs_review && <p role="alert">La sélection a changé depuis la publication des palanquées. Un administrateur doit les vérifier et les republier.</p>}
    <div className="published-groups">
      {ownGroup && renderGroup(ownGroup)}
      <h3>{ownGroup ? 'Autres palanquées publiées' : 'Palanquées publiées'}</h3>
      {groups.filter(group => group !== ownGroup).map(renderGroup)}
    </div>
    {publication && <p className="muted">Palanquées publiées · version {publication.publication_version} · sélection version {publication.selection_version}.</p>}
    <p>Organisation simple uniquement. Aucun contrôle des qualifications, des ratios ou des limites de profondeur. Cette vue ne remplace pas la fiche réglementaire ni les décisions du DP. La mention « Encadrant » est informative.</p>
    <h4>Niveaux de la sélection publiée actuelle</h4><Summary people={selected} />
    {!published.length && <p>{publication ? 'Aucun participant actuellement affecté dans cette publication.' : 'Aucune palanquée publiée.'}</p>}
    <p>{remaining} participant{remaining === 1 ? '' : 's'} confirmé{remaining === 1 ? '' : 's'} à répartir.</p>
    {admin && <div className="palanquee-editor mt"><h3>Organisation de travail</h3><p>{source ? 'Brouillon privé en cours.' : 'La dernière publication sert de point de départ.'}</p>
      {staleDraft && <p role="alert">Le brouillon ne correspond plus à la sélection. Abandonnez-le, puis reprenez les affectations.</p>}
      <ul className="member-list">{selected.map(person => {
        const row = assignment(person.member_id)
        return <li key={person.member_id}><strong>{person.first_name} {person.last_name} · {person.current_level}</strong><label>Palanquée de {person.first_name} {person.last_name}<select disabled={busy || session.status === 'closed' || staleDraft} value={row?.group_number ?? 0} onChange={event => void change(person.member_id, Number(event.target.value), row?.is_leader ?? false)}><option value={0}>Non affecté</option>{Array.from({ length: 8 }, (_, index) => <option key={index} value={index + 1}>Palanquée {index + 1}</option>)}</select></label><label className="check"><input type="checkbox" disabled={busy || session.status === 'closed' || staleDraft || !row} checked={row?.is_leader ?? false} onChange={event => void change(person.member_id, row!.group_number, event.target.checked)} />{person.first_name} {person.last_name} est encadrant</label></li>
      })}</ul>
      <h4>Répartition de travail</h4><div className="draft-summaries">{draftGroups.map(group => <div key={group}><h4>Palanquée {group}</h4><Summary people={selected.filter(person => assignment(person.member_id)?.group_number === group)} /></div>)}</div>
      <p>{draftRemaining} participant{draftRemaining === 1 ? '' : 's'} non affecté{draftRemaining === 1 ? '' : 's'} dans le brouillon.</p>
      <div className="actions"><button disabled={busy || session.status === 'closed' || staleDraft || !latestSelection} className="primary" onClick={() => setConfirmation(true)}>Publier les palanquées</button>{source && <button disabled={busy || session.status === 'closed'} onClick={() => void discard()}>Abandonner le brouillon des palanquées</button>}</div>
      {confirmation && <div className="mt"><p>Publier cette organisation ? Elle remplacera la version visible aux adhérents. Les participants non affectés restent à répartir.</p><div className="actions"><button disabled={busy} className="primary" onClick={() => void publish()}>Confirmer la publication des palanquées</button><button disabled={busy} onClick={() => setConfirmation(false)}>Continuer le brouillon</button></div></div>}
    </div>}
    {message && <p role="status">{message}</p>}
  </div>
}
