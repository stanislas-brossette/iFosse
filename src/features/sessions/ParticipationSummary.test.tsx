import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { CardSummary } from './PublishedOccupancy'
import type { Session } from './SessionEditor'
import { ParticipationSummary, participationExplanation } from './ParticipationSummary'
afterEach(cleanup)
const summary: CardSummary = { session_id: 'session', capacity: 20, confirmed_count: 20, publication_version: 1, my_rsvp: 'yes', my_selection_state: 'selected', my_transport_mode: 'needs', my_transport_provisional: false, my_payment_status: 'paid' }
const session = { id: 'session', status: 'open', registration_open: true } as Session
function setup(value: CardSummary | null = summary, detailed = true, stale = false) {
  const onTransport = vi.fn(); const onRetry = vi.fn()
  render(<ParticipationSummary summary={value} detailed={detailed} stale={stale} caci="expired" session={session} onTransport={onTransport} onRetry={onRetry} />)
  return { onTransport, onRetry }
}
it('places published selection before intention, transport and own private information', () => {
  setup()
  const text = screen.getByRole('region').textContent!
  expect(text.indexOf('Ma place')).toBeLessThan(text.indexOf('Ma réponse'))
  expect(text.indexOf('Ma réponse')).toBeLessThan(text.indexOf('Mon trajet'))
  expect(text.indexOf('Mon trajet')).toBeLessThan(text.indexOf('Mon paiement'))
  expect(text.indexOf('Mon paiement')).toBeLessThan(text.indexOf('Mon CACI'))
  expect(screen.getByText('Votre place est confirmée dans la sélection publiée.')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Ma réponse : Oui' })).toBeTruthy()
})
it.each(['yes', 'maybe', 'no', 'unanswered'] as const)('does not confuse %s with confirmation before publication', rsvp => {
  setup({ ...summary, publication_version: 0, my_selection_state: 'pending', my_rsvp: rsvp })
  expect(screen.queryByText('Votre place est confirmée dans la sélection publiée.')).toBeNull()
  expect(screen.getByText(rsvp === 'unanswered' ? 'Vous n’avez pas encore répondu. La sélection n’est pas encore publiée.' : 'Votre réponse est enregistrée. La sélection n’est pas encore publiée.')).toBeTruthy()
})
it.each([
  ['waiting', 'Vous êtes en attente'], ['declined', 'Vous n’êtes pas retenu'],
  ['withdrawn', 'Un nouveau Oui nécessitera'], ['none', 'Vous n’avez pas de place confirmée'],
])('explains effective status %s', (state, expected) => {
  expect(participationExplanation({ ...summary, my_selection_state: state })).toContain(expected)
})
it('keeps other tabs compact without payment/CACI or publication-version preambles', () => {
  setup({ ...summary, my_transport_mode: 'passenger', my_transport_provisional: true }, false)
  expect(screen.getByText('Provisoire · conducteur non confirmé')).toBeTruthy()
  expect(screen.getByText('Passager').closest('p')?.textContent).toBe('Mon trajet : Passager')
  expect(screen.queryByText(/Mon paiement/)).toBeNull()
  expect(screen.queryByText(/Mon CACI/)).toBeNull()
  expect(screen.getByRole('region').textContent).not.toContain('version')
})
it('opens transport without performing a reservation', () => {
  const app = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Organiser mon trajet' }))
  expect(app.onTransport).toHaveBeenCalledOnce()
})
it('does not invent statuses during loading and preserves a stale snapshot with retry', () => {
  const first = setup(null)
  expect(screen.getByText('Chargement de ma situation…')).toBeTruthy()
  expect(screen.queryByText(/Ma place/)).toBeNull()
  expect(first.onTransport).not.toHaveBeenCalled()
  cleanup()
  const app = setup(summary, true, true)
  expect(screen.getByRole('alert').textContent).toContain('conservées')
  expect(screen.getByText('Payé')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
  expect(app.onRetry).toHaveBeenCalledOnce()
})
it('does not invent a payment debt for unanswered/No', () => {
  setup({ ...summary, my_rsvp: 'no', my_payment_status: null })
  expect(screen.getByText('Non concerné')).toBeTruthy()
  expect(screen.queryByText('À régler')).toBeNull()
})
