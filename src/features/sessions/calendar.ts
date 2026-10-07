import type { Session } from './SessionEditor'
import type { CardSummary } from './PublishedOccupancy'
import { paymentLabels, rsvpLabels, selectionLabels, transportLabels } from '../../lib/labels'
export type CalendarFilter = 'upcoming' | 'past' | 'all'
export function calendarSessions(sessions: Session[], filter: CalendarFilter, today: string) {
  return sessions.filter(row => filter === 'all' || (filter === 'upcoming' ? row.date >= today : row.date < today))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time) || a.id.localeCompare(b.id))
}
export function nextSession(sessions: Session[], today: string) {
  return calendarSessions(sessions, 'upcoming', today).find(row => row.status !== 'closed')?.id
}
export function validSummary(row: CardSummary) {
  return Object.hasOwn(rsvpLabels, row.my_rsvp) && Object.hasOwn(selectionLabels, row.my_selection_state) && Object.hasOwn(transportLabels, row.my_transport_mode) && typeof row.my_transport_provisional === 'boolean' && (row.my_payment_status === null || Object.hasOwn(paymentLabels, row.my_payment_status))
}
export function calendarAction(session: Session, summary: CardSummary) {
  if (session.status === 'closed') return { label: 'Voir la séance', tab: 'overview' as const }
  if (summary.my_rsvp === 'unanswered' && session.registration_open) return { label: 'Voir / répondre', tab: 'overview' as const }
  if (summary.my_rsvp === 'yes' && summary.my_selection_state !== 'declined' && (summary.my_transport_provisional || ['unset', 'needs'].includes(summary.my_transport_mode))) return { label: 'Organiser mon trajet', tab: 'transport' as const }
  return { label: 'Voir la séance', tab: 'overview' as const }
}
