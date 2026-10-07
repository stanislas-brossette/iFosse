import { useCallback, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './lib/database.types'
import type { Member } from './features/auth/AuthGate'
import { publicConfig as config } from './lib/publicConfig'
import { supabase } from './lib/supabase'
import { AuthGate } from './features/auth/AuthGate'
import { Profile } from './features/profiles/Profile'
import { Directory } from './features/profiles/Directory'
import { Sessions } from './features/sessions/Sessions'
import { Brand, Icon } from './components/Visual'
import { seasonOf, todayParis } from './lib/dates'

type Area = 'sessions' | 'profile' | 'admin'
function MemberApp({ client, member, refresh, area, navigate }: { client: SupabaseClient<Database>; member: Member; refresh: () => Promise<void>; area: Area; navigate: (next: Area) => void }) {
  const active = area === 'admin' && member.role === 'member' ? 'sessions' : area
  return <div className="app-layout">
    <aside className="sidebar"><Brand /><p className="club-label">APSAP · Plongée</p><p className="nav-label">Votre club</p>
      <nav className="main-navigation" aria-label="Navigation principale">
        <button aria-current={active === 'sessions' ? 'page' : undefined} onClick={() => navigate('sessions')}><Icon name="calendar" /><span>Séances</span></button>
        <button aria-current={active === 'profile' ? 'page' : undefined} onClick={() => navigate('profile')}><Icon name="profile" /><span>Mon profil</span></button>
        {member.role !== 'member' && <button aria-current={active === 'admin' ? 'page' : undefined} onClick={() => navigate('admin')}><Icon name="users" /><span>Administration</span></button>}
      </nav>
      <div className="sidebar-bottom"><p className="eyebrow">La saison du club</p><strong>{seasonOf(todayParis())}–{seasonOf(todayParis()) + 1}</strong><p>De septembre à août</p></div>
    </aside>
    <div className="app-content">
      <div hidden={active !== 'sessions'}><Sessions client={client} member={member} refreshMember={refresh} /></div>
      <div hidden={active !== 'profile'}><Profile client={client} member={member} refresh={refresh} /></div>
      {member.role !== 'member' && <div hidden={active !== 'admin'}><Directory client={client} member={member} /></div>}
      <footer className="app-footer">APSAP · Les fosses, simplement.</footer>
    </div>
  </div>
}

export default function App() {
  const client = supabase
  const [navigation, setNavigation] = useState<{ memberId: string; area: Area } | null>(null)
  const resetNavigation = useCallback(() => setNavigation(null), [])
  function navigate(memberId: string, area: Area) { setNavigation({ memberId, area }); window.scrollTo({ top: 0 }) }
  return <main className="shell">
    <header className="app-brand"><Brand /><p>Les fosses, simplement.</p></header>
    {client ? <AuthGate client={client} onOpenProfile={member => navigate(member.id, 'profile')} onIdentityChange={resetNavigation}>{(member, refresh) => <MemberApp client={client} member={member} refresh={refresh} area={navigation?.memberId === member.id ? navigation.area : 'sessions'} navigate={next => navigate(member.id, next)} />}</AuthGate> : <section className="card" aria-labelledby="welcome"><h1 id="welcome">Les séances du club APSAP</h1>
      <p>La nouvelle application partagée est en préparation.</p>
      <p role="status">{config ? 'Connexion au service configurée.' : 'Configuration locale à compléter.'}</p>
    </section>}
  </main>
}
