import { readPublicConfig } from './lib/config'
import { supabase } from './lib/supabase'
import { AuthGate } from './features/auth/AuthGate'
import { RoleManager } from './features/auth/RoleManager'

export default function App() {
  const config = readPublicConfig(import.meta.env)
  const client = supabase
  return <main className="shell">
    <header><span className="brand">iFosse</span><p>Les fosses, simplement.</p></header>
    {client ? <AuthGate client={client}>{member => <>
      <section className="card"><h1>Bonjour {member.first_name}</h1><p>Bienvenue dans l’application partagée du club APSAP.</p></section>
      {member.role === 'president' && <RoleManager client={client} />}
    </>}</AuthGate> : <section className="card" aria-labelledby="welcome"><h1 id="welcome">Les séances du club APSAP</h1>
      <p>La nouvelle application partagée est en préparation.</p>
      <p role="status">{config ? 'Connexion au service configurée.' : 'Configuration locale à compléter.'}</p>
    </section>}
  </main>
}
