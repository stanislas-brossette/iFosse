import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import type { Session } from './SessionEditor'
import { Sessions } from './Sessions'
import { formatDate, seasonOf, todayParis } from '../../lib/dates'
import type { CardSummary } from './PublishedOccupancy'
afterEach(cleanup)
const member = { id: 'self', role: 'member' } as Member
const sessions = Array.from({ length: 20 }, (_, index) => ({ id: `s${index}`, date: todayParis(), start_time: '20:00', end_time: '21:00', title: `Séance ${index}`, status: 'open', registration_open: true, capacity: 20 })) as Session[]
const summaries: CardSummary[] = sessions.map(row => ({ session_id: row.id, capacity: 20, confirmed_count: 20, publication_version: 1, my_rsvp: 'yes', my_selection_state: 'selected', my_transport_mode: 'own', my_transport_provisional: false, my_payment_status: 'paid' }))
function setup(initialFailure = false, cards = summaries, missingRpc = false, rows = sessions) {
  let fail = initialFailure
  let oldSchema = false
  const rpc = vi.fn(async (name: string) => ({ data: name === 'get_season_counts' ? [{ member_id: 'self', completed_count: 3 }] : oldSchema ? cards.map(row => ({ ...row, my_rsvp: undefined })) : cards, error: missingRpc && name === 'get_session_card_summaries' ? { code: 'PGRST202', message: 'not found' } : fail ? { message: 'offline' } : null }))
  const query = { select: () => query, order: (field: string) => field === 'start_time' ? Promise.resolve({ data: rows, error: null }) : query }
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
  expect(screen.getByText('Aucune séance passée.')).toBeTruthy()
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
  expect(screen.getByRole('alert').textContent).toContain('mise à jour du serveur')
})

it('never invents a personal status or season counter on initial failure', async () => {
  setup(true)
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  expect(screen.queryByText('Sans réponse')).toBeNull()
  expect(screen.queryByText('Payé')).toBeNull()
  expect(screen.getByText(/Mes fosses réalisées/).textContent).toContain('…')
})
it('removes all season controls while keeping period filters and the current-season counter', async () => {
  setup()
  await waitFor(() => expect(screen.getAllByText('Payé')).toHaveLength(20))
  expect(screen.queryByRole('combobox', { name: 'Saison' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Saison précédente' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Saison suivante' })).toBeNull()
  expect(screen.getByText(/Mes fosses réalisées/).textContent).toContain('3.')
})
it('keeps historical and future seasons accessible through period filters with one projection per season', async () => {
  const year = Number(todayParis().slice(0, 4))
  const rows = [{ ...sessions[0], date: `${year - 2}-10-01` }, { ...sessions[1], date: `${year + 2}-10-01` }]
  const app = setup(false, summaries.slice(0, 2), false, rows)
  await waitFor(() => expect(screen.getAllByLabelText('Mes statuts pour cette séance')).toHaveLength(1))
  expect(screen.getByRole('heading', { name: 'Séance 1' })).toBeTruthy()
  expect(app.rpc).toHaveBeenCalledWith('get_session_card_summaries', { p_start_year: year - 2 })
  expect(app.rpc).toHaveBeenCalledWith('get_session_card_summaries', { p_start_year: year + 2 })
  expect(app.rpc).toHaveBeenCalledTimes(3)
  expect(app.rpc).toHaveBeenCalledWith('get_season_counts', { p_start_year: seasonOf(todayParis()) })
  fireEvent.click(screen.getByRole('button', { name: 'Passées' }))
  expect(screen.getByRole('heading', { name: 'Séance 0' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Séance 1' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Toutes' }))
  expect(screen.getAllByLabelText('Mes statuts pour cette séance')).toHaveLength(2)
})

it.each(['unanswered', 'maybe', 'no'] as const)('keeps the full-selection invitation relevant for response %s', async rsvp => {
  setup(false, summaries.map(row => ({ ...row, my_rsvp: rsvp, my_selection_state: 'none', my_payment_status: rsvp === 'maybe' ? 'unpaid' : null })))
  await waitFor(() => expect(screen.getAllByLabelText('Mes statuts pour cette séance')).toHaveLength(20))
  expect(screen.getAllByText('Vous pouvez encore répondre Oui')).toHaveLength(20)
})

it('identifies the missing calendar migration without inventing statuses on first load', async () => {
  setup(false, summaries.map(row => ({ session_id: row.session_id, capacity: row.capacity, confirmed_count: row.confirmed_count, publication_version: row.publication_version })) as CardSummary[])
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('mise à jour du serveur'))
  expect(screen.queryByLabelText('Mes statuts pour cette séance')).toBeNull()
  expect(screen.queryByText('Sans réponse')).toBeNull()
  expect(screen.queryByText('Payé')).toBeNull()
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy()
})

it('identifies an unavailable calendar RPC without inventing statuses', async () => {
  setup(false, summaries, true)
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('mise à jour du serveur'))
  expect(screen.queryByLabelText('Mes statuts pour cette séance')).toBeNull()
  expect(screen.queryByText('Payé')).toBeNull()
})

it('loads the current-season counter without card requests when the calendar is empty', async () => {
  const app = setup(false, [], false, [])
  await screen.findByText('Aucune séance à venir.')
  expect(app.rpc).toHaveBeenCalledExactlyOnceWith('get_season_counts', { p_start_year: seasonOf(todayParis()) })
  expect(screen.getByText(/Mes fosses réalisées/).textContent).toContain('3.')
})
