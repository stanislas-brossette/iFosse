import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { calendarAction, calendarSessions, nextSession, validSummary } from './calendar'
import { PersonalStatus } from './PersonalStatus'
import type { Session } from './SessionEditor'
import type { CardSummary } from './PublishedOccupancy'
import { seasonOf, todayParis } from '../../lib/dates'
afterEach(cleanup)
const session = { id: 'one', date: '2027-09-01', start_time: '20:00', status: 'open', registration_open: true } as Session
const summary: CardSummary = { session_id: 'one', capacity: 20, publication_version: 0, confirmed_count: 0, my_rsvp: 'unanswered', my_selection_state: 'none', my_transport_mode: 'unset', my_transport_provisional: false, my_payment_status: null }
it('filters by Paris date, including today and past non-closed sessions, in chronological order', () => {
  const today = todayParis(new Date('2027-08-31T22:30:00Z'))
  const past = { ...session, id: 'past', date: '2027-08-31' }
  const closed = { ...session, id: 'closed', status: 'closed' as const }
  const future = { ...session, id: 'future', date: '2027-09-02' }
  const all = [future, session, past, closed]
  expect(calendarSessions(all, 'upcoming', today).map(row => row.id)).toEqual(['closed', 'one', 'future'])
  expect(calendarSessions(all, 'past', today)).toEqual([past])
  expect(calendarSessions(all, 'all', today)).toHaveLength(4)
  expect(nextSession(all, today)).toBe('one')
  expect(nextSession([past, closed], today)).toBeUndefined()
  expect(seasonOf(today)).toBe(2027); expect(seasonOf(past.date)).toBe(2026)
})
it('uses response then unresolved trip actions, without payment priority or mutation', () => {
  expect(calendarAction(session, summary)).toEqual({ label: 'Voir / répondre', tab: 'overview' })
  for (const mode of ['unset', 'needs'] as const) expect(calendarAction(session, { ...summary, my_rsvp: 'yes', my_transport_mode: mode }).tab).toBe('transport')
  expect(calendarAction(session, { ...summary, my_rsvp: 'yes', my_transport_mode: 'passenger', my_transport_provisional: true }).tab).toBe('transport')
  for (const mode of ['own', 'driver', 'passenger'] as const) expect(calendarAction(session, { ...summary, my_rsvp: 'yes', my_transport_mode: mode, my_payment_status: 'unpaid' }).label).toBe('Voir la séance')
  for (const rsvp of ['maybe', 'no'] as const) expect(calendarAction(session, { ...summary, my_rsvp: rsvp }).label).toBe('Voir la séance')
  expect(calendarAction(session, { ...summary, my_rsvp: 'yes', my_selection_state: 'declined' }).tab).toBe('overview')
  expect(calendarAction({ ...session, status: 'closed' }, summary).label).toBe('Voir la séance')
  expect(calendarAction({ ...session, registration_open: false }, summary).label).toBe('Voir la séance')
})
it('keeps response, publication, provisional trip and private payment visually distinct', () => {
  const view = render(<PersonalStatus summary={summary} />)
  expect(screen.getByText('Sans réponse')).toBeTruthy(); expect(screen.getByText('Sélection non publiée')).toBeTruthy()
  expect(screen.getByText('Non concerné')).toBeTruthy(); expect(screen.queryByText('À régler')).toBeNull()
  for (const state of ['waiting', 'selected', 'withdrawn', 'declined']) {
    view.rerender(<PersonalStatus summary={{ ...summary, publication_version: 2, my_rsvp: 'yes', my_selection_state: state, my_transport_mode: 'passenger', my_transport_provisional: true, my_payment_status: 'paid' }} />)
    expect(screen.getByText('Provisoire · conducteur non confirmé')).toBeTruthy(); expect(screen.getByText('Payé')).toBeTruthy()
  }
})
it('rejects old or incomplete projections instead of inventing personal statuses', () => {
  expect(validSummary(summary)).toBe(true)
  expect(validSummary({ ...summary, my_rsvp: undefined } as unknown as CardSummary)).toBe(false)
  expect(validSummary({ ...summary, my_payment_status: undefined } as unknown as CardSummary)).toBe(false)
})
