import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './lib/database.types'
import type { Member } from './features/auth/AuthGate'
import { publicConfig as config } from './lib/publicConfig'
import { supabase } from './lib/supabase'
import { AuthGate } from './features/auth/AuthGate'
import { RoleManager } from './features/auth/RoleManager'
import { Profile } from './features/profiles/Profile'
import { Directory } from './features/profiles/Directory'
import { Sessions } from './features/sessions/Sessions'

function MemberApp({ client, member, refresh }: { client: SupabaseClient<Database>; member: Member; refresh: () => Promise<void> }) {
  const [area, setArea] = useState<'sessions' | 'profile' | 'admin'>('sessions')
  const active = area === 'admin' && member.role === 'member' ? 'sessions' : area
  return <>
    <section className="card"><h1>Bonjour {member.first_name}</h1><p>Bienvenue dans l’application partagée du club APSAP.</p><nav className="actions" aria-label="Navigation principale">
      <button aria-current={active === 'sessions' ? 'page' : undefined} onClick={() => setArea('sessions')}>Séances</button>
      <button aria-current={active === 'profile' ? 'page' : undefined} onClick={() => setArea('profile')}>Mon profil</button>
      {member.role !== 'member' && <button aria-current={active === 'admin' ? 'page' : undefined} onClick={() => setArea('admin')}>Administration</button>}
    </nav></section>
    <div hidden={active !== 'sessions'}><Sessions client={client} member={member} refreshMember={refresh} /></div>
    <div hidden={active !== 'profile'}><Profile client={client} member={member} refresh={refresh} /></div>
    {member.role !== 'member' && <div hidden={active !== 'admin'}>{member.role === 'president' && <RoleManager client={client} />}<Directory client={client} /></div>}
  </>
}

export default function App() {
  const client = supabase
  return <main className="shell">
    <header><span className="brand">iFosse</span><p>Les fosses, simplement.</p></header>
    {client ? <AuthGate client={client}>{(member, refresh) => <MemberApp client={client} member={member} refresh={refresh} />}</AuthGate> : <section className="card" aria-labelledby="welcome"><h1 id="welcome">Les séances du club APSAP</h1>
      <p>La nouvelle application partagée est en préparation.</p>
      <p role="status">{config ? 'Connexion au service configurée.' : 'Configuration locale à compléter.'}</p>
    </section>}
  </main>
}
