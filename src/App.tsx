import { useCallback, useEffect, useState } from 'react'
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

import { allowedRoute, clearReturnPath, navigate as navigateRoute, NavigationPrompt, replaceNavigation, routePath, useRoute } from './lib/navigation'
import type { Route } from './lib/navigation'

type Area = 'sessions' | 'profile' | 'admin'
function MemberApp({ client, member, refresh }: { client: SupabaseClient<Database>; member: Member; refresh: () => Promise<void> }) {
  const requested = useRoute()
  const route = allowedRoute(requested, member.role !== 'member')
  const active = route.area
  const [lastSessionRoute, setLastSessionRoute] = useState<Route>({area:'sessions',tab:'overview',view:'upcoming'})
  useEffect(() => { if (routePath(route) !== window.location.pathname + window.location.search) navigateRoute(route, {replace:true,bypass:true,scroll:false}) }, [route.area,route.sessionId,route.tab,route.editing,route.view,route.season])
  useEffect(() => { if (route.area === 'sessions') setLastSessionRoute(route) }, [route.area,route.sessionId,route.tab,route.editing,route.view,route.season])
  function navigate(next:Area) { navigateRoute(next === 'sessions' ? allowedRoute(lastSessionRoute,member.role !== 'member') : {area:next,tab:'overview',view:'upcoming'}) }
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
      <div hidden={active !== 'sessions'}><Sessions client={client} member={member} refreshMember={refresh} route={active === 'sessions' ? route : allowedRoute(lastSessionRoute,member.role !== 'member')} onNavigate={navigateRoute} /></div>
      <div hidden={active !== 'profile'}><Profile client={client} member={member} refresh={refresh} /></div>
      {member.role !== 'member' && <div hidden={active !== 'admin'}><Directory client={client} member={member} refreshMember={refresh} /></div>}
      <footer className="app-footer">APSAP · Les fosses, simplement.</footer>
    </div>
  </div>
}

export default function App() {
  const client = supabase
  const resetNavigation = useCallback((previous:string|null,next:string|null) => { if(previous || next === null) { clearReturnPath(); replaceNavigation('/seances') } }, [])
  return <main className="shell">
    <header className="app-brand"><Brand /><p>Les fosses, simplement.</p></header>
    {client ? <AuthGate client={client} onOpenProfile={() => navigateRoute({area:'profile',tab:'overview',view:'upcoming'})} onIdentityChange={resetNavigation}>{(member, refresh) => <MemberApp client={client} member={member} refresh={refresh} />}</AuthGate> : <section className="card" aria-labelledby="welcome"><h1 id="welcome">Les séances du club APSAP</h1>
      <p>La nouvelle application partagée est en préparation.</p>
      <p role="status">{config ? 'Connexion au service configurée.' : 'Configuration locale à compléter.'}</p>
    </section>}
    <NavigationPrompt />
  </main>
}
