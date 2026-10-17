import { useSyncExternalStore } from 'react'
import { installController } from './install'
import type { InstallController } from './install'

export function InstallApp({ controller = installController }: { controller?: InstallController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  if (state.installed || state.standalone || (!state.available && !state.iosSafari && !state.busy && !state.message)) return null
  return <section className="install-app mt" aria-labelledby="install-app-title">
    <h2 id="install-app-title">iFosse sur mon téléphone</h2>
    <p>Retrouvez iFosse depuis son icône, sans passer par un magasin d’applications. Une connexion Internet reste nécessaire.</p>
    {(state.available || state.busy) && <button type="button" disabled={state.busy} onClick={() => void controller.install()}>{state.busy ? 'Installation en cours…' : 'Installer iFosse'}</button>}
    {state.iosSafari && <p>Dans Safari : <strong>Partager → Sur l’écran d’accueil</strong>. Activez « Ouvrir comme app web » si cette option est proposée.</p>}
    {state.message && <p role="status">{state.message}</p>}
  </section>
}
