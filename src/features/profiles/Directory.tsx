import { useCallback, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { caciLabels, caciStatus } from '../../lib/dates'
import { CaciEditor } from './Profile'
import { PageHeading } from '../../components/Visual'
import { useSharedRefresh } from '../../lib/useSharedRefresh'

export function Directory({ client }: { client: SupabaseClient<Database> }) {
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++sequence.current
    const { data, error: queryError } = await client.from('members').select('*').order('last_name')
    if (request !== sequence.current) return
    if (queryError) setError('L’annuaire est indisponible. Vérifiez vos droits.')
    else { setMembers(data ?? []); setError('') }
  }, [client])
  useSharedRefresh(load)
  return <section className="card directory"><PageHeading eyebrow="Administration" title="Annuaire des adhérents"><p>{members.length} adhérents · informations réservées aux organisateurs.</p></PageHeading><label>Rechercher un adhérent<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>{error && <p role="alert">{error}</p>}
    <ul className="member-list">{members.filter(member => `${member.first_name} ${member.last_name}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))).map(member => <li key={member.id}><div><strong>{member.first_name} {member.last_name}</strong><p>{member.current_level || 'Niveau non renseigné'} · CACI {caciLabels[caciStatus(member.caci_expiry_date)]}{member.caci_expiry_date && ` · valable jusqu’au ${member.caci_expiry_date}`}</p><p>{member.email}{member.phone && ` · ${member.phone}`}</p></div><button id={`caci-toggle-${member.id}`} aria-expanded={selected === member.id} onClick={() => setSelected(selected === member.id ? null : member.id)}>Modifier le CACI de {member.first_name} {member.last_name}</button>
      {selected === member.id && <CaciEditor key={member.id} client={client} member={member} onRefresh={load} onSaved={async date => { setMembers(current => current.map(row => row.id === member.id ? { ...row, caci_expiry_date: date } : row)); await load(); setSelected(current => current === member.id ? null : current); document.getElementById(`caci-toggle-${member.id}`)?.focus() }} />}
    </li>)}</ul>
  </section>
}
