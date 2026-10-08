import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import { caciLabels } from '../../lib/dates'
import type { CaciStatus } from '../../lib/dates'
import { selectionLabels, transportLabels, paymentLabels } from '../../lib/labels'

export type Readiness = Database['public']['Functions']['get_admin_readiness']['Returns'][number]
type Payment = Database['public']['Enums']['payment_state']
type Props = {
  compact?: boolean
  readiness?: Readiness
  client: SupabaseClient<Database>
  sessionId: string
  firstName: string
  lastName: string
  onSaved: () => Promise<void>
}

export function PaymentSummary({ readiness, client, sessionId, firstName, lastName, onSaved, compact = false }: Props) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (!readiness) return <p>Préparation en cours d’actualisation.</p>
  const memberId = readiness.member_id
  const count = [readiness.selection_ready, readiness.caci_ready, readiness.transport_ready, readiness.payment_ready].filter(Boolean).length
  const draft = readiness.selection_basis === 'draft'

  async function change(value: Payment) {
    setBusy(true)
    setMessage('')
    const result = await client.rpc('set_payment_status', { p_session_id: sessionId, p_member_id: memberId, p_status: value })
    if (result.error) setMessage('Paiement non enregistré. Vérifiez vos droits et actualisez la séance.')
    else setMessage('Paiement enregistré.')
    await onSaved()
    setBusy(false)
  }

  const details = <div className="readiness-details">
    <p className={`readiness-score ${count === 4 ? 'ready' : 'warning'}`}><strong>{count === 4 ? draft ? 'Brouillon prêt à publier' : 'Prêt pour la fosse' : `${count}/4 points prêts`}</strong></p>
    {!compact && <p>Base du récapitulatif : {draft ? 'brouillon privé, à publier' : 'sélection publiée'}.</p>}
    <ul className="readiness-points">
      <li data-ready={readiness.selection_ready}>Sélection : {readiness.selection_state === 'selected' ? draft ? 'Retenu dans le brouillon' : 'Confirmé dans la publication' : selectionLabels[readiness.selection_state]}</li>
      <li data-ready={readiness.caci_ready}>CACI au jour de la fosse : {caciLabels[readiness.caci_status as CaciStatus]}</li>
      <li data-ready={readiness.transport_ready}>Trajet : {transportLabels[readiness.transport_mode]}{readiness.transport_provisional && ' · Provisoire : conducteur non confirmé dans cette sélection'}</li>
      <li data-ready={readiness.payment_ready}>Paiement : {paymentLabels[readiness.payment_status]}</li>
    </ul>
    <label>Paiement de {firstName} {lastName}
      <select disabled={busy} value={readiness.payment_status} onChange={event => void change(event.target.value as Payment)}>
        {(['unpaid', 'paid', 'free'] as const).map(value => <option key={value} value={value}>{paymentLabels[value]}</option>)}
      </select>
    </label>
    {message && <p role="status">{message}</p>}
  </div>
  return <div className="readiness">{compact ? <><div className="readiness-indicators"><span className={`chip ${readiness.caci_status === 'valid' ? 'green' : 'amber'}`}>CACI {caciLabels[readiness.caci_status as CaciStatus]}</span><span className={`chip ${readiness.transport_ready && !readiness.transport_provisional ? 'green' : 'amber'}`}>{readiness.transport_provisional ? 'Trajet provisoire' : readiness.transport_ready ? 'Trajet organisé' : 'Trajet à organiser'}</span><span className={`chip ${readiness.payment_ready ? 'green' : 'amber'}`}>{paymentLabels[readiness.payment_status]}</span></div><details className="preparation-details"><summary>Détails et paiement de {firstName} {lastName}</summary>{details}</details></> : details}</div>
}
