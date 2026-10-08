import { useUnsavedChanges } from '../../lib/navigation'
import { useState } from 'react'
import type { SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'

const messages: Record<string, string> = {
  EMAIL_EXISTS: 'Cette adresse email est déjà utilisée. Aucun compte existant n’a été modifié.',
  INVALID_MEMBER: 'Vérifiez le prénom, le nom et l’adresse email.',
  PRESIDENT_REQUIRED: 'Seul le président actuel peut ajouter un adhérent. Actualisez vos droits.',
  CREATION_INCOMPLETE: 'La liaison du profil a échoué. Réessayez avec ce formulaire ; si le problème persiste, contactez l’opérateur.',
}
export function MemberCreate({ client, onSaved, onCancel }: { client: SupabaseClient<Database>; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const guard = useUnsavedChanges(!!(first || last || email),()=>false,'member-create')
  const [requestId] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (![first, last].every(value => value.trim().length > 0 && value.trim().length <= 100 && ![...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(messages.INVALID_MEMBER); return }
    setBusy(true)
    try {
      const result = await client.functions.invoke('create-member', { body: { request_id: requestId, first_name: first.trim(), last_name: last.trim(), email: email.trim().toLowerCase() } })
      let code = result.data?.code as string | undefined
      if (result.error) {
        // Only the bounded public code from our handler is displayed. Never
        // surface raw provider responses, tokens or internal exception details.
        try { code = (await result.error.context?.json())?.code } catch { /* Network/gateway error. */ }
      }
      if (result.error || !result.data?.member_id) setError(messages[code ?? ''] || 'Ajout indisponible. Réessayez ; conservez ce formulaire pour reprendre la création.')
      else {guard.markClean();await onSaved()}
    } catch { setError('Ajout indisponible. Réessayez avec ce formulaire.') }
    finally { setBusy(false) }
  }
  return <form className="member-create" onChangeCapture={()=>setError('')} onSubmit={event => void save(event)} aria-labelledby="member-create-title"><h2 id="member-create-title">Ajouter un adhérent</h2><p>Le compte sera actif, avec le rôle Adhérent. Aucun email n’est envoyé ici : la personne demandera son lien de connexion habituel sur iFosse.</p><div className="grid"><label>Prénom<input required maxLength={100} value={first} onChange={event => setFirst(event.target.value)} autoComplete="given-name" autoFocus /></label><label>Nom<input required maxLength={100} value={last} onChange={event => setLast(event.target.value)} autoComplete="family-name" /></label></div><label>Email du nouvel adhérent<input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></label>{error && <p role="alert">{error}</p>}<div className="actions"><button type="submit" disabled={busy}>Créer l’adhérent</button><button type="button" disabled={busy} onClick={()=>guard.protect(()=>{guard.markClean();onCancel()})}>Annuler l’ajout</button></div></form>
}
