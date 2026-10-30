import { useEffect, useId, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { businessError } from '../../lib/businessErrors'
import { levelSuggestions } from '../../lib/levels'
import { useUnsavedChanges } from '../../lib/navigation'

const fields = [['first_name', 'Prénom', 100], ['last_name', 'Nom', 100], ['phone', 'Téléphone', 40], ['current_level', 'Niveau actuel', 40], ['preparing_level', 'Niveau préparé', 40]] as const
function profileValues(member: Member) {
  return { first_name: member.first_name, last_name: member.last_name, phone: member.phone ?? '', current_level: member.current_level, preparing_level: member.preparing_level ?? '' }
}

export function MemberProfileEditor({ client, member, onRefresh }: { client: SupabaseClient<Database>; member: Member; onRefresh: () => Promise<void> }) {
  const [values, setValues] = useState(() => profileValues(member))
  const original = useRef(member)
  const dirty = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [invalidNames, setInvalidNames] = useState<string[]>([])
  const id = useId()
  const guard = useUnsavedChanges(JSON.stringify(values) !== JSON.stringify(profileValues(original.current)), next => next.area !== 'admin', `member-profile:${member.id}`)
  useEffect(() => {
    if (!dirty.current) { original.current = member; setValues(profileValues(member)) }
  }, [member])
  const stale = conflict || original.current.updated_at !== member.updated_at
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || stale) return
    const invalid = ['first_name', 'last_name'].filter(key => !values[key as 'first_name' | 'last_name'].trim())
    setInvalidNames(invalid)
    if (invalid.length) { setFailed(true); setMessage('Renseignez le prénom et le nom.'); return }
    setBusy(true); setMessage('')
    try {
      const { error } = await client.rpc('update_member_profile_if_current', {
        p_member_id: member.id, p_expected_updated_at: original.current.updated_at,
        p_first_name: values.first_name, p_last_name: values.last_name, p_phone: values.phone,
        p_current_level: values.current_level, p_preparing_level: values.preparing_level,
      })
      setFailed(!!error)
      if (error?.code === '40001') {
        setConflict(true); setMessage('Le profil a été modifié ailleurs. Rechargez le profil enregistré avant de réessayer.'); await onRefresh()
      } else if (error) setMessage(businessError(error, 'Modification du profil refusée. Vérifiez vos droits et les champs.'))
      else { dirty.current = false; guard.markClean(); original.current = { ...member, ...values }; setMessage('Profil enregistré.'); await onRefresh() }
    } catch { setFailed(true); setMessage('Enregistrement indisponible. Réessayez après actualisation.'); setConflict(true) }
    finally { setBusy(false) }
  }
  return <form aria-label={`Profil de ${member.first_name} ${member.last_name}`} onSubmit={event => void save(event)}>
    <h3>Modifier le profil de {member.first_name} {member.last_name}</h3>
    <fieldset disabled={busy}><div className="form-grid">{fields.map(([key, label, max]) => <label key={key}>{label}<input
      type={key === 'phone' ? 'tel' : 'text'} maxLength={max} required={key === 'first_name' || key === 'last_name'}
      list={key === 'current_level' || key === 'preparing_level' ? `${id}-levels` : undefined}
      aria-invalid={invalidNames.includes(key) || undefined} aria-describedby={invalidNames.includes(key) ? `${id}-message` : undefined}
      value={values[key]} onChange={event => { dirty.current = true; setMessage(''); setInvalidNames([]); setValues({ ...values, [key]: event.target.value }) }}
    /></label>)}</div></fieldset>
    <datalist id={`${id}-levels`}>{levelSuggestions.map(level => <option key={level} value={level} />)}</datalist>
    <p className="muted">Niveaux proposés à titre indicatif : vous pouvez saisir un autre libellé.</p>
    {stale && <p role="alert">Le profil enregistré a changé. Votre saisie est conservée ; rechargez les informations avant de poursuivre.</p>}
    <div className="actions"><button disabled={busy || stale}>Enregistrer le profil</button>{stale && <button type="button" disabled={busy} onClick={() => { original.current = member; dirty.current = false; guard.markClean(); setValues(profileValues(member)); setConflict(false); setMessage(''); setInvalidNames([]) }}>Recharger le profil enregistré</button>}</div>
    {message && <p id={`${id}-message`} role={failed ? 'alert' : 'status'}>{message}</p>}
  </form>
}
