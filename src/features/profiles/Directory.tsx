import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { caciLabels, caciStatus, formatDate, todayParis } from '../../lib/dates'
import { protectScope } from '../../lib/navigation'
import { CaciEditor } from './Profile'
import { MemberCreate } from './MemberCreate'
import { PageHeading } from '../../components/Visual'
import { useSharedRefresh } from '../../lib/useSharedRefresh'

const roleLabels = { member: 'Adhérent', admin: 'Administrateur', president: 'Président' }
type Action = { member: Member; kind: 'deactivate' | 'reactivate' | 'grant' | 'revoke' }
export function Directory({ client, member: current }: { client: SupabaseClient<Database>; member: Member }) {
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [caci, setCaci] = useState('all')
  const [active, setActive] = useState('active')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [create, setCreate] = useState(false)
  const [action, setAction] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const accessFilter = useRef<HTMLSelectElement>(null)
  const sequence = useRef(0)
  const president = current.role === 'president'
  const load = useCallback(async () => {
    const request = ++sequence.current
    const { data, error: queryError } = await client.from('members').select('*').order('last_name')
    if (request !== sequence.current) return
    if (queryError) setError('L’annuaire est indisponible. Vérifiez vos droits.')
    else { setMembers(data ?? []); setError('') }
  }, [client])
  useSharedRefresh(load)
  useEffect(() => { if (action && president) dialog.current?.showModal(); else dialog.current?.close() }, [action, president])
  async function confirm() {
    if (!action || !president) return
    setBusy(true); setActionError(''); setMessage('')
    try {
      const result = action.kind === 'grant' || action.kind === 'revoke'
        ? await client.rpc('set_member_role', { p_member_id: action.member.id, p_role: action.kind === 'grant' ? 'admin' : 'member' })
        : await client.rpc('set_member_active', { p_member_id: action.member.id, p_active: action.kind === 'reactivate' })
      if (result.error) setActionError('Modification refusée. Vérifiez vos droits et actualisez l’annuaire.')
      else { setAction(null); setMessage('Adhérent mis à jour.'); await load(); if (action.kind === 'deactivate' || action.kind === 'reactivate') accessFilter.current?.focus() }
    } catch { setActionError('Modification indisponible. Réessayez.') }
    finally { setBusy(false) }
  }
  function resetFilters(){setSearch('');setRole('all');setCaci('all');setActive('active')}
  const visible = members.filter(member => `${member.first_name} ${member.last_name} ${member.email}`.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')) && (role === 'all' || member.role === role) && (caci === 'all' || caciStatus(member.caci_expiry_date) === caci) && (active === 'all' || (member.disabled_at ? 'inactive' : 'active') === active))
  return <section className="card directory"><PageHeading eyebrow="Administration" title="Gestion des adhérents" actions={president && <button className="primary" aria-expanded={create} onClick={() => {protectScope('member-create',()=>{setCreate(!create);setMessage('')})}}>Ajouter un adhérent</button>}><p>Un annuaire partagé pour les informations du club{president ? ', les droits et les accès.' : '.'}</p></PageHeading>
    {create && president && <MemberCreate client={client} onCancel={() => { setCreate(false); document.querySelector<HTMLButtonElement>('.directory .page-heading button')?.focus() }} onSaved={async () => { await load(); setCreate(false); setSearch(''); setRole('all'); setCaci('all'); setActive('active'); setMessage('Adhérent créé. Il peut demander son lien de connexion.'); document.querySelector<HTMLButtonElement>('.directory .page-heading button')?.focus() }} />}
    <div className="directory-filters"><label className="directory-search">Rechercher un adhérent<input type="search" placeholder="Nom ou email" value={search} onChange={event => setSearch(event.target.value)} /></label><label>Rôle<select value={role} onChange={event => setRole(event.target.value)}><option value="all">Tous les rôles</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>CACI<select value={caci} onChange={event => setCaci(event.target.value)}><option value="all">Tous les CACI</option>{Object.entries(caciLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="directory-access">Accès<select ref={accessFilter} value={active} onChange={event => setActive(event.target.value)}><option value="active">Actifs</option><option value="inactive">Inactifs</option><option value="all">Tous les accès</option></select></label></div>
    <div className="directory-results"><p className="muted" role="status">{visible.length} adhérent{visible.length !== 1 && 's'} affiché{visible.length !== 1 && 's'}{message && ` · ${message}`}</p><button className="secondary" type="button" onClick={resetFilters}>Réinitialiser les filtres</button></div>{error && !action && <p role="alert">{error}</p>}
    {!visible.length && <p className="empty-state">Aucun adhérent ne correspond à ces critères.</p>}
    <ul className="member-list">{members.filter(member=>visible.some(row=>row.id===member.id)||selected===member.id).map(member => { const name = `${member.first_name} ${member.last_name}`; const status = caciStatus(member.caci_expiry_date); return <li key={member.id} hidden={!visible.some(row=>row.id===member.id)}>
      <div className="member-information"><div className="member-title"><strong>{name}</strong><span className={`chip ${member.role === 'member' ? 'neutral' : 'teal'}`}>{roleLabels[member.role]}</span>{member.disabled_at && <span className="chip amber">Inactif</span>}</div><p>{member.email}{member.phone && ` · ${member.phone}`}</p><p>{member.current_level || 'Niveau non renseigné'}{member.preparing_level && ` · Prépare ${member.preparing_level}`}</p><p><span className={`chip ${status === 'valid' ? 'green' : status === 'expired' ? 'red' : 'amber'}`}>CACI {caciLabels[status]}</span>{member.caci_expiry_date && <span> · valable jusqu’au {formatDate(member.caci_expiry_date)}</span>}</p>{member.disabled_at && <p>Désactivé le {formatDate(todayParis(new Date(member.disabled_at)))} · historique conservé</p>}</div>
      <div className="member-actions"><button id={`caci-toggle-${member.id}`} aria-expanded={selected === member.id} onClick={() => protectScope(selected ? `caci:directory:${selected}` : undefined,()=>setSelected(selected === member.id ? null : member.id))}>Modifier le CACI de {name}</button>{president && member.role !== 'president' && <details><summary>Gérer les droits et l’accès de {name}</summary><div className="actions"><button onClick={() => { setActionError(''); setAction({ member, kind: member.role === 'admin' ? 'revoke' : 'grant' }) }}>{member.role === 'admin' ? 'Retirer les droits admin' : 'Accorder les droits admin'}</button><button className={member.disabled_at ? 'secondary' : 'danger'} onClick={() => { setActionError(''); setAction({ member, kind: member.disabled_at ? 'reactivate' : 'deactivate' }) }}>{member.disabled_at ? 'Réactiver' : 'Désactiver'}</button></div></details>}</div>
      {selected === member.id && <CaciEditor key={member.id} client={client} member={member} onRefresh={load} onSaved={async date => { setMembers(rows => rows.map(row => row.id === member.id ? { ...row, caci_expiry_date: date } : row)); await load(); setSelected(value => value === member.id ? null : value); document.getElementById(`caci-toggle-${member.id}`)?.focus() }} />}
    </li> })}</ul>

    {president && <dialog ref={dialog} aria-labelledby="member-action-title" onCancel={event => { if (busy) event.preventDefault(); else setAction(null) }} onClose={() => setAction(null)}><h2 id="member-action-title">{action?.kind === 'deactivate' ? 'Désactiver cet adhérent ?' : action?.kind === 'reactivate' ? 'Réactiver cet adhérent ?' : 'Modifier les droits administrateur ?'}</h2><p>{action?.member.first_name} {action?.member.last_name}</p><p>{action?.kind === 'deactivate' ? 'Cette personne ne pourra plus se connecter ni utiliser iFosse. Ses participations, paiements et autres historiques seront conservés. Vous pourrez la réactiver.' : action?.kind === 'reactivate' ? 'La personne pourra de nouveau demander un lien de connexion. Son rôle et son historique sont conservés.' : action?.kind === 'grant' ? 'Cette personne pourra gérer les séances et les données opérationnelles des adhérents.' : 'Cette personne retrouvera les accès d’un adhérent ordinaire.'}</p>{actionError && <p role="alert">{actionError}</p>}<div className="actions"><button autoFocus disabled={busy} onClick={() => setAction(null)}>Annuler</button><button className={action?.kind === 'deactivate' || action?.kind === 'revoke' ? 'danger' : 'primary'} disabled={busy} onClick={() => void confirm()}>Confirmer</button></div></dialog>}
  </section>
}
