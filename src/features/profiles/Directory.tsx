import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { caciLabels, caciStatus } from '../../lib/dates'
import { CaciEditor } from './Profile'

export function Directory({ client }: { client: SupabaseClient<Database> }) {
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  async function load() {
    const { data, error: queryError } = await client.from('members').select('*').order('last_name')
    if (queryError) setError('L’annuaire est indisponible. Vérifiez vos droits.')
    else setMembers(data ?? [])
  }
  useEffect(() => { void load() }, [])
  return <section className="card"><h2>Annuaire des adhérents</h2><label>Rechercher un adhérent<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>{error && <p role="alert">{error}</p>}
    <ul className="member-list">{members.filter(member => `${member.first_name} ${member.last_name}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))).map(member => <li key={member.id}><div><strong>{member.first_name} {member.last_name}</strong><p>{member.current_level || 'Niveau non renseigné'} · CACI {caciLabels[caciStatus(member.caci_expiry_date)]}</p><p>{member.email}{member.phone && ` · ${member.phone}`}</p></div><button onClick={() => setSelected(selected === member.id ? null : member.id)}>Modifier le CACI de {member.first_name} {member.last_name}</button>
      {selected === member.id && <CaciEditor key={member.id} client={client} member={member} onSaved={load} />}
    </li>)}</ul>
  </section>
}
