import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode, SubmitEvent } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../../lib/database.types'
import { readLoginCallback } from './callback'

export type Member = Tables<'members'>
type Props = { client: SupabaseClient<Database>; children: (member: Member, refresh: () => Promise<void>) => ReactNode; onOpenProfile?: (member: Member) => void; onIdentityChange?: () => void }
const invalidLink = 'Ce lien est expiré ou a déjà été utilisé. Demandez un nouveau lien.'

export function AuthGate({ client, children, onOpenProfile, onIdentityChange }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [callback, setCallback] = useState(() => readLoginCallback(window.location.pathname, window.location.hash))
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const logoutDialog = useRef<HTMLDialogElement>(null)
  const logoutButton = useRef<HTMLButtonElement>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const identity = useRef({ id: null as string | null, generation: 0 })
  const profileSequence = useRef(0)

  useEffect(() => {
    if (callback) window.history.replaceState(null, '', '/auth/confirm')
  }, [callback])

  useEffect(() => {
    let active = true
    let authEvents = 0
    function acceptSession(next: Session | null) {
      const id = next?.user.id ?? null
      if (id !== identity.current.id) {
        identity.current = { id, generation: identity.current.generation + 1 }
        setConfirmLogout(false)
        onIdentityChange?.()
        setMember(null)
        setError('')
      }
      setSession(next); setLoading(false)
    }
    client.auth.getSession().then(({ data, error: authError }) => {
      // A late initial read must not overwrite a newer sign-in/sign-out event.
      if (active && !authEvents) { acceptSession(data.session); if (authError) setError('La connexion doit être renouvelée.') }
    }).catch(() => { if (active && !authEvents) { setLoading(false); setError('Connexion au service impossible. Réessayez.') } })
    // Avoid awaiting data queries inside the Auth SDK's session lock.
    const { data } = client.auth.onAuthStateChange((_event, next) => { if (active) { authEvents++; acceptSession(next) } })
    return () => { active = false; identity.current.generation++; data.subscription.unsubscribe() }
  }, [client, onIdentityChange])

  useEffect(() => {
    if (confirmLogout && session) {
      if (!logoutDialog.current?.open) logoutDialog.current?.showModal()
    } else if (logoutDialog.current?.open) {
      logoutDialog.current.close()
      logoutButton.current?.focus()
    }
  }, [confirmLogout, session])

  function cancelLogout() {
    setConfirmLogout(false)
  }

  function trapLogoutFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
    const first = buttons[0], last = buttons[buttons.length - 1]
    if (!first) { event.preventDefault(); return }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  const userId = session?.user.id
  const refresh = useCallback(async () => {
    if (!userId || identity.current.id !== userId) return
    const generation = identity.current.generation
    const request = ++profileSequence.current
    const current = () => identity.current.id === userId && identity.current.generation === generation && profileSequence.current === request
    setProfileLoading(true)
    try {
      const { data, error: queryError } = await client.from('members').select('*').eq('auth_user_id', userId).maybeSingle()
      if (!current()) return
      if (queryError) {
        setError('Le profil est indisponible. Réessayez.')
        if (['401', '403', 'PGRST301', 'PGRST302'].includes(queryError.code)) setMember(null)
      } else { setMember(data?.disabled_at ? null : data); setError('') }
    } catch { if (current()) setError('Le profil est indisponible. Réessayez.') }
    finally { if (current()) setProfileLoading(false) }
  }, [client, userId])

  useEffect(() => {
    if (!session) { setProfileLoading(false); return }
    // Renewed tokens recheck access without unmounting the same member's forms.
    void refresh()
  }, [session, refresh])

  useEffect(() => {
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 5000)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus) }
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
      else { setConfirmLogout(false); onIdentityChange?.(); setMember(null); setSession(null); setMessage('Vous êtes déconnecté.'); setCallback(null); window.history.replaceState(null, '', '/') }
    } catch { setError('La déconnexion a échoué. Réessayez.') } finally { setBusy(false) }
  }

  const identityContent = <><span className="avatar" aria-hidden="true">{member ? `${member.first_name.slice(0, 1)}${member.last_name.slice(0, 1)}` : '…'}</span><span><strong>{member ? `${member.first_name} ${member.last_name}` : 'Compte connecté'}</strong>{member && <span className="identity-role">{{ member: 'Adhérent', admin: 'Administrateur', president: 'Président' }[member.role]}</span>}</span></>

  if (loading) return <p role="status">Connexion en cours…</p>
  if (callback && 'tokenHash' in callback) return <section className="card login"><p className="eyebrow">Votre espace APSAP</p><h1>Confirmer la connexion</h1><p>Connectez-vous sur cet appareil avec le lien reçu par email.</p>{error && <p role="alert">{error}</p>}<button disabled={busy} onClick={() => void confirmLink()}>Se connecter</button></section>
  if (session) return <>
    <div className="toolbar auth-toolbar"><span className="topbar-caption">APSAP / Espace adhérent</span>{member && member.auth_user_id === session.user.id && onOpenProfile ? <button type="button" className="identity identity-link" aria-label="Ouvrir mon profil" onClick={() => onOpenProfile(member)}>{identityContent}</button> : <div className="identity">{identityContent}</div>}<button ref={logoutButton} disabled={busy} onClick={() => setConfirmLogout(true)}>Se déconnecter</button></div>
    <dialog ref={logoutDialog} onKeyDown={trapLogoutFocus} aria-labelledby="logout-title" aria-describedby="logout-description" onCancel={event => { event.preventDefault(); if (!busy) cancelLogout() }} onClose={() => setConfirmLogout(false)}>
      <h2 id="logout-title">Se déconnecter ?</h2>
      <p id="logout-description">Pour revenir sur iFosse, vous devrez demander un nouveau lien de connexion.</p>
      {error && <p role="alert">{error}</p>}
      <div className="actions"><button autoFocus disabled={busy} onClick={cancelLogout}>Annuler</button><button className="danger" disabled={busy} onClick={() => void logout()}>Se déconnecter</button></div>
    </dialog>
    {error && !confirmLogout && <p role="alert">{error}</p>}
    {member && member.auth_user_id === session.user.id ? <Fragment key={member.auth_user_id}>{children(member, refresh)}</Fragment> : profileLoading ? <p role="status">Chargement du profil…</p> : <section className="card"><h1>Profil indisponible</h1><p>Votre accès doit être actif et lié à un adhérent du club. Contactez le président si votre compte a été désactivé.</p><button onClick={() => void refresh()}>Réessayer</button></section>}
  </>
  return <section className="card login"><p className="eyebrow">Bienvenue au club</p><h1>Connexion à iFosse</h1><p>Utilisez l’adresse email connue du club. Vous recevrez un lien valable dix minutes, sans mot de passe.</p>
    {(error || callback) && <p role="alert">{error || invalidLink}</p>}
    {message && <p role="status">{message}</p>}
    <form onSubmit={event => void requestLink(event)}><label>Adresse email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><button disabled={busy} type="submit">Recevoir un lien de connexion</button></form>
  </section>
}
