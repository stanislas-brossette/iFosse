import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import { caciLabels } from '../../lib/dates'
import type { CaciStatus } from '../../lib/dates'
import { selectionLabels, transportLabels, paymentLabels } from '../../lib/labels'

export type Readiness = Database['public']['Functions']['get_admin_readiness']['Returns'][number]
type Payment = Database['public']['Enums']['payment_state']
type Props = {
  readiness?: Readiness
  client: SupabaseClient<Database>
  sessionId: string
  firstName: string
  lastName: string
  onSaved: () => Promise<void>
}

export function PaymentSummary({ readiness, client, sessionId, firstName, lastName, onSaved }: Props) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (!readiness) return <p>Préparation en cours d’actualisation.</p>
  const memberId = readiness.member_id
  const count = [readiness.selection_ready, readiness.caci_ready, readiness.transport_ready, readiness.payment_ready].filter(Boolean).length

  async function change(value: Payment) {
    setBusy(true)
    setMessage('')
    const result = await client.rpc('set_payment_status', { p_session_id: sessionId, p_member_id: memberId, p_status: value })
    if (result.error) setMessage('Paiement non enregistré. Vérifiez vos droits et actualisez la séance.')
    else setMessage('Paiement enregistré.')
    await onSaved()
    setBusy(false)
  }

  return <div className="readiness">
    <p><strong>{count === 4 ? 'Prêt pour la fosse' : `${count}/4 points prêts`}</strong></p>
    <ul className="readiness-points">
      <li>Sélection : {selectionLabels[readiness.selection_state]}</li>
      <li>CACI au jour de la fosse : {caciLabels[readiness.caci_status as CaciStatus]}</li>
      <li>Trajet : {transportLabels[readiness.transport_mode]}</li>
      <li>Paiement : {paymentLabels[readiness.payment_status]}</li>
    </ul>
    <label>Paiement de {firstName} {lastName}
      <select disabled={busy} value={readiness.payment_status} onChange={event => void change(event.target.value as Payment)}>
        {(['unpaid', 'paid', 'free'] as const).map(value => <option key={value} value={value}>{paymentLabels[value]}</option>)}
      </select>
    </label>
    {message && <p role="status">{message}</p>}
  </div>
}
