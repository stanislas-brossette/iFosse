import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import type { Session } from './SessionEditor'
import { Sessions } from './Sessions'
import { formatDate, todayParis } from '../../lib/dates'
import type { CardSummary } from './PublishedOccupancy'
afterEach(cleanup)
const member = { id: 'self', role: 'member' } as Member
const sessions = Array.from({ length: 20 }, (_, index) => ({ id: `s${index}`, date: todayParis(), start_time: '20:00', end_time: '21:00', title: `Séance ${index}`, status: 'open', registration_open: true, capacity: 20 })) as Session[]
const summaries: CardSummary[] = sessions.map(row => ({ session_id: row.id, capacity: 20, confirmed_count: 20, publication_version: 1, my_rsvp: 'yes', my_selection_state: 'selected', my_transport_mode: 'own', my_transport_provisional: false, my_payment_status: 'paid' }))
function setup(initialFailure = false, cards = summaries) {
  let fail = initialFailure
  let oldSchema = false
  const rpc = vi.fn(async (name: string) => ({ data: name === 'get_season_counts' ? [{ member_id: 'self', completed_count: 3 }] : oldSchema ? cards.map(row => ({ ...row, my_rsvp: undefined })) : cards, error: fail ? { message: 'offline' } : null }))
  const query = { select: () => query, gte: () => query, lt: () => query, order: (field: string) => field === 'start_time' ? Promise.resolve({ data: sessions, error: null }) : query }
  const from = vi.fn(() => query)
  const client = { from, rpc } as unknown as SupabaseClient<Database>
  render(<Sessions client={client} member={member} />)
  return { rpc, from, fail: () => { fail = true }, oldSchema: () => { oldSchema = true } }
}
it('loads twenty personal cards in one batched request, highlights once and defaults to upcoming', async () => {
  const app = setup()
  await waitFor(() => expect(screen.getAllByLabelText('Mes statuts pour cette séance')).toHaveLength(20))
  expect(app.from).toHaveBeenCalledTimes(1)
  expect(app.rpc).toHaveBeenCalledTimes(2)
  expect(app.rpc).toHaveBeenCalledWith('get_session_card_summaries', expect.anything())
  expect(screen.getByText('Prochaine séance')).toBeTruthy()
  expect(screen.getAllByLabelText(formatDate(todayParis()))).toHaveLength(20)
  expect(screen.getAllByLabelText(formatDate(todayParis()))[0].getAttribute('datetime')).toBe(todayParis())
  expect(screen.queryByText(formatDate(todayParis()))).toBeNull()
  expect(screen.getByRole('button', { name: 'À venir' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByText('Vous pouvez encore répondre Oui')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Passées' }))
  expect(screen.getByText('Aucune séance passée dans cette saison.')).toBeTruthy()
  expect(screen.queryByText('Prochaine séance')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Toutes' }))
  expect(screen.getAllByLabelText('Mes statuts pour cette séance')).toHaveLength(20)
})
it('keeps last valid statuses and attendance count when refresh fails, and can retry', async () => {
  const app = setup()
  await waitFor(() => expect(screen.getAllByText('Payé')).toHaveLength(20))
  app.fail(); fireEvent(window, new Event('focus'))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('conservées'))
  expect(screen.getAllByText('Payé')).toHaveLength(20)
  expect(screen.getByText(/Mes fosses réalisées/).textContent).toContain('3.')
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
  await waitFor(() => expect(app.rpc).toHaveBeenCalledTimes(6))
})
it('does not replace a valid snapshot with an outdated database projection', async () => {
  const app = setup()
  await waitFor(() => expect(screen.getAllByText('Payé')).toHaveLength(20))
  app.oldSchema(); fireEvent(window, new Event('focus'))
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  expect(screen.queryByText('Sans réponse')).toBeNull()
  expect(screen.getAllByText('Payé')).toHaveLength(20)
})

it('never invents a personal status on initial failure or displays an old season as the new one', async () => {
  setup(true)
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  expect(screen.queryByText('Sans réponse')).toBeNull()
  expect(screen.queryByText('Payé')).toBeNull()
  expect(screen.getByText(/Mes fosses réalisées/).textContent).toContain('…')
})
it('hides old season cards and counters when loading another season fails', async () => {
  const app = setup()
  await waitFor(() => expect(screen.getAllByText('Payé')).toHaveLength(20))
  app.fail(); fireEvent.click(screen.getByRole('button', { name: 'Saison suivante' }))
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  expect(screen.queryByText('Payé')).toBeNull()
  expect(screen.getByText(/Mes fosses réalisées/).textContent).toContain('…')
})

it.each(['unanswered', 'maybe', 'no'] as const)('keeps the full-selection invitation relevant for response %s', async rsvp => {
  setup(false, summaries.map(row => ({ ...row, my_rsvp: rsvp, my_selection_state: 'none', my_payment_status: rsvp === 'maybe' ? 'unpaid' : null })))
  await waitFor(() => expect(screen.getAllByLabelText('Mes statuts pour cette séance')).toHaveLength(20))
  expect(screen.getAllByText('Vous pouvez encore répondre Oui')).toHaveLength(20)
})
