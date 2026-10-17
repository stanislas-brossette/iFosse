import { useRef, useState, useSyncExternalStore } from 'react'
import type { SubmitEvent } from 'react'
import { installController } from './install'
import { readSameOriginLoginLink } from '../auth/callback'

// Optional installed-app fallback: no automatic clipboard read, navigation to
// supplied URLs, token persistence or new authentication method.
export function StandaloneLoginLink({ onLink, disabled = false }: { onLink: (tokenHash: string) => void; disabled?: boolean }) {
  const state = useSyncExternalStore(installController.subscribe, installController.getSnapshot, installController.getSnapshot)
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState(false)
  if (!state.standalone) return null
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled) return
    const value = input.current?.value ?? ''
    if (input.current) input.current.value = ''
    const callback = readSameOriginLoginLink(value, window.location.origin)
    if (!callback || !('tokenHash' in callback)) { setError(true); return }
    setError(false)
    onLink(callback.tokenHash)
  }
  return <details className="installed-login-help mt"><summary>Le lien ouvre mon navigateur au lieu d’iFosse</summary>
    <p>Dans votre email, copiez le lien du bouton « Se connecter à iFosse » sans l’ouvrir. Revenez dans cette application et collez-le ici. Ne partagez ce lien avec personne.</p>
    <form onSubmit={submit}>
      <label>Lien de connexion reçu par email<input ref={input} disabled={disabled} type="password" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={2048} required aria-invalid={error || undefined} aria-describedby={error ? 'installed-link-error' : undefined} onChange={() => setError(false)} /></label>
      <button type="submit" disabled={disabled}>Vérifier mon lien</button>
      {error && <p id="installed-link-error" role="alert">Ce lien ne correspond pas à cette application. Copiez le lien de connexion complet reçu pour cette adresse iFosse.</p>}
    </form>
  </details>
}
