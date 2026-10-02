import { useCallback, useEffect, useState } from 'react'
import type { ReactNode, SubmitEvent } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../../lib/database.types'
import { readLoginCallback } from './callback'

export type Member = Tables<'members'>
type Props = { client: SupabaseClient<Database>; children: (member: Member, refresh: () => Promise<void>) => ReactNode }
const invalidLink = 'Ce lien est expiré ou a déjà été utilisé. Demandez un nouveau lien.'

export function AuthGate({ client, children }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [callback, setCallback] = useState(() => readLoginCallback(window.location.pathname, window.location.hash))
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (callback) window.history.replaceState(null, '', '/auth/confirm')
  }, [callback])

  useEffect(() => {
    let active = true
    client.auth.getSession().then(({ data, error: authError }) => {
      if (active) { setSession(data.session); setLoading(false); if (authError) setError('La connexion doit être renouvelée.') }
    }).catch(() => { if (active) { setLoading(false); setError('Connexion au service impossible. Réessayez.') } })
    // Avoid awaiting data queries inside the Auth SDK's session lock.
    const { data } = client.auth.onAuthStateChange((_event, next) => { if (active) setSession(next) })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [client])

  const refresh = useCallback(async () => {
    if (!session) return
    const { data, error: queryError } = await client.from('members').select('*').eq('auth_user_id', session.user.id).maybeSingle()
    if (queryError) { setError('Le profil est indisponible. Réessayez.'); return }
    setMember(data)
  }, [client, session])

  useEffect(() => {
    let active = true
    setMember(null)
    if (!session) { setProfileLoading(false); return }
    setProfileLoading(true)
    client.from('members').select('*').eq('auth_user_id', session.user.id).maybeSingle().then(({ data, error: queryError }) => {
      if (active) { setMember(data); setProfileLoading(false); if (queryError) setError('Le profil est indisponible. Réessayez.') }
    })
    return () => { active = false }
  }, [client, session])

  useEffect(() => {
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  async function requestLink(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const { error: requestError } = await client.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/confirm` } })
      if (requestError?.status === 429) setError('Patientez une minute avant de demander un nouveau lien.')
      else if (requestError && (requestError.status ?? 0) >= 500) setError('Connexion au service impossible. Réessayez.')
      else setMessage('Si cette adresse est connue du club, vous recevrez un lien de connexion. Vérifiez aussi les courriers indésirables.')
    } catch { setError('Connexion au service impossible. Réessayez.') } finally { setBusy(false) }
  }

  async function confirmLink() {
    if (!callback || !('tokenHash' in callback)) return
    setBusy(true); setError('')
    try {
      const { error: verifyError } = await client.auth.verifyOtp({ token_hash: callback.tokenHash, type: 'email' })
      setCallback(null); window.history.replaceState(null, '', '/')
      if (verifyError) setError(invalidLink)
    } catch { setError('Connexion au service impossible. Réessayez.') } finally { setBusy(false) }
  }

  async function logout() {
    setBusy(true); setError('')
    try {
      const { error: signOutError } = await client.auth.signOut({ scope: 'local' })
      if (signOutError) setError('La déconnexion a échoué. Réessayez.')
      else { setMember(null); setSession(null); setMessage('Vous êtes déconnecté.'); setCallback(null); window.history.replaceState(null, '', '/') }
    } catch { setError('La déconnexion a échoué. Réessayez.') } finally { setBusy(false) }
  }

  if (loading) return <p role="status">Connexion en cours…</p>
  if (callback && 'tokenHash' in callback) return <section className="card"><h1>Confirmer la connexion</h1><p>Connectez-vous sur cet appareil avec le lien reçu par email.</p>{error && <p role="alert">{error}</p>}<button disabled={busy} onClick={() => void confirmLink()}>Se connecter</button></section>
  if (session) return <>
    <div className="toolbar"><p>{member ? `${member.first_name} ${member.last_name}` : 'Compte connecté'}</p><button disabled={busy} onClick={() => void logout()}>Se déconnecter</button></div>
    {error && <p role="alert">{error}</p>}
    {member ? children(member, refresh) : profileLoading ? <p role="status">Chargement du profil…</p> : <section className="card"><h1>Profil indisponible</h1><p>Votre compte doit être lié à un adhérent du club. Contactez un administrateur si le problème persiste.</p><button onClick={() => void refresh()}>Réessayer</button></section>}
  </>
  return <section className="card login"><h1>Connexion à iFosse</h1><p>Utilisez l’adresse email connue du club. Vous recevrez un lien valable dix minutes, sans mot de passe.</p>
    {(error || callback) && <p role="alert">{error || invalidLink}</p>}
    {message && <p role="status">{message}</p>}
    <form onSubmit={event => void requestLink(event)}><label>Adresse email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><button disabled={busy} type="submit">Recevoir un lien de connexion</button></form>
  </section>
}
