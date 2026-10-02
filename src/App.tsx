import { readPublicConfig } from './lib/config'

export default function App() {
  const config = readPublicConfig(import.meta.env)
  return <main className="shell">
    <header><span className="brand">iFosse</span><p>Les fosses, simplement.</p></header>
    <section className="card" aria-labelledby="welcome"><h1 id="welcome">Les séances du club APSAP</h1>
      <p>La nouvelle application partagée est en préparation.</p>
      <p role="status">{config ? 'Connexion au service configurée.' : 'Configuration locale à compléter.'}</p>
    </section>
  </main>
}
