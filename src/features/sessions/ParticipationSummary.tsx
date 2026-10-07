import type { CardSummary } from './PublishedOccupancy'
import type { Session } from './SessionEditor'
import { calendarAction } from './calendar'
import { caciLabels } from '../../lib/dates'
import { paymentLabels, rsvpLabels, selectionLabels, transportLabels } from '../../lib/labels'

export function participationExplanation(summary: CardSummary) {
  if (!summary.publication_version) return summary.my_rsvp === 'unanswered'
    ? 'Vous n’avez pas encore répondu. La sélection n’est pas encore publiée.'
    : 'Votre réponse est enregistrée. La sélection n’est pas encore publiée.'
  switch (summary.my_selection_state) {
    case 'selected': return 'Votre place est confirmée dans la sélection publiée.'
    case 'waiting': return 'Vous êtes en attente dans la sélection publiée. Votre place n’est pas confirmée.'
    case 'declined': return 'Vous n’êtes pas retenu dans la sélection publiée.'
    case 'withdrawn': return 'Vous vous êtes désisté. Un nouveau Oui nécessitera une nouvelle sélection publiée.'
    default: return 'Vous n’avez pas de place confirmée dans la sélection publiée.'
  }
}

export function ParticipationSummary({ summary, stale, caci, session, detailed, onTransport, onRetry }: {
  summary: CardSummary | null; stale: boolean; caci: keyof typeof caciLabels; session: Session;
  detailed: boolean; onTransport: () => void; onRetry: () => void;
}) {
  return <section className={`participation-summary ${detailed ? 'detailed' : 'compact'}`} aria-label="Ma situation pour cette séance">
    {!summary ? <p>{stale ? 'Ma situation est indisponible.' : 'Chargement de ma situation…'}</p> : <>
      <p className="personal-place">Ma place : <strong className={`chip ${summary.publication_version && summary.my_selection_state === 'selected' ? 'green' : summary.my_selection_state === 'withdrawn' || summary.my_selection_state === 'declined' ? 'red' : 'amber'}`}>{summary.publication_version ? selectionLabels[summary.my_selection_state] : 'En attente de publication'}</strong></p>
      {detailed && <p className="participation-explanation">{participationExplanation(summary)}</p>}
      {!detailed && <details className="compact-facts"><summary>Ma réponse et mon trajet</summary><p>Ma réponse : <strong>{rsvpLabels[summary.my_rsvp]}</strong></p><p>Mon trajet : <strong>{transportLabels[summary.my_transport_mode]}</strong></p>{summary.my_transport_provisional && <span className="chip amber">Provisoire · conducteur non confirmé</span>}</details>}
      {detailed && <div className="participation-facts">
        {detailed ? <h3>Ma réponse : {rsvpLabels[summary.my_rsvp]}</h3> : <p>Ma réponse : <strong>{rsvpLabels[summary.my_rsvp]}</strong></p>}
        <div><p>Mon trajet : <strong>{transportLabels[summary.my_transport_mode]}</strong></p>{summary.my_transport_provisional && <span className="chip amber">Provisoire · conducteur non confirmé</span>}</div>
        {detailed && <><p>Mon paiement : <strong>{summary.my_payment_status === null ? 'Non concerné' : paymentLabels[summary.my_payment_status]}</strong></p><p>Mon CACI au jour de la fosse : <strong>{caciLabels[caci]}</strong>.</p></>}
      </div>}
      {detailed && calendarAction(session, summary).tab === 'transport' && <button onClick={onTransport}>Organiser mon trajet</button>}
      {detailed && summary.my_rsvp === 'unanswered' && session.status !== 'closed' && session.registration_open && <p>Choisissez votre réponse ci-dessous. Dire Oui ne confirme pas votre place.</p>}
    </>}
    {stale && <p role="alert">Actualisation de ma situation impossible.{summary && ' Les dernières données reçues sont conservées.'} <button onClick={onRetry}>Réessayer</button></p>}
  </section>
}
