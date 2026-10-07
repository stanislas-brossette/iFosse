import type { CardSummary } from './PublishedOccupancy'
import { paymentLabels, rsvpLabels, selectionLabels, transportLabels } from '../../lib/labels'
export function PersonalStatus({ summary }: { summary: CardSummary }) {
  return <dl className="personal-status" aria-label="Mes statuts pour cette séance">
    <div><dt>Ma réponse</dt><dd>{rsvpLabels[summary.my_rsvp]}</dd></div>
    <div><dt>Ma sélection</dt><dd>{summary.publication_version ? selectionLabels[summary.my_selection_state] : 'Sélection non publiée'}</dd></div>
    <div><dt>Mon trajet</dt><dd>{transportLabels[summary.my_transport_mode]}{summary.my_transport_provisional && <span className="chip amber">Provisoire · conducteur non confirmé</span>}</dd></div>
    <div><dt>Mon paiement</dt><dd>{summary.my_payment_status === null ? 'Non concerné' : paymentLabels[summary.my_payment_status]}</dd></div>
  </dl>
}
