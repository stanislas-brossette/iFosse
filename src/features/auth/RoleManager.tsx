import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'

type RoleMember = { id: string; first_name: string; last_name: string; role: 'member' | 'admin' | 'president' }
export function RoleManager({ client }: { client: SupabaseClient<Database> }) {
  const [members, setMembers] = useState<RoleMember[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  async function load() {
    const { data, error: queryError } = await client.from('members').select('id, first_name, last_name, role').order('last_name')
    if (queryError) setError('Les droits sont indisponibles.')
    else setMembers(data ?? [])
  }
  useEffect(() => { void load() }, [])
  async function change(member: RoleMember) {
    setBusy(member.id); setError('')
    const { error: updateError } = await client.rpc('set_member_role', { p_member_id: member.id, p_role: member.role === 'admin' ? 'member' : 'admin' })
    if (updateError) setError('Modification refusée. Actualisez vos droits et réessayez.')
    else await load()
    setBusy(null)
  }
  return <section className="card"><h2>Droits administrateur</h2><p>Le président peut accorder ou retirer les droits de gestion des fosses.</p>{error && <p role="alert">{error}</p>}
    <ul className="member-list">{members.filter(member => member.role !== 'president').map(member => <li key={member.id}><span>{member.first_name} {member.last_name}</span><button disabled={busy !== null} onClick={() => void change(member)}>{member.role === 'admin' ? 'Retirer les droits administrateur' : 'Accorder les droits administrateur'}</button></li>)}</ul>
  </section>
}
